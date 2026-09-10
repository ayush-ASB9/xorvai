import { createAIProvider } from './ai/provider.js';
import { normalizeIdeaInput } from './utils/validation.js';
import { orchestrateAnalysis } from './agents/orchestrator.js';

const USERS_PREFIX = 'user:';
const APP_ROUTES = new Set([
  '/',
  '/app',
  '/app/analysis',
  '/app/reports',
  '/app/archive',
  '/app/settings',
  '/admin',
]);
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

function getUserKey(email) {
  return `${USERS_PREFIX}${normalizeEmail(email)}`;
}

async function listUsers(env) {
  if (env?.XORVAI_USERS && typeof env.XORVAI_USERS.list === 'function') {
    try {
      const result = await env.XORVAI_USERS.list({ prefix: USERS_PREFIX });
      if (!Array.isArray(result?.keys) || result.keys.length === 0) {
        return [];
      }

      const users = [];
      for (const entry of result.keys) {
        const key = typeof entry?.name === 'string' ? entry.name : '';
        if (!key) continue;
        const raw = await env.XORVAI_USERS.get(key);
        const record = safeJsonParse(raw);
        if (record && typeof record === 'object') {
          users.push({
            email: record.email,
            createdAt: record.createdAt,
            lastSeenAt: record.lastSeenAt,
          });
        }
      }

      return users;
    } catch {
      return [];
    }
  }

  return Array.from(MEMORY_USERS.values()).map((record) => ({
    email: record.email,
    createdAt: record.createdAt,
    lastSeenAt: record.lastSeenAt,
  }));
}

async function getUserRecord(env, email) {
  const key = getUserKey(email);
  if (env?.XORVAI_USERS && typeof env.XORVAI_USERS.get === 'function') {
    try {
      const raw = await env.XORVAI_USERS.get(key);
      return safeJsonParse(raw);
    } catch {
      return null;
    }
  }

  return MEMORY_USERS.has(key) ? MEMORY_USERS.get(key) : null;
}

async function saveUserRecord(env, email, record) {
  const key = getUserKey(email);
  if (env?.XORVAI_USERS && typeof env.XORVAI_USERS.put === 'function') {
    await env.XORVAI_USERS.put(key, JSON.stringify(record));
    return;
  }

  MEMORY_USERS.set(key, record);
}

async function deleteUserRecord(env, email) {
  const key = getUserKey(email);
  if (env?.XORVAI_USERS && typeof env.XORVAI_USERS.delete === 'function') {
    await env.XORVAI_USERS.delete(key);
    return;
  }

  MEMORY_USERS.delete(key);
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

async function serveAssetOrIndex(request, env) {
  if (env?.ASSETS) {
    const assetUrl = new URL('/index.html', request.url);
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (assetResponse.status !== 404) {
      return assetResponse;
    }
  }

  return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        const ai = await createAIProvider(env);
        const providerStatus = await ai.healthCheck();
        return Response.json({ ok: true, service: 'xorvai', status: 'healthy', ai: providerStatus });
      }

      if (request.method === 'POST' && url.pathname === '/api/register') {
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

      if (request.method === 'GET' && url.pathname === '/api/stats') {
        const count = await getUserCount(env);
        return Response.json({ ok: true, data: { users: count } });
      }

      if (request.method === 'GET' && url.pathname === '/api/admin/users') {
        if (!isAdminAuthorized(request, env)) {
          return Response.json({ ok: false, error: 'Admin access required' }, { status: 401 });
        }

        const users = await listUsers(env);
        return Response.json({ ok: true, data: users });
      }

      if (request.method === 'DELETE' && url.pathname === '/api/admin/users') {
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

      if (request.method === 'GET' && url.pathname === '/api/admin/export') {
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

      if (request.method === 'POST' && url.pathname === '/api/thesis') {
        try {
          const body = await request.json();
          const input = normalizeIdeaInput(body || {});
          const { generateThesis } = await import('./agents/thesis.js');
          return Response.json({ ok: true, data: generateThesis(input) });
        } catch (error) {
          return Response.json({ ok: false, error: error.message }, { status: 400 });
        }
      }

      if (request.method === 'POST' && url.pathname === '/api/research') {
        try {
          const body = await request.json();
          const input = normalizeIdeaInput(body || {});
          const { runResearch } = await import('./agents/research.js');
          const result = await runResearch(input, []);
          return Response.json({ ok: true, data: result });
        } catch (error) {
          return Response.json({ ok: false, error: error.message }, { status: 400 });
        }
      }

      if (request.method === 'POST' && url.pathname === '/api/analyze') {
        try {
          const body = await request.json();
          const result = await orchestrateAnalysis(body || {}, env);
          return Response.json({ ok: true, data: result });
        } catch (error) {
          return Response.json({ ok: false, error: error.message }, { status: 400 });
        }
      }

      return Response.json({ ok: false, error: 'Unknown API route' }, { status: 404 });
    }

    if (APP_ROUTES.has(url.pathname) || url.pathname.startsWith('/admin')) {
      return serveAssetOrIndex(request, env);
    }

    if (url.pathname.startsWith('/app')) {
      return serveAssetOrIndex(request, env);
    }

    if (env?.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  },
};
