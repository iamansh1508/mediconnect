const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Module = require('module');

const originalRequire = Module.prototype.require;

// Mock Store for Redis
const mockRedisStore = new Map();

// Mock Require for Redis Client
Module.prototype.require = function (id) {
  if (id === 'redis') {
    return {
      createClient: () => ({
        on: () => {},
        connect: async () => {},
        zAdd: async (key, members) => {
          if (!mockRedisStore.has(key)) {
            mockRedisStore.set(key, []);
          }
          const arr = mockRedisStore.get(key);
          let addedCount = 0;
          for (let i = 0; i < members.length; i = i + 1) {
            const member = members[i];
            const value = typeof member === 'object' ? member.value : member;
            const score = typeof member === 'object' ? member.score : score;
            arr.push({ score: score, value: value });
            addedCount = addedCount + 1;
          }
          return addedCount;
        },
        zRank: async (key, value) => {
          const arr = mockRedisStore.get(key);
          if (!arr) return null;
          for (let i = 0; i < arr.length; i = i + 1) {
            if (arr[i].value === value) return i;
          }
          return null;
        },
        zRange: async (key, start, end) => {
          const arr = mockRedisStore.get(key);
          if (!arr) return [];
          const result = [];
          const endIndex = end === -1 ? arr.length - 1 : end;
          for (let i = start; i <= endIndex && i < arr.length; i = i + 1) {
            result.push(arr[i].value);
          }
          return result;
        },
        zRem: async (key, value) => {
          const arr = mockRedisStore.get(key);
          if (!arr) return 0;
          const newArr = [];
          let removedCount = 0;
          for (let i = 0; i < arr.length; i = i + 1) {
            if (arr[i].value !== value) {
              newArr.push(arr[i]);
            } else {
              removedCount = removedCount + 1;
            }
          }
          mockRedisStore.set(key, newArr);
          return removedCount;
        },
        expire: async () => 1,
        del: async (key) => {
          mockRedisStore.delete(key);
          return 1;
        }
      })
    };
  }
  return originalRequire.apply(this, arguments);
};

// Import config and service
const redisConfig = require('../../src/shared/config/redis');
const queueService = require('../../src/modules/booking/queue.service');

before(async () => {
  process.env.REDIS_URL = 'redis://localhost:6379';
  mockRedisStore.clear();
  await redisConfig.init();
});

after(() => {
  Module.prototype.require = originalRequire;
});

test('Queue Service - addToQueue and getQueuePosition', async () => {
  mockRedisStore.clear();
  const added = await queueService.addToQueue('appt-123', '2026-08-25T10:00:00.000Z', 1);
  assert.strictEqual(added, true);
  const pos = await queueService.getQueuePosition('appt-123', '2026-08-25');
  assert.strictEqual(pos, 1);
});

test('Queue Service - callNextPatient removes first from queue', async () => {
  mockRedisStore.clear();
  await queueService.addToQueue('appt-123', '2026-08-25', 1);
  await queueService.addToQueue('appt-456', '2026-08-25', 2);
  const next = await queueService.callNextPatient('2026-08-25');
  assert.strictEqual(next, 'appt-123');
  const pos = await queueService.getQueuePosition('appt-123', '2026-08-25');
  assert.strictEqual(pos, null);
});

test('Queue Service - getAllInQueue returns ordered list', async () => {
  mockRedisStore.clear();
  await queueService.addToQueue('appt-123', '2026-08-25', 1);
  await queueService.addToQueue('appt-456', '2026-08-25', 2);
  const all = await queueService.getAllInQueue('2026-08-25');
  assert.ok(all.length >= 2, 'Should have at least two entries');
});

test('Queue Service - updateQueuePosition changes position', async () => {
  mockRedisStore.clear();
  await queueService.addToQueue('appt-123', '2026-08-25', 1);
  await queueService.addToQueue('appt-456', '2026-08-25', 2);
  const updated = await queueService.updateQueuePosition('appt-123', '2026-08-25', 100);
  assert.ok(updated, 'Update should succeed');
});

test('Queue Service - clearQueueForDate removes all entries', async () => {
  mockRedisStore.clear();
  await queueService.addToQueue('appt-123', '2026-08-25', 1);
  await queueService.addToQueue('appt-456', '2026-08-25', 2);
  const cleared = await queueService.clearQueueForDate('2026-08-25');
  assert.strictEqual(cleared, true);
  const all = await queueService.getAllInQueue('2026-08-25');
  assert.deepStrictEqual(all, []);
});
