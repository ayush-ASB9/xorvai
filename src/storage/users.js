// Waitlist users, keyed by normalized email. On Vercel this is Upstash Redis (Storage tab ->
// Upstash for Redis), which injects UPSTASH_REDIS_REST_* or the older KV_REST_API_* names.
// Without them, users live in this process's memory, which only suits local development.
const USERS_HASH = 'xorvai:users';
const memoryUsers = globalThis.__xorvaiUsers ?? (globalThis.__xorvaiUsers = new Map());

function parseRecord(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const memoryStore = {
  mode: 'memory',
  async get(email) {
    return memoryUsers.get(email) ?? null;
  },
  async put(email, record) {
    memoryUsers.set(email, record);
  },
  async delete(email) {
    memoryUsers.delete(email);
  },
  async list() {
    return Array.from(memoryUsers.values());
  },
  async count() {
    return memoryUsers.size;
  },
};

export function createUserStore(env = {}) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return memoryStore;

  async function redis(...command) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(command),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) {
      throw new Error(`Redis ${command[0]} failed: ${body.error || `HTTP ${response.status}`}`);
    }
    return body.result;
  }

  return {
    mode: 'redis',
    async get(email) {
      return parseRecord(await redis('HGET', USERS_HASH, email));
    },
    async put(email, record) {
      await redis('HSET', USERS_HASH, email, JSON.stringify(record));
    },
    async delete(email) {
      await redis('HDEL', USERS_HASH, email);
    },
    async list() {
      return (await redis('HVALS', USERS_HASH)).map(parseRecord).filter(Boolean);
    },
    async count() {
      return redis('HLEN', USERS_HASH);
    },
  };
}
