const express = require('express');
const { z } = require('zod');
const Appointment = require('../booking/Appointment.model');
const gateway = require('./razorpay');
const { markPaid, isExpiredHold } = require('../booking/booking.service');
const { AppError, objectId, validate } = require('../../shared/http');
const { requireUser, requireRole } = require('../../shared/auth');
const log = require('../../shared/log');

const router = express.Router();

// Server-to-server from Razorpay, and the source of truth: it still arrives if the patient closed
// the tab before checkout finished. Needs the raw body, so app.js mounts it before express.json().
const webhook = express.Router();
webhook.post('/api/v1/payments/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  if (!gateway.webhookSignatureOk(req.body, req.get('x-razorpay-signature'))) throw new AppError(400, 'Invalid signature.');
  const event = JSON.parse(req.body);
  const payment = event.payload?.payment?.entity;
  if (['payment.captured', 'order.paid'].includes(event.event) && payment) await markPaid(payment.order_id, payment.id, req.id);
  else log.info('webhook ignored', { event: event.event, id: req.id });
  res.json({ ok: true });
});

router.post('/payments/order', requireRole('patient'), validate(z.object({ appointmentId: objectId })), async (req, res) => {
  const appt = await Appointment.findOne({ _id: req.valid.appointmentId, patientId: req.user._id });
  if (!appt) throw new AppError(404, 'Appointment not found.');
  if (appt.status !== 'booked' || appt.paymentStatus !== 'pending') throw new AppError(409, 'This appointment is already paid or cancelled.');
  if (isExpiredHold(appt)) throw new AppError(410, 'Your 15-minute hold on this slot ran out. Book again.');

  // One order per appointment: a retried or double-clicked request gets the same order back,
  // so a patient can never be charged twice. The amount always comes from the database.
  if (!appt.orderId) {
    const order = await gateway.createOrder(appt.fee, String(appt._id));
    const won = await Appointment.findOneAndUpdate({ _id: appt._id, orderId: null }, { orderId: order.id }, { returnDocument: 'after' });
    appt.orderId = won ? won.orderId : (await Appointment.findById(appt._id)).orderId;
  }
  res.json({ orderId: appt.orderId, amount: appt.fee * 100, currency: 'INR', keyId: gateway.keyId(), testMode: gateway.testMode() });
});

// Razorpay Checkout's success callback. Lets the screen update at once; the webhook confirms it anyway.
router.post('/payments/verify', requireUser, validate(z.object({
  razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string(),
})), async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.valid;
  if (!gateway.checkoutSignatureOk(orderId, paymentId, signature)) throw new AppError(400, 'We could not verify this payment.');
  res.json({ appointment: await markPaid(orderId, paymentId, req.id) });
});

// Test mode only: stands in for Razorpay so the app works end to end without keys.
router.post('/payments/test-pay', requireRole('patient'), validate(z.object({ appointmentId: objectId })), async (req, res) => {
  if (!gateway.testMode()) throw new AppError(404, 'Not found.');
  const appt = await Appointment.findOne({ _id: req.valid.appointmentId, patientId: req.user._id });
  if (!appt?.orderId) throw new AppError(400, 'Create the order first.');
  res.json({ appointment: await markPaid(appt.orderId, `pay_test_${Date.now()}`, req.id) });
});

module.exports = router;
module.exports.webhook = webhook;
