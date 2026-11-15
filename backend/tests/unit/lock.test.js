const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Module = require('module');

const originalRequire = Module.prototype.require;

// Mock Redis Client
const mockRedisStore = new Map();
const mockTimeouts = new Map();

Module.prototype.require = function (id) {
  if (id === 'redis') {
    return {
      createClient: () => ({
        on: () => {},
        connect: async () => {},
        set: async (key, value, options) => {
          if (options && options.NX) {
            if (mockRedisStore.has(key)) return null;
          }
          mockRedisStore.set(key, value);
          
          // Simulate TTL expiration
          if (options && options.PX) {
            const timeoutId = setTimeout(() => {
              mockRedisStore.delete(key);
              mockTimeouts.delete(key);
            }, options.PX);
            mockTimeouts.set(key, timeoutId);
          }
          
          return 'OK';
        },
        get: async (key) => mockRedisStore.get(key) || null,
        eval: async (_script, options) => {
          const [key] = options.keys;
          const [value] = options.arguments;
          if (mockRedisStore.get(key) !== value) return 0;
          mockRedisStore.delete(key);
          return 1;
        },
        del: async (key) => {
          const existed = mockRedisStore.has(key);
          mockRedisStore.delete(key);
          return existed ? 1 : 0;
        },
        pExpire: async () => 1
      })
    };
  }
  return originalRequire.apply(this, arguments);
};

const redisConfig = require('../../src/shared/config/redis');
const { acquireLock, releaseLock } = require('../../src/shared/utils/lock');

before(async () => {
  process.env.REDIS_URL = 'redis://localhost:6379';
  mockRedisStore.clear();
  mockTimeouts.forEach(timeout => clearTimeout(timeout));
  mockTimeouts.clear();
  await redisConfig.init();
});

after(() => {
  Module.prototype.require = originalRequire;
});

test('acquireLock succeeds when no lock exists', async () => {
  mockRedisStore.clear();
  const lockKey = 'test-lock-1';
  const lockValue = await acquireLock(lockKey, 5000);
  assert.ok(lockValue, 'Lock should be acquired');
  const storedValue = mockRedisStore.get('lock:' + lockKey);
  assert.strictEqual(storedValue, lockValue.toString(), 'Lock value should be stored');
});

test('acquireLock fails when lock held', async () => {
  mockRedisStore.clear();
  const lockKey = 'test-lock-2';
  const existingValue = Date.now().toString();
  mockRedisStore.set('lock:' + lockKey, existingValue);
  const lockValue = await acquireLock(lockKey, 5000);
  assert.strictEqual(lockValue, null, 'Lock acquisition should fail when lock exists');
});

test('releaseLock succeeds when value matches', async () => {
  mockRedisStore.clear();
  const lockKey = 'test-lock-3';
  const lockValue = Date.now();
  mockRedisStore.set('lock:' + lockKey, lockValue.toString());
  const released = await releaseLock(lockKey, lockValue);
  assert.strictEqual(released, true, 'Lock should be released');
  assert.strictEqual(mockRedisStore.has('lock:' + lockKey), false, 'Lock key should be deleted');
});

test('lock expires after TTL', async () => {
  mockRedisStore.clear();
  const lockKey = 'test-lock-4';
  const lockValue = await acquireLock(lockKey, 100); // 100ms TTL
  assert.ok(lockValue, 'Lock should be acquired');
  await new Promise(resolve => setTimeout(resolve, 200)); // Wait longer than TTL
  const lockValueAfterExpiry = await acquireLock(lockKey, 5000);
  assert.ok(lockValueAfterExpiry, 'Lock should be acquirable after expiry');
});
