const { test, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { io: connect } = require('socket.io-client');
const { start, patient, doctor, todayIST } = require('./helpers');

let app;
before(async () => { app = await start(); });
after(() => app.stop());

// A paid appointment for today, created through the real payment path.
async function paidToday(doc, time) {
  const p = await patient(app.base);
  const appt = await mongoose.model('Appointment').create({ patientId: p.user._id, doctorId: doc.doctor._id, date: todayIST(), time, fee: 500 });
  await p.post('/api/v1/payments/order', { appointmentId: String(appt._id) });
  assert.strictEqual((await p.post('/api/v1/payments/test-pay', { appointmentId: String(appt._id) })).status, 200);
  p.appointmentId = String(appt._id);
  return p;
}

const socketFor = (c) => new Promise((resolve, reject) => {
  const s = connect(app.base, { transports: ['websocket'], extraHeaders: { cookie: `accessToken=${c.jar.get('accessToken')}` } });
  s.on('connect', () => resolve(s));
  s.on('connect_error', reject);
});
const once = (s, event) => new Promise((r) => s.once(event, r));

test('each doctor has their own queue, ordered by slot time', async () => {
  const [docA, docB] = [await doctor(app.base), await doctor(app.base)];
  const late = await paidToday(docA, '23:45');
  const early = await paidToday(docA, '23:30');
  const other = await paidToday(docB, '23:00'); // earlier, but another doctor's patient

  assert.strictEqual((await early.get(`/api/v1/appointments/${early.appointmentId}`)).data.position, 1);
  assert.strictEqual((await late.get(`/api/v1/appointments/${late.appointmentId}`)).data.position, 2);

  const called = await docA.post('/api/v1/doctors/me/queue/next');
  assert.strictEqual(called.data.called._id, early.appointmentId); // not docB's patient
  assert.strictEqual((await late.get(`/api/v1/appointments/${late.appointmentId}`)).data.position, 1);
  assert.strictEqual((await other.get(`/api/v1/appointments/${other.appointmentId}`)).data.position, 1);

  const q = (await docA.get('/api/v1/doctors/me/queue')).data;
  assert.strictEqual(q.current._id, early.appointmentId);
  assert.deepStrictEqual(q.waiting.map((a) => a._id), [late.appointmentId]);
});

test('live updates reach the patient, and nobody can watch someone else\'s queue', async () => {
  const doc = await doctor(app.base);
  const first = await paidToday(doc, '22:00');
  const second = await paidToday(doc, '22:15');
  const stranger = await patient(app.base);

  const strangerSocket = await socketFor(stranger);
  const denied = await strangerSocket.emitWithAck('queue:watch', second.appointmentId);
  assert.ok(denied.error);

  const s1 = await socketFor(first);
  const s2 = await socketFor(second);
  assert.deepStrictEqual((await s2.emitWithAck('queue:watch', second.appointmentId)).order, [first.appointmentId, second.appointmentId]);

  const turn = once(s1, 'queue:called');
  const update = once(s2, 'queue:update');
  await doc.post('/api/v1/doctors/me/queue/next');
  assert.strictEqual((await turn).appointmentId, first.appointmentId);
  assert.deepStrictEqual((await update).order, [second.appointmentId]);

  const { getQueue } = require('../src/shared/notify');
  assert.ok(await getQueue().getJob(`next-${second.appointmentId}`)); // "you're next" SMS queued
  for (const s of [strangerSocket, s1, s2]) s.close();
});

test('the queue rebuilds from MongoDB if Redis loses it', async () => {
  const doc = await doctor(app.base);
  const p = await paidToday(doc, '21:00');
  await require('./helpers').redis.del(`queue:${doc.doctor._id}:${todayIST()}`);
  assert.strictEqual((await p.get(`/api/v1/appointments/${p.appointmentId}`)).data.position, 1);
});

test('paying after Redis lost the queue does not jump the patients already waiting', async () => {
  const doc = await doctor(app.base);
  const waiting = await paidToday(doc, '19:00');
  await require('./helpers').redis.del(`queue:${doc.doctor._id}:${todayIST()}`);
  const newcomer = await paidToday(doc, '19:30');
  assert.strictEqual((await newcomer.get(`/api/v1/appointments/${newcomer.appointmentId}`)).data.position, 2);
  assert.strictEqual((await waiting.get(`/api/v1/appointments/${waiting.appointmentId}`)).data.position, 1);
});

test('prescription, PDF download, and one review per visit', async () => {
  const doc = await doctor(app.base);
  const p = await paidToday(doc, '20:00');
  const rx = await doc.post(`/api/v1/appointments/${p.appointmentId}/prescription`, {
    medicines: [{ name: 'Paracetamol 650', dosage: '1 tablet twice a day', duration: '3 days' }], notes: 'Rest and fluids.',
  });
  assert.strictEqual(rx.status, 201);
  assert.strictEqual(rx.data.appointment.status, 'completed');

  const pdf = await p.get(`/api/v1/appointments/${p.appointmentId}/prescription.pdf`);
  assert.strictEqual(pdf.status, 200);
  assert.strictEqual(pdf.headers.get('content-type'), 'application/pdf');
  assert.strictEqual(pdf.data.subarray(0, 4).toString(), '%PDF');

  assert.strictEqual((await p.post(`/api/v1/appointments/${p.appointmentId}/review`, { rating: 4, comment: 'Kind and quick.' })).status, 201);
  assert.strictEqual((await p.post(`/api/v1/appointments/${p.appointmentId}/review`, { rating: 1 })).status, 400);
  const profile = (await p.get(`/api/v1/doctors/${doc.doctor._id}`)).data;
  assert.strictEqual(profile.doctor.rating, 4);
  assert.strictEqual(profile.reviews[0].comment, 'Kind and quick.');
});
