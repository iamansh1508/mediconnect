// Razorpay over plain HTTPS (two endpoints don't need the SDK). With no RAZORPAY_KEY_ID set the app
// runs in test mode: orders are made up locally and the "Pay" button marks the booking paid.
const crypto = require('crypto');

const env = () => ({ id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET, webhook: process.env.RAZORPAY_WEBHOOK_SECRET });
const testMode = () => !env().id;

async function api(path, body) {
  const { id, secret } = env();
  const r = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Razorpay ${path} failed: ${data.error?.description || r.status}`);
  return data;
}

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const sameHex = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

module.exports = {
  testMode,
  keyId: () => env().id,
  createOrder: (rupees, receipt) => (testMode()
    ? { id: `order_test_${crypto.randomBytes(7).toString('hex')}` }
    : api('/orders', { amount: rupees * 100, currency: 'INR', receipt })),
  refund: (paymentId) => (testMode() || paymentId.startsWith('pay_test_') ? null : api(`/payments/${paymentId}/refund`, {})),
  // Checkout returns HMAC(key secret, "order_id|payment_id"); the browser can't forge it without the secret.
  checkoutSignatureOk: (orderId, paymentId, signature) => !!env().secret && sameHex(hmac(env().secret, `${orderId}|${paymentId}`), signature),
  // Webhooks are signed over the exact raw body with the separate webhook secret.
  webhookSignatureOk: (rawBody, signature) => !!env().webhook && sameHex(hmac(env().webhook, rawBody), signature),
};
