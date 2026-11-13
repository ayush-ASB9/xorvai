import { createAIProvider } from './ai/provider.js';
import { normalizeIdeaInput } from './utils/validation.js';
import { orchestrateAnalysis } from './agents/orchestrator.js';

// Waitlist users live in one Upstash Redis hash keyed by email. Without Redis credentials,
// such as in local dev, they are kept in memory and lost when the server restarts or sleeps.
const USERS_HASH = 'xorvai:users';
const MEMORY_USERS = globalThis.__xorvaiUsers ?? new Map();
globalThis.__xorvaiUsers = MEMORY_USERS;

function normalizeEmail(rawValue) {
  if (typeof rawValue !== 'string') return '';
  const value = rawValue.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '';
  return value;
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toBytes(value) {
  return new TextEncoder().encode(String(value));
}

function timingSafeEqual(left, right) {
  const leftBytes = toBytes(left);
  const rightBytes = toBytes(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}

// The REST URL and token from the Upstash console (free tier, no card needed).
function getRedisConfig(env) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

// Upstash's REST API runs one Redis command sent as a JSON array and answers { result }.
async function redis(config, command) {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}` },
    body: JSON.stringify(command),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new Error(`Redis ${command[0]} failed: ${body.error || `HTTP ${response.status}`}`);
  }
  return body.result;
}

async function listUsers(env) {
  const config = getRedisConfig(env);
  let records = Array.from(MEMORY_USERS.values());
  if (config) {
    try {
      // HGETALL returns [field1, value1, field2, value2, ...].
      const flat = await redis(config, ['HGETALL', USERS_HASH]);
      records = (flat || []).filter((_, index) => index % 2 === 1).map(safeJsonParse);
    } catch {
      return [];
    }
  }

  return records
    .filter((record) => record && typeof record === 'object')
    .map((record) => ({
      email: record.email,
      createdAt: record.createdAt,
      lastSeenAt: record.lastSeenAt,
    }));
}

async function getUserRecord(env, email) {
  const config = getRedisConfig(env);
  if (config) {
    try {
      return safeJsonParse(await redis(config, ['HGET', USERS_HASH, email]));
    } catch {
      return null;
    }
  }

  return MEMORY_USERS.get(email) || null;
}

async function saveUserRecord(env, email, record) {
  const config = getRedisConfig(env);
  if (config) {
    await redis(config, ['HSET', USERS_HASH, email, JSON.stringify(record)]);
    return;
  }

  MEMORY_USERS.set(email, record);
}

async function deleteUserRecord(env, email) {
  const config = getRedisConfig(env);
  if (config) {
    await redis(config, ['HDEL', USERS_HASH, email]);
    return;
  }

  MEMORY_USERS.delete(email);
}

async function registerUser(env, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error('Invalid email address');
  }

  const now = new Date().toISOString();
  const existing = await getUserRecord(env, normalized);
  if (existing) {
    existing.lastSeenAt = now;
    await saveUserRecord(env, normalized, existing);
    return existing;
  }

  const record = {
    email: normalized,
    createdAt: now,
    lastSeenAt: now,
  };

  await saveUserRecord(env, normalized, record);
  return record;
}

async function getUserCount(env) {
  const users = await listUsers(env);
  return users.length;
}

function getAdminToken(env) {
  return typeof env?.ADMIN_TOKEN === 'string' ? env.ADMIN_TOKEN.trim() : '';
}

function getBearerToken(request) {
  const value = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? match[1].trim() : '';
}

function isAdminAuthorized(request, env) {
  const token = getAdminToken(env);
  const provided = getBearerToken(request);
  if (!token || !provided) {
    return false;
  }
  return timingSafeEqual(token, provided);
}

// Handles every /api/* route; server.js passes those requests here as web-standard Requests.
export default {
  async fetch(request) {
    const env = process.env;
    const { pathname } = new URL(request.url);

    if (request.method === 'GET' && pathname === '/api/health') {
      const ai = await createAIProvider(env);
      const providerStatus = await ai.healthCheck();
      return Response.json({ ok: true, service: 'xorvai', status: 'healthy', ai: providerStatus, webSearch: Boolean(env.TAVILY_API_KEY) });
    }

    if (request.method === 'POST' && pathname === '/api/register') {
      try {
        const body = await request.json();
        const email = normalizeEmail(body?.email || '');
        if (!email) {
          return Response.json({ ok: false, error: 'Invalid email address' }, { status: 400 });
        }

        const result = await registerUser(env, email);
        return Response.json({ ok: true, data: { email: result.email, users: await getUserCount(env) } });
      } catch (error) {
        return Response.json({ ok: false, error: error.message }, { status: 400 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/stats') {
      const count = await getUserCount(env);
      return Response.json({ ok: true, data: { users: count } });
    }

    if (request.method === 'GET' && pathname === '/api/admin/users') {
      if (!isAdminAuthorized(request, env)) {
        return Response.json({ ok: false, error: 'Admin access required' }, { status: 401 });
      }

      const users = await listUsers(env);
      return Response.json({ ok: true, data: users });
    }

    if (request.method === 'DELETE' && pathname === '/api/admin/users') {
      if (!isAdminAuthorized(request, env)) {
        return Response.json({ ok: false, error: 'Admin access required' }, { status: 401 });
      }

      const body = await request.json().catch(() => ({}));
      const email = normalizeEmail(body?.email || '');
      if (!email) {
        return Response.json({ ok: false, error: 'Email required for deletion' }, { status: 400 });
      }

      await deleteUserRecord(env, email);
      return Response.json({ ok: true, data: { deleted: email, users: await getUserCount(env) } });
    }

    if (request.method === 'GET' && pathname === '/api/admin/export') {
      if (!isAdminAuthorized(request, env)) {
        return Response.json({ ok: false, error: 'Admin access required' }, { status: 401 });
      }

      const users = await listUsers(env);
      const rows = users.map((user) => [user.email || '', user.createdAt || '', user.lastSeenAt || '']);
      const csv = ['email,createdAt,lastSeenAt', ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n');

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="xorvai-users.csv"',
        },
      });
    }

    if (request.method === 'POST' && pathname === '/api/thesis') {
      try {
        const body = await request.json();
        const input = normalizeIdeaInput(body || {});
        const { generateThesis } = await import('./agents/thesis.js');
        return Response.json({ ok: true, data: generateThesis(input) });
      } catch (error) {
        return Response.json({ ok: false, error: error.message }, { status: 400 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/research') {
      try {
        const body = await request.json();
        const input = normalizeIdeaInput(body || {});
        const { runResearch } = await import('./agents/research.js');
        const result = await runResearch(input, await createAIProvider(env), env);
        return Response.json({ ok: true, data: result });
      } catch (error) {
        return Response.json({ ok: false, error: error.message }, { status: 400 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/analyze') {
      try {
        const body = await request.json();
        const result = await orchestrateAnalysis(body || {}, env);
        return Response.json({ ok: true, data: result });
      } catch (error) {
        return Response.json({ ok: false, error: error.message }, { status: 400 });
      }
    }

    return Response.json({ ok: false, error: 'Unknown API route' }, { status: 404 });
  },
};
