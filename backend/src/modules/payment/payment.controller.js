const { asyncHandler, AppError } = require('../../shared/utils');
const paymentService = require('./payment.service');
const Appointment = require('../booking/Appointment.model');
const queueService = require('../booking/queue.service');

/**
 * initiatePayment
 * POST /api/v1/payments/initiate
 */
const initiatePayment = asyncHandler(async (req, res) => {
  const appointmentId = req.body.appointmentId;
  const amount = req.body.amount;

  if (!appointmentId || !amount) {
    throw new AppError(400, 'appointmentId and amount are required');
  }

  const order = await paymentService.createPaymentOrder(appointmentId, amount, 'INR');

  return res.status(201).json({
    orderId: order.orderId,
    amount: order.amount,
    currency: order.currency,
    status: order.status
  });
});

/**
 * handleWebhook
 * POST /api/v1/payments/webhook
 */
const handleWebhook = asyncHandler(async (req, res) => {
  const orderId = req.body.order?.id || req.body.payload?.order?.entity?.id;
  const paymentId = req.body.payload?.payment?.entity?.id;
  const signature = req.headers['x-razorpay-signature'];

  if (!orderId || !paymentId || !signature) {
    throw new AppError(400, 'Invalid webhook payload');
  }

  try {
    await paymentService.verifyPaymentSignature(orderId, paymentId, signature);
  } catch (error) {
    throw new AppError(403, 'Invalid webhook signature');
  }

  const appointmentId = req.body.payload?.payment?.entity?.notes?.appointmentId;
  if (!appointmentId) {
    throw new AppError(400, 'appointmentId missing in webhook payload');
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new AppError(404, 'Appointment not found');
  }

  appointment.paymentId = paymentId;
  appointment.paymentStatus = 'successful';
  appointment.status = 'confirmed';
  await appointment.save();

  try {
    await queueService.addToQueue(appointmentId, appointment.date, 1);
  } catch (queueError) {
    console.warn('Queue enqueue failed, continuing:', queueError && queueError.message);
  }

  try {
    const io = req.app.get('io');
    if (io) {
      io.to('patient:' + appointment.patientId.toString()).emit('payment_confirmed', {
        appointmentId: appointmentId,
        paymentId: paymentId
      });
    }
  } catch (socketError) {
    console.warn('Socket emit failed, continuing:', socketError && socketError.message);
  }

  return res.status(200).json({ message: 'Webhook processed' });
});

module.exports = {
  initiatePayment,
  handleWebhook
};
