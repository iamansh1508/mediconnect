const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const mongoose = require('mongoose');

// We will mock the redis module using require cache hacking
const Module = require('module');
const originalRequire = Module.prototype.require;

let redisSetArgs = null;

const mockRedisStore = new Map();

Module.prototype.require = function(id) {
  if (id === 'redis') {
    return {
      createClient: () => {
        return {
          on: () => {},
          connect: async () => {},
          set: async (key, value, options) => {
            redisSetArgs = { key, value, options };
            mockRedisStore.set(key, value);
            return 'OK';
          },
          exists: async (key) => {
            return mockRedisStore.has(key) ? 1 : 0;
          },
          eval: async () => 1,
          get: async (key) => mockRedisStore.get(key) || null,
          del: async (key) => {
            const existed = mockRedisStore.has(key);
            mockRedisStore.delete(key);
            return existed ? 1 : 0;
          },
          zAdd: async (key, members) => {
            if (!mockRedisStore.has(key)) mockRedisStore.set(key, []);
            const arr = mockRedisStore.get(key);
            for (let i = 0; i < members.length; i = i + 1) {
              const m = members[i];
              arr.push({ score: m.score, value: m.value });
            }
            return members.length;
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
            const endIndex = end === -1 ? arr.length - 1 : end;
            const out = [];
            for (let i = start; i <= endIndex && i < arr.length; i = i + 1) out.push(arr[i].value);
            return out;
          },
          zRem: async (key, value) => {
            const arr = mockRedisStore.get(key);
            if (!arr) return 0;
            const newArr = [];
            let removed = 0;
            for (let i = 0; i < arr.length; i = i + 1) {
              if (arr[i].value !== value) newArr.push(arr[i]); else removed = removed + 1;
            }
            mockRedisStore.set(key, newArr);
            return removed;
          },
          expire: async () => 1
        };
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

const app = require('../../src/app');
const redisConfig = require('../../src/shared/config/redis');

let server;
let MONGODB_URI;
let mongod;

const BASE = 'http://localhost:5005';
const PORT = 5005;

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let bodyData = '';
      res.on('data', chunk => bodyData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: bodyData ? JSON.parse(bodyData) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: bodyData });
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
  MONGODB_URI = mongod.getUri();
  await mongoose.connect(MONGODB_URI);
  process.env.REDIS_URL = 'redis://localhost:6379';
  await redisConfig.init();
  server = http.createServer(app);
  await new Promise(resolve => server.listen(PORT, resolve));
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
  Module.prototype.require = originalRequire;
});

test('Redis SET NX PX logic test', async () => {
  const token = await redisConfig.acquireLock('test-lock', 5000);
  assert.ok(token);
  assert.deepStrictEqual(redisSetArgs.options, { NX: true, PX: 5000 });
  assert.strictEqual(redisSetArgs.key, 'test-lock');
});

test('Sanity check: Doctor and Patient registration/login, doctor search, booking', async () => {
  // 1. Doctor Registration
  const docRes = await request('POST', '/api/v1/auth/register', {
    name: 'Sanity Doctor',
    email: 'sanitydoc@example.com',
    username: 'sanitydoc',
    password: 'Password123!',
    role: 'doctor'
  });
  assert.strictEqual(docRes.status, 201, 'Doctor registration failed');

  // 2. Doctor Login
  const docLogin = await request('POST', '/api/v1/auth/login', {
    email: 'sanitydoc@example.com',
    password: 'Password123!'
  });
  assert.strictEqual(docLogin.status, 200, 'Doctor login failed');
  const docToken = docLogin.data.accessToken;
  const doctorId = docLogin.data.user._id;

  // 3. Create Doctor Profile
  const profileRes = await request('PUT', '/api/v1/doctors/me', {
    specialty: 'Cardiology',
    consultationFee: 500,
    location: { type: 'Point', coordinates: [0, 0] }
  }, docToken);
  assert.strictEqual(profileRes.status, 200, 'Doctor profile update failed');

  // 4. Patient Registration & Login
  await request('POST', '/api/v1/auth/register', {
    name: 'Sanity Patient',
    email: 'sanitypat@example.com',
    username: 'sanitypat',
    password: 'Password123!',
    role: 'patient'
  });
  const patLogin = await request('POST', '/api/v1/auth/login', {
    email: 'sanitypat@example.com',
    password: 'Password123!'
  });
  assert.strictEqual(patLogin.status, 200, 'Patient login failed');
  const patToken = patLogin.data.accessToken;

  // 5. Doctor Search Route Test
  const searchRes = await request('GET', '/api/v1/doctors/search?q=Sanity', null, patToken);
  assert.strictEqual(searchRes.status, 200, 'Doctor search failed');
  assert.ok(searchRes.data.doctors.some(d => d.userId.name === 'Sanity Doctor'), 'Doctor not found in search');

  // 6. Booking Route Test
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 1);
  const bookingRes = await request('POST', '/api/v1/appointments/book', {
    doctorId: profileRes.data.doctor._id,
    date: bookingDate.toISOString(),
    timeSlot: '10:00-10:30'
  }, patToken);

  assert.strictEqual(bookingRes.status, 201, 'Appointment booking failed');
  assert.ok(bookingRes.data.appointment, 'Appointment data missing');
});

test('Cursor-based doctor pagination test', async () => {
  // Create second doctor to test multi-page pagination
  const doc2Email = `doc2_${Date.now()}@example.com`;
  await request('POST', '/api/v1/auth/register', {
    name: 'Doctor Two',
    email: doc2Email,
    username: `doc2_${Date.now()}`,
    password: 'Password123!',
    role: 'doctor'
  });
  const doc2Login = await request('POST', '/api/v1/auth/login', {
    email: doc2Email,
    password: 'Password123!'
  });
  await request('PUT', '/api/v1/doctors/me', {
    specialty: 'Dermatology',
    consultationFee: 300
  }, doc2Login.data.accessToken);

  // Login as patient to query doctors
  const loginRes = await request('POST', '/api/v1/auth/login', {
    email: 'sanitypat@example.com',
    password: 'Password123!'
  });
  const token = loginRes.data.accessToken;

  // Query page 1 with limit=1
  const page1 = await request('GET', '/api/v1/doctors?limit=1', null, token);
  assert.strictEqual(page1.status, 200);
  assert.strictEqual(page1.data.doctors.length, 1);
  assert.ok(page1.data.nextCursor, 'nextCursor should be present when more items exist');
  assert.strictEqual(page1.data.hasNextPage, true);

  // Query page 2 with cursor
  const page2 = await request('GET', `/api/v1/doctors?limit=1&cursor=${page1.data.nextCursor}`, null, token);
  assert.strictEqual(page2.status, 200);
  assert.strictEqual(page2.data.doctors.length, 1);
  assert.notStrictEqual(page2.data.doctors[0]._id, page1.data.doctors[0]._id, 'Page 2 should contain different doctor');
});

test('P0 Fixes: Doctor static route ordering & empty location updates', async () => {
  const docEmail = `p0_doc_${Date.now()}@example.com`;
  await request('POST', '/api/v1/auth/register', {
    name: 'P0 Doctor',
    email: docEmail,
    username: `p0doc_${Date.now()}`,
    password: 'CorrectPassword123!',
    role: 'doctor'
  });
  const loginRes = await request('POST', '/api/v1/auth/login', { email: docEmail, password: 'CorrectPassword123!' });
  const token = loginRes.data.accessToken;

  // 1. Doctor static route ordering (ensure /me, /profile, /patients don't trigger GET /:id 400 error)
  const meRes = await request('GET', '/api/v1/doctors/me', null, token);
  assert.strictEqual(meRes.status, 200, 'GET /doctors/me should return 200, not 400 invalid doctor id');

  const profileRes = await request('GET', '/api/v1/doctors/profile', null, token);
  assert.strictEqual(profileRes.status, 200, 'GET /doctors/profile should return 200, not 400 invalid doctor id');

  const patientsRes = await request('GET', '/api/v1/doctors/patients', null, token);
  assert.strictEqual(patientsRes.status, 200, 'GET /doctors/patients should return 200, not 400 invalid doctor id');

  // 2. Empty geo coordinates update (ensure empty coordinates don't cause 500 error)
  const emptyLocRes = await request('PUT', '/api/v1/doctors/me', {
    specialty: 'Neurology',
    location: { type: 'Point', coordinates: [] }
  }, token);
  assert.strictEqual(emptyLocRes.status, 200, 'PUT /doctors/me with empty coordinates should return 200, not 500');
});

test('P1 Quick Wins: Login status code 401 & bcrypt password verification', async () => {
  // 1. Invalid email/password should return 401 Unauthorized
  const badLoginRes = await request('POST', '/api/v1/auth/login', {
    email: 'nonexistent@example.com',
    password: 'WrongPassword!'
  });
  assert.strictEqual(badLoginRes.status, 401, 'Invalid user login should return 401 Unauthorized');

  // 2. Existing user with wrong password should return 401 Unauthorized
  const docEmail = `p1_user_${Date.now()}@example.com`;
  await request('POST', '/api/v1/auth/register', {
    name: 'P1 User',
    email: docEmail,
    username: `p1user_${Date.now()}`,
    password: 'CorrectPassword123!',
    role: 'patient'
  });

  const wrongPassRes = await request('POST', '/api/v1/auth/login', {
    email: docEmail,
    password: 'WrongPassword!'
  });
  assert.strictEqual(wrongPassRes.status, 401, 'Wrong password login should return 401 Unauthorized');

  // 3. Correct password login succeeds with 200
  const correctPassRes = await request('POST', '/api/v1/auth/login', {
    email: docEmail,
    password: 'CorrectPassword123!'
  });
  assert.strictEqual(correctPassRes.status, 200, 'Correct password login should return 200');
});
