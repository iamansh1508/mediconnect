const { createClient } = require('redis');
const crypto = require('crypto');

let client = null;
let ready = false;

function isConfigured() {
  return !!process.env.REDIS_URL;
}

async function init() {
  if (!isConfigured()) return null;
  if (client) return client;
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (e) => console.warn('Redis client error', e && e.message));
  try {
    await client.connect();
    ready = true;
    console.log('Connected to Redis');
  } catch (e) {
    console.warn('Failed to connect to Redis:', e && e.message);
    client = null;
    ready = false;
  }
  return client;
}

// Acquire a simple lock: SET key value NX PX ttl
async function acquireLock(key, ttl = 5000) {
  if (!client) return null;
  const token = crypto.randomBytes(12).toString('hex');
  try {
    const res = await client.set(key, token, { NX: true, PX: ttl });
    return res === 'OK' ? token : null;
  } catch (e) {
    console.warn('Redis acquireLock error', e && e.message);
    return null;
  }
}

// Release lock only if token matches
async function releaseLock(key, token) {
  if (!client) return false;
  const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
  try {
    const res = await client.eval(lua, { keys: [key], arguments: [token] });
    return res === 1;
  } catch (e) {
    console.warn('Redis releaseLock error', e && e.message);
    return false;
  }
}

// Token replay detection: store used refresh JTIs in Redis with TTL (in-memory fallback for dev)
const fallbackUsedJtiStore = new Set();

function getRefreshTokenTtlSeconds() {
  const raw = process.env.REFRESH_TOKEN_TTL || '7d';
  const match = /^(\d+)([smhd])$/i.exec(String(raw).trim());
  if (!match) return 7 * 24 * 3600;
  const n = parseInt(match[1], 10);
  const mult = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (mult[match[2].toLowerCase()] || 86400);
}

async function isJtiUsed(jti) {
  if (!jti) return false;
  if (client) {
    try {
      const res = await client.exists(`used_jti:${jti}`);
      return res === 1;
    } catch (e) {
      console.warn('Redis isJtiUsed error', e && e.message);
    }
  }
  return fallbackUsedJtiStore.has(jti);
}

/** Mark a refresh JTI as used. Returns true if newly claimed, false if already used (replay). */
async function markJtiUsed(jti, ttlSeconds = getRefreshTokenTtlSeconds()) {
  if (!jti) return true;
  if (client) {
    try {
      const res = await client.set(`used_jti:${jti}`, '1', { NX: true, EX: ttlSeconds });
      return res === 'OK';
    } catch (e) {
      console.warn('Redis markJtiUsed error', e && e.message);
    }
  }
  if (fallbackUsedJtiStore.has(jti)) return false;
  fallbackUsedJtiStore.add(jti);
  return true;
}

module.exports = {
  init,
  isConfigured,
  get client() { return client; },
  get ready() { return ready; },
  acquireLock,
  releaseLock,
  getRefreshTokenTtlSeconds,
  isJtiUsed,
  markJtiUsed,
};

