const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const mongoose = require('mongoose');
const Module = require('module');

const originalRequire = Module.prototype.require;
const mockRedisStore = new Map();

Module.prototype.require = function (id) {
  if (id === 'redis') {
    return {
      createClient: () => ({
        on: () => {},
        connect: async () => {},
        set: async (key, value, options) => {
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

const app = require('../../src/app');
const redisConfig = require('../../src/shared/config/redis');

const PORT = 5006;
const BASE = `http://localhost:${PORT}`;

let server;
let mongod;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null });
        } catch {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

before(async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  process.env.REDIS_URL = 'redis://localhost:6379';
  mockRedisStore.clear();
  await redisConfig.init();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
  Module.prototype.require = originalRequire;
});

test('refresh token rotation and replay rejection', async () => {
  const email = `refresh_${Date.now()}@example.com`;
  await request('POST', '/api/v1/auth/register', {
    name: 'Refresh User',
    email,
    username: `refresh_${Date.now()}`,
    password: 'Password123!',
    role: 'patient',
  });

  const login = await request('POST', '/api/v1/auth/login', { email, password: 'Password123!' });
  assert.strictEqual(login.status, 200);
  const initialRefresh = login.data.refreshToken;

  const rotated = await request('POST', '/api/v1/auth/refresh-token', { refreshToken: initialRefresh });
  assert.strictEqual(rotated.status, 200);
  assert.notStrictEqual(rotated.data.refreshToken, initialRefresh);

  const replay = await request('POST', '/api/v1/auth/refresh-token', { refreshToken: initialRefresh });
  assert.strictEqual(replay.status, 401);
  assert.match(replay.data.message, /reuse detected/i);

  const invalidated = await request('POST', '/api/v1/auth/refresh-token', { refreshToken: rotated.data.refreshToken });
  assert.strictEqual(invalidated.status, 401);
});
