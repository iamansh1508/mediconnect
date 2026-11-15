const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const mongoose = require('mongoose');

const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');

let server;
let mongod;
let PORT = 5001;

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request(`http://localhost:${PORT}${path}`, {
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
          resolve({
            status: res.statusCode,
            data: bodyData ? JSON.parse(bodyData) : null
          });
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
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const maxPort = 5050;
  while (PORT <= maxPort) {
    try {
      server = http.createServer(app);
      await new Promise((resolve, reject) => {
        server.listen(PORT, '127.0.0.1', (err) => {
          if (err) {
            server.close();
            reject(err);
          } else {
            resolve();
          }
        });
      });
      console.log(`Test server listening on port ${PORT}`);
      break;
    } catch (e) {
      server = null;
      PORT = PORT + 1;
    }
  }
  
  if (!server) {
    throw new Error('Could not start booking integration test server');
  }
});

after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
    server = null;
  }
  try {
    await mongoose.disconnect();
  } catch (e) {
    // ignore disconnect errors
  }
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await Promise.all(
    mongoose.modelNames().map((name) => mongoose.model(name).deleteMany({}))
  );

  // Clear Redis locks and queues between tests for clean state
  try {
    const redisConfig = require('../../src/shared/config/redis');
    if (redisConfig && redisConfig.clearFallbackStores) {
      redisConfig.clearFallbackStores();
    }
    if (redisConfig && redisConfig.client) {
      // Find and delete all booking-related keys
      for await (const key of redisConfig.client.scanIterator({ MATCH: 'booking:*', COUNT: 100 })) {
        await redisConfig.client.del(key);
      }
      for await (const key of redisConfig.client.scanIterator({ MATCH: 'lock:*', COUNT: 100 })) {
        await redisConfig.client.del(key);
      }
      for await (const key of redisConfig.client.scanIterator({ MATCH: 'queue:*', COUNT: 100 })) {
        await redisConfig.client.del(key);
      }
      for await (const key of redisConfig.client.scanIterator({ MATCH: 'otp:*', COUNT: 100 })) {
        await redisConfig.client.del(key);
      }
    }
  } catch (e) {
    // Ignore Redis cleanup errors
    console.warn('Redis cleanup failed:', e && e.message);
  }
});

async function createBookingUsers() {
  const doctorRes = await request('POST', '/api/v1/auth/register', {
    name: 'Test Doctor',
    email: 'doctor@example.com',
    username: 'testdoctor',
    password: 'Password123!',
    role: 'doctor'
  });
  assert.strictEqual(doctorRes.status, 201, JSON.stringify(doctorRes.data));

  // Login as doctor
  const doctorLogin = await request('POST', '/api/v1/auth/login', {
    email: 'doctor@example.com',
    password: 'Password123!'
  });
  assert.strictEqual(doctorLogin.status, 200, JSON.stringify(doctorLogin.data));
  const doctorToken = doctorLogin.data.accessToken;

  // Create doctor profile
  const profileRes = await request('PUT', '/api/v1/doctors/me', {
    specialty: 'Cardiology',
    consultationFee: 500
  }, doctorToken);
  assert.strictEqual(profileRes.status, 200, JSON.stringify(profileRes.data));

  // Create test patient
  const patientRes = await request('POST', '/api/v1/auth/register', {
    name: 'Test Patient',
    email: 'patient@example.com',
    username: 'testpatient',
    password: 'Password123!',
    role: 'patient'
  });
  assert.strictEqual(patientRes.status, 201, JSON.stringify(patientRes.data));

  // Login as patient
  const patientLogin = await request('POST', '/api/v1/auth/login', {
    email: 'patient@example.com',
    password: 'Password123!'
  });
  assert.strictEqual(patientLogin.status, 200, JSON.stringify(patientLogin.data));
  const patientToken = patientLogin.data.accessToken;

  return { doctorId: profileRes.data.doctor._id, patientToken };
}

test('Booking API - should book appointment successfully', async () => {
  const { doctorId, patientToken } = await createBookingUsers();

  // Book appointment
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 1);
  const bookingRes = await request('POST', '/api/v1/appointments/book', {
    doctorId,
    date: bookingDate.toISOString(),
    timeSlot: '10:00-10:30'
  }, patientToken);

  assert.strictEqual(
    bookingRes.status,
    201,
    `Booking failed with ${bookingRes.status}: ${JSON.stringify(bookingRes.data)}`
  );
  assert.ok(bookingRes.data.appointmentId, 'Appointment ID should be present');
  assert.ok(bookingRes.data.appointment.date, 'Legacy appointment date should be present');
  assert.strictEqual(bookingRes.data.appointment.timeSlot, '10:00-10:30');
  assert.ok(bookingRes.data.appointment.appointmentDate, 'Canonical appointment date should be present');
  assert.strictEqual(bookingRes.data.appointment.slotStartTime, '10:00');
  assert.strictEqual(bookingRes.data.appointment.slotEndTime, '10:30');
});

test('Booking API - should prevent double-booking', async () => {
  const { doctorId, patientToken } = await createBookingUsers();

  // Book same slot twice
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 2);
  const bookingData = {
    doctorId,
    date: bookingDate.toISOString(),
    timeSlot: '11:00-11:30'
  };

  // First booking should succeed
  const firstBooking = await request('POST', '/api/v1/appointments/book', bookingData, patientToken);
  assert.strictEqual(firstBooking.status, 201);

  // Second booking should fail with 409
  const secondBooking = await request('POST', '/api/v1/appointments/book', bookingData, patientToken);
  assert.strictEqual(secondBooking.status, 409);
});
