const { test, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { start, client, patient, doctor, tomorrow } = require('./helpers');

let app;
before(async () => { app = await start(); });
after(() => app.stop());

test('50 patients booking the same slot at once: exactly one gets it', async () => {
  const doc = await doctor(app.base);
  const patients = await Promise.all(Array.from({ length: 50 }, () => patient(app.base)));
  const body = { doctorId: String(doc.doctor._id), date: tomorrow(), time: '09:00' };
  const results = await Promise.all(patients.map((p) => p.post('/api/v1/appointments', body)));
  const codes = results.map((r) => r.status);
  assert.strictEqual(codes.filter((s) => s === 201).length, 1, `got ${codes}`);
  assert.strictEqual(codes.filter((s) => s === 409).length, 49);
  assert.strictEqual(await mongoose.model('Appointment').countDocuments({ doctorId: doc.doctor._id, date: body.date, time: '09:00' }), 1);
});

test('the database blocks a duplicate even if the lock is bypassed', async () => {
  const Appointment = mongoose.model('Appointment');
  const row = { patientId: new mongoose.Types.ObjectId(), doctorId: new mongoose.Types.ObjectId(), date: '2030-01-01', time: '10:00', fee: 1 };
  await Appointment.create(row);
  await assert.rejects(Appointment.create({ ...row, patientId: new mongoose.Types.ObjectId() }), { code: 11000 });
});

test('a cancelled slot can be booked again, and the slot list reflects it', async () => {
  const doc = await doctor(app.base);
  const [a, b] = [await patient(app.base), await patient(app.base)];
  const body = { doctorId: String(doc.doctor._id), date: tomorrow(), time: '09:15' };
  const slots = () => client(app.base).get(`/api/v1/doctors/${body.doctorId}/slots?date=${body.date}`); // public, no login

  const first = await a.post('/api/v1/appointments', body);
  assert.strictEqual(first.status, 201);
  assert.ok(!(await slots()).data.slots.includes('09:15'));
  assert.strictEqual((await b.post('/api/v1/appointments', body)).status, 409);

  assert.strictEqual((await a.del(`/api/v1/appointments/${first.data.appointment._id}`)).status, 200);
  assert.ok((await slots()).data.slots.includes('09:15'));
  assert.strictEqual((await b.post('/api/v1/appointments', body)).status, 201);
});

test('an unpaid booking holds the slot for 15 minutes only', async () => {
  const doc = await doctor(app.base);
  const [a, b] = [await patient(app.base), await patient(app.base)];
  const body = { doctorId: String(doc.doctor._id), date: tomorrow(), time: '09:30' };
  const held = (await a.post('/api/v1/appointments', body)).data.appointment;

  await mongoose.model('Appointment').collection.updateOne({ _id: new mongoose.Types.ObjectId(held._id) }, { $set: { createdAt: new Date(Date.now() - 16 * 60e3) } });
  assert.strictEqual((await b.post('/api/v1/appointments', body)).status, 201);
  assert.strictEqual((await a.post('/api/v1/payments/order', { appointmentId: held._id })).status, 409); // its hold was released
});

test('you cannot book outside the doctor\'s hours or with an unapproved doctor', async () => {
  const doc = await doctor(app.base);
  const p = await patient(app.base);
  assert.strictEqual((await p.post('/api/v1/appointments', { doctorId: String(doc.doctor._id), date: tomorrow(), time: '18:00' })).status, 400);
  await mongoose.model('Doctor').updateOne({ _id: doc.doctor._id }, { status: 'pending' });
  assert.strictEqual((await p.post('/api/v1/appointments', { doctorId: String(doc.doctor._id), date: tomorrow(), time: '09:00' })).status, 404);
  assert.strictEqual((await client(app.base).get(`/api/v1/doctors/${doc.doctor._id}`)).status, 404);
});

test('search finds approved doctors near a point, with distance, and pages by cursor', async () => {
  const r = await client(app.base).get('/api/v1/doctors?lat=12.97&lng=77.6&radiusKm=5&limit=2');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.doctors.length, 2);
  assert.ok(r.data.doctors.every((d) => typeof d.distanceKm === 'number' && d.distanceKm < 5));
  assert.ok(r.data.nextCursor);
  const next = await client(app.base).get(`/api/v1/doctors?lat=12.97&lng=77.6&radiusKm=5&limit=2&cursor=${r.data.nextCursor}`);
  const seen = new Set(r.data.doctors.map((d) => d._id));
  assert.ok(next.data.doctors.length && next.data.doctors.every((d) => !seen.has(d._id))); // test doctors share one spot: ties page by _id
  const km = [...r.data.doctors, ...next.data.doctors].map((d) => d.distanceKm);
  assert.deepStrictEqual(km, [...km].sort((a, b) => a - b)); // nearest-first across pages, not just within one
  assert.strictEqual((await client(app.base).get('/api/v1/doctors?lat=28.6&lng=77.2&radiusKm=5')).data.doctors.length, 0); // Delhi
});
