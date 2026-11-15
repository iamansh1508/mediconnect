const axios = require('axios');

const BASE = process.env.TEST_SERVER_URL || 'http://localhost:5100';

function mergeCookies(oldCookies, setCookieHeaders) {
  const jar = new Map(oldCookies || []);
  if (!setCookieHeaders) return jar;
  for (const sc of setCookieHeaders) {
    const parts = sc.split(';')[0];
    const [k, v] = parts.split('=');
    jar.set(k.trim(), v.trim());
  }
  return jar;
}

function cookieHeader(jar) {
  if (!jar || jar.size === 0) return undefined;
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function req(method, path, body, jar) {
  const headers = {};
  const cookie = cookieHeader(jar);
  if (cookie) headers['Cookie'] = cookie;
  try {
    const resp = await axios({ method, url: BASE + path, data: body, headers, validateStatus: null });
    const setCookie = resp.headers['set-cookie'];
    const newJar = mergeCookies(jar, setCookie);
    return { status: resp.status, data: resp.data, jar: newJar, headers: resp.headers };
  } catch (err) {
    throw err;
  }
}

async function ensureServerRunning() {
  try {
    await axios.get(BASE + '/api/v1/doctors');
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.log('Starting in-memory test server on port 5100...');
      const mongoose = require('mongoose');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
      const app = require('../src/app');
      await new Promise((resolve) => app.listen(5100, resolve));
    }
  }
}

async function run() {
  await ensureServerRunning();
  console.log('Smoke test starting against', BASE);

  // 1) Create doctor user
  const doctorEmail = `smoke-doctor+${Date.now()}@example.com`;
  const doctorReg = await req('post', '/api/v1/auth/register', { name: 'Smoke Doctor', email: doctorEmail, username: `smoke_doc_${Date.now()}`, password: 'TempPass123!', role: 'doctor' });
  if (doctorReg.status !== 201) return fail('doctor register failed', doctorReg);
  console.log('doctor registered');

  // 2) Login doctor
  let r = await req('post', '/api/v1/auth/login', { email: doctorEmail, password: 'TempPass123!' });
  if (r.status !== 200) return fail('doctor login failed', r);
  let doctorJar = r.jar;
  console.log('doctor logged in');

  // 3) Create doctor profile
  const docProfile = await req('put', '/api/v1/doctors/me', { specialty: 'Test', consultationFee: 200, location: { type: 'Point', coordinates: [77.5946, 12.9716] } }, doctorJar);
  if (docProfile.status !== 200) return fail('doctor profile create failed', docProfile);
  const doctorId = docProfile.data?.doctor?._id || docProfile.data?.doctor?._id || (docProfile.data && docProfile.data._id) || (docProfile.data && docProfile.data.doctor && docProfile.data.doctor._id);
  if (!doctorId) return fail('doctor id not returned', docProfile);
  console.log('doctor profile created id=', doctorId);

  // 4) Create patient user
  const patientEmail = `smoke-patient+${Date.now()}@example.com`;
  const patientReg = await req('post', '/api/v1/auth/register', { name: 'Smoke Patient', email: patientEmail, username: `smoke_patient_${Date.now()}`, password: 'TempPass123!', role: 'patient' });
  if (patientReg.status !== 201) return fail('patient register failed', patientReg);
  console.log('patient registered');

  // 5) Login patient
  r = await req('post', '/api/v1/auth/login', { email: patientEmail, password: 'TempPass123!' });
  if (r.status !== 200) return fail('patient login failed', r);
  let patientJar = r.jar;
  console.log('patient logged in');

  // 6) Book appointment for tomorrow
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const isoDate = date.toISOString();
  const booking = await req('post', '/api/v1/appointments/book', { doctorId, date: isoDate, timeSlot: '09:00-09:30' }, patientJar);
  if (booking.status !== 201) return fail('booking failed', booking);
  console.log('appointment booked id=', booking.data.appointment && booking.data.appointment._id);

  console.log('Smoke test succeeded');
  process.exit(0);
}

function fail(reason, resp) {
  console.error('Smoke test failed:', reason, resp && resp.status, resp && resp.data);
  process.exit(2);
}

run().catch((e) => { console.error('Smoke test error', e && e.message); process.exit(3); });
