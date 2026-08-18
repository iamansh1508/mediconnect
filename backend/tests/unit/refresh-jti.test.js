const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Module = require('module');

const originalRequire = Module.prototype.require;
const mockRedisStore = new Map();
let lastSetArgs = null;

Module.prototype.require = function (id) {
  if (id === 'redis') {
    return {
      createClient: () => ({
        on: () => {},
        connect: async () => {},
        set: async (key, value, options) => {
          lastSetArgs = { key, value, options };
          if (options?.NX && mockRedisStore.has(key)) return null;
          mockRedisStore.set(key, value);
          return 'OK';
        },
        exists: async (key) => (mockRedisStore.has(key) ? 1 : 0),
        eval: async () => 1,
      }),
    };
  }
  return originalRequire.apply(this, arguments);
};

const redisConfig = require('../../src/shared/config/redis');
const { claimRefreshJti } = require('../../src/modules/auth/refreshJti');

before(async () => {
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.REFRESH_TOKEN_TTL = '7d';
  mockRedisStore.clear();
  await redisConfig.init();
});

after(() => {
  Module.prototype.require = originalRequire;
});

test('getRefreshTokenTtlSeconds parses refresh TTL', () => {
  process.env.REFRESH_TOKEN_TTL = '15m';
  assert.strictEqual(redisConfig.getRefreshTokenTtlSeconds(), 900);
  process.env.REFRESH_TOKEN_TTL = '7d';
});

test('markJtiUsed stores used_jti key with EX TTL', async () => {
  const jti = 'unit-jti-1';
  const claimed = await redisConfig.markJtiUsed(jti, 3600);
  assert.strictEqual(claimed, true);
  assert.strictEqual(lastSetArgs.key, `used_jti:${jti}`);
  assert.deepStrictEqual(lastSetArgs.options, { NX: true, EX: 3600 });
  assert.strictEqual(await redisConfig.isJtiUsed(jti), true);
});

test('claimRefreshJti allows first use and rejects replay', async () => {
  const jti = 'unit-jti-2';
  assert.strictEqual(await claimRefreshJti(jti), true);
  assert.strictEqual(await claimRefreshJti(jti), false);
});

test('markJtiUsed returns false on duplicate NX set', async () => {
  const jti = 'unit-jti-3';
  assert.strictEqual(await redisConfig.markJtiUsed(jti, 60), true);
  assert.strictEqual(await redisConfig.markJtiUsed(jti, 60), false);
});
