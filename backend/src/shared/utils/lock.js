const redisConfig = require('../config/redis');

/**
 * Explicit Distributed Lock Utility
 * Implements step-by-step lock logic with verbose variables.
 */

async function acquireLock(key, ttlMs) {
  return redisConfig.acquireLock('lock:' + key, ttlMs);
}

async function releaseLock(key, lockValue) {
  return redisConfig.releaseLock('lock:' + key, lockValue.toString());
}

async function extendLock(key, lockValue, additionalTTLMs) {
  const redis = redisConfig.client;
  if (!redis) {
    return false;
  }
  const redisKey = 'lock:' + key;
  
  try {
    const currentValue = await redis.get(redisKey);
    
    if (currentValue) {
      if (currentValue === lockValue.toString()) {
        // Extend the TTL. Using pExpire for milliseconds compatibility with redis v4 client.
        await redis.pExpire(redisKey, additionalTTLMs);
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  } catch (error) {
    console.error('Lock extension failed:', error);
    throw new Error('Lock extension failed');
  }
}

module.exports = {
  acquireLock,
  releaseLock,
  extendLock
};
