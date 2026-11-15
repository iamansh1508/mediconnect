const crypto = require('crypto');
const Razorpay = require('razorpay');
const { createClient } = require('redis');

let razorpayInstance = null;

function getRazorpayInstance() {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured');
    }
    razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpayInstance;
}

/**
 * createPaymentOrder
 * Creates a Razorpay order for an appointment payment.
 */
async function createPaymentOrder(appointmentId, amount, currency) {
  currency = currency || 'INR';
  if (!appointmentId) {
    throw new Error('appointmentId is required');
  }
  if (!amount) {
    throw new Error('amount is required');
  }

  const razorpay = getRazorpayInstance();
  const amountInPaise = Math.round(amount * 100);

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: currency,
      receipt: 'receipt_' + appointmentId,
      payment_capture: 1,
      notes: {
        appointmentId: appointmentId.toString()
      }
    });

    return {
      orderId: order.id,
      amount: order.amount / 100,
      currency: order.currency,
      status: order.status
    };
  } catch (error) {
    throw new Error('Failed to create payment order: ' + error.message);
  }
}

/**
 * verifyPaymentSignature
 * Verifies Razorpay payment signature using HMAC-SHA256.
 * Webhook signature = HMAC-SHA256(webhookSecret, orderId + "|" + paymentId)
 */
async function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) {
    throw new Error('orderId, paymentId and signature are required');
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('Razorpay webhook secret not configured');
  }

  try {
    const payload = orderId + '|' + paymentId;
    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid payment signature — possible tampering');
    }

    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * fetchPaymentDetails
 * Fetches payment details from Razorpay API.
 */
async function fetchPaymentDetails(paymentId) {
  if (!paymentId) {
    throw new Error('paymentId is required');
  }

  const razorpay = getRazorpayInstance();

  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      id: payment.id,
      amount: payment.amount / 100,
      status: payment.status,
      method: payment.method,
      email: payment.email,
      contact: payment.contact
    };
  } catch (error) {
    throw new Error('Failed to fetch payment details: ' + error.message);
  }
}

module.exports = {
  createPaymentOrder,
  verifyPaymentSignature,
  fetchPaymentDetails
};
