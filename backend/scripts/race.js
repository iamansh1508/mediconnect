// Fires N simultaneous bookings for ONE slot at a running API (or at nginx in front of several copies),
// then counts what landed in MongoDB. Usage: node scripts/race.js [N=100] [BASE_URL=http://localhost:5000]
require('../src/env');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../src/modules/auth/User.model');
const Doctor = require('../src/modules/doctor/Doctor.model');
const Appointment = require('../src/modules/booking/Appointment.model');
const { todayIST } = require('../src/shared/http');

const N = Number(process.argv[2]) || 100;
const BASE = process.argv[3] || 'http://localhost:5000';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const run = Date.now();
  const date = new Date(Date.parse(todayIST()) + 2 * 86400e3).toISOString().slice(0, 10);
  const docUser = await User.create({ name: 'Race Doctor', email: `race-doc-${run}@test.local`, role: 'doctor' });
  const doctor = await Doctor.create({ userId: docUser._id, name: 'Race Doctor', status: 'approved', consultationFee: 500, schedule: [{ date, slots: ['10:00'] }] });
  const patients = await User.insertMany(Array.from({ length: N }, (_, i) => ({ name: `Racer ${i}`, email: `race-${run}-${i}@test.local`, phone: '9876543210' })));
  // Signed in directly with the server's secret, so the login rate limit doesn't get in the way of the test.
  const cookies = patients.map((p) => `accessToken=${jwt.sign({ sub: p.id, tv: 0 }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: 300 })}`);

  const t0 = performance.now();
  const results = await Promise.all(cookies.map((cookie) => fetch(`${BASE}/api/v1/appointments`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ doctorId: doctor.id, date, time: '10:00' }),
  }).then((r) => ({ status: r.status, by: r.headers.get('x-served-by') }))));
  const ms = Math.round(performance.now() - t0);

  const tally = (key) => results.reduce((m, r) => ({ ...m, [r[key]]: (m[r[key]] || 0) + 1 }), {});
  const rows = await Appointment.countDocuments({ doctorId: doctor._id, date, time: '10:00' });
  console.log(`${N} simultaneous bookings for one slot, ${ms} ms`);
  console.log('HTTP status:', tally('status'));
  console.log('Served by:', tally('by'));
  console.log(`Appointments in MongoDB for that slot: ${rows}`);

  await Promise.all([Appointment.deleteMany({ doctorId: doctor._id }), Doctor.deleteOne({ _id: doctor._id }), User.deleteMany({ _id: { $in: [docUser._id, ...patients.map((p) => p._id)] } })]);
  await mongoose.disconnect();
  process.exit(rows === 1 && tally('status')[201] === 1 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
