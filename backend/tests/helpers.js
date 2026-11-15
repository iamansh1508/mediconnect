// Starts the real app (in-memory MongoDB, local Redis DB 15) on a random port.
process.env.NODE_ENV = 'test';
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
process.env.RAZORPAY_KEY_SECRET = 'test-key-secret'; // no KEY_ID: orders are local, signatures still checked
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/15';
process.env.AUTH_RATE_LIMIT = '100000';

const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const redis = require('../src/shared/redis');
const socket = require('../src/shared/socket');
const { getQueue } = require('../src/shared/notify');
const { todayIST } = require('../src/shared/http');

async function start() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await redis.connect();
  await redis.flushDb();
  const app = require('../src/app');
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init())); // wait for unique indexes
  const server = http.createServer(app);
  await socket.attach(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    async stop() {
      await socket.close();
      await new Promise((r) => server.close(r));
      await getQueue().close();
      await redis.quit();
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}

// fetch with a cookie jar, like a browser tab.
function client(base) {
  const jar = new Map();
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [k, v] = c.split(';')[0].split('=');
      if (v) jar.set(k, v); else jar.delete(k);
    }
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  };
  return {
    jar,
    get: (p) => call('GET', p),
    post: (p, b = {}, h) => call('POST', p, b, h),
    put: (p, b) => call('PUT', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p) => call('DELETE', p),
  };
}

let n = 0;
async function patient(base) {
  const c = client(base);
  n += 1;
  const r = await c.post('/api/v1/auth/register', { name: `Patient ${n}`, email: `p${n}-${Date.now()}@test.in`, phone: '9876543210', password: 'password123' });
  if (r.status !== 201) throw new Error(JSON.stringify(r.data));
  c.user = r.data.user;
  return c;
}

const tomorrow = () => new Date(Date.parse(todayIST()) + 86400e3).toISOString().slice(0, 10);

// An approved doctor with hours tomorrow 09:00-10:00 (four 15-minute slots).
async function doctor(base, fee = 500) {
  const c = client(base);
  n += 1;
  const r = await c.post('/api/v1/auth/register', { name: `Doctor ${n}`, email: `d${n}-${Date.now()}@test.in`, phone: '9876543211', password: 'password123', role: 'doctor', specialty: 'Cardiology' });
  if (r.status !== 201) throw new Error(JSON.stringify(r.data));
  c.user = r.data.user;
  await c.put('/api/v1/doctors/me', { consultationFee: fee, location: { lat: 12.97, lng: 77.59 }, clinicName: 'Test Clinic' });
  await c.put('/api/v1/doctors/me/schedule', { date: tomorrow(), from: '09:00', to: '10:00' });
  const Doctor = mongoose.model('Doctor');
  await Doctor.updateOne({ userId: c.user._id }, { status: 'approved' });
  c.doctor = (await Doctor.findOne({ userId: c.user._id })).toObject();
  return c;
}

module.exports = { start, client, patient, doctor, tomorrow, todayIST, redis };
