// Minimal Razorpay client wrapper (env-gated)
// Exports: createOrder({amount, currency, receipt}), verifyWebhook(req)
const crypto = require('crypto');
let instance = null;
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

if (keyId && keySecret) {
  try {
    const Razorpay = require('razorpay');
    instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  } catch (e) {
    console.warn('Razorpay SDK not installed or failed to load:', e && e.message);
    instance = null;
  }
}

async function createOrder({ amount, currency = 'INR', receipt = 'receipt_' + Date.now() }) {
  if (!instance) throw new Error('Razorpay not configured');
  // amount in INR -> paise
  const amt = Math.round(amount * 100);
  return instance.orders.create({ amount: amt, currency, receipt, payment_capture: 1 });
}

function verifyWebhook(req) {
  if (!webhookSecret) throw new Error('Webhook secret not configured');
  const signature = req.headers['x-razorpay-signature'];
  const body = req.rawBody || JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
  return signature === expected;
}

function isConfigured() {
  return !!instance;
}

module.exports = { createOrder, verifyWebhook, isConfigured };
