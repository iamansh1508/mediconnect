const crypto = require('crypto');
const Redis = require('ioredis'); // the client BullMQ already uses, so the app needs only one
const log = require('./log');

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true });
redis.on('error', (e) => log.error('redis error', { err: e.message }));

const RELEASE = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

// Runs fn while holding a lock on key. SET NX PX is enough with one Redis node; Redlock only
// matters when a lock must survive across several independent Redis nodes.
redis.withLock = async (key, ms, fn, busyError) => {
  const token = crypto.randomUUID();
  if ((await redis.set(key, token, 'PX', ms, 'NX')) !== 'OK') throw busyError;
  try {
    return await fn();
  } finally {
    // Compare-and-delete: never remove a lock someone else took after ours expired.
    await redis.eval(RELEASE, 1, key, token);
  }
};

module.exports = redis;
