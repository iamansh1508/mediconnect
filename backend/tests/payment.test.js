const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { start, patient, doctor, tomorrow, redis } = require('./helpers');

let app;
before(async () => { app = await start(); });
after(() => app.stop());

const hmac = (secret, s) => crypto.createHmac('sha256', secret).update(s).digest('hex');

async function booked(time, fee = 700) {
  const doc = await doctor(app.base, fee);
  const p = await patient(app.base);
  const appt = (await p.post('/api/v1/appointments', { doctorId: String(doc.doctor._id), date: tomorrow(), time })).data.appointment;
  return { doc, p, appt };
}

test('the price comes from the server, and retries reuse one order', async () => {
  const { p, appt } = await booked('09:00', 700);
  const orders = await Promise.all(Array.from({ length: 5 }, () => p.post('/api/v1/payments/order', { appointmentId: appt._id, amount: 1 })));
  assert.ok(orders.every((o) => o.status === 200));
  assert.strictEqual(new Set(orders.map((o) => o.data.orderId)).size, 1);
  assert.strictEqual(orders[0].data.amount, 70000); // paise, from the doctor's fee, ignoring "amount: 1"
});

test('someone else cannot pay for or see your appointment', async () => {
  const { appt } = await booked('09:15');
  const other = await patient(app.base);
  assert.strictEqual((await other.post('/api/v1/payments/order', { appointmentId: appt._id })).status, 404);
  assert.strictEqual((await other.get(`/api/v1/appointments/${appt._id}`)).status, 404);
});

test('a forged webhook is rejected; a signed one confirms the booking exactly once', async () => {
  const { p, doc, appt } = await booked('09:30');
  const { orderId } = (await p.post('/api/v1/payments/order', { appointmentId: appt._id })).data;
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_abc', order_id: orderId } } } });

  const forged = await fetch(`${app.base}/api/v1/payments/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': hmac('wrong', body) }, body });
  assert.strictEqual(forged.status, 400);
  assert.strictEqual((await p.get(`/api/v1/appointments/${appt._id}`)).data.appointment.paymentStatus, 'pending');

  for (let i = 0; i < 2; i += 1) { // Razorpay retries webhooks; the second delivery must change nothing
    const ok = await fetch(`${app.base}/api/v1/payments/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': hmac('test-webhook-secret', body) }, body });
    assert.strictEqual(ok.status, 200);
  }
  const after = (await p.get(`/api/v1/appointments/${appt._id}`)).data;
  assert.strictEqual(after.appointment.status, 'confirmed');
  assert.strictEqual(after.appointment.paymentStatus, 'paid');
  assert.strictEqual(after.position, 1);
  assert.strictEqual(await redis.zcard(`queue:${doc.doctor._id}:${tomorrow()}`), 1);
  // The confirmation SMS is queued once.
  const { getQueue } = require('../src/shared/notify');
  assert.ok(await getQueue().getJob(`confirmed-${appt._id}`));
});

test('checkout verify needs Razorpay\'s signature', async () => {
  const { p, appt } = await booked('09:45');
  const { orderId } = (await p.post('/api/v1/payments/order', { appointmentId: appt._id })).data;
  const bad = await p.post('/api/v1/payments/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_x', razorpay_signature: 'f'.repeat(64) });
  assert.strictEqual(bad.status, 400);
  const good = await p.post('/api/v1/payments/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_x', razorpay_signature: hmac('test-key-secret', `${orderId}|pay_x`) });
  assert.strictEqual(good.status, 200);
  assert.strictEqual(good.data.appointment.status, 'confirmed');
});

test('cancelling a paid booking refunds it and frees the queue spot', async () => {
  const { p, doc, appt } = await booked('09:00');
  await p.post('/api/v1/payments/order', { appointmentId: appt._id });
  await p.post('/api/v1/payments/test-pay', { appointmentId: appt._id });
  const r = await p.del(`/api/v1/appointments/${appt._id}`);
  assert.strictEqual(r.data.appointment.paymentStatus, 'refunded');
  assert.strictEqual(await redis.zcard(`queue:${doc.doctor._id}:${tomorrow()}`), 0);
});

test('paying after the hold expired and the slot was re-sold gets refunded, not double-booked', async () => {
  const { doc, p, appt } = await booked('09:15');
  const { orderId } = (await p.post('/api/v1/payments/order', { appointmentId: appt._id })).data;
  await mongoose.model('Appointment').collection.updateOne({ _id: new mongoose.Types.ObjectId(appt._id) }, { $set: { createdAt: new Date(Date.now() - 16 * 60e3) } });
  const rival = await patient(app.base);
  assert.strictEqual((await rival.post('/api/v1/appointments', { doctorId: String(doc.doctor._id), date: tomorrow(), time: '09:15' })).status, 201);

  await p.post('/api/v1/payments/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_late', razorpay_signature: hmac('test-key-secret', `${orderId}|pay_late`) });
  const late = await mongoose.model('Appointment').findById(appt._id);
  assert.strictEqual(late.status, 'cancelled');
  assert.strictEqual(late.paymentStatus, 'refunded');
});
