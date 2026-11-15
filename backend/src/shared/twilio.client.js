// Minimal Twilio client wrapper — dev-safe and env-gated
// Exports: sendSms(to, body) and isConfigured()
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM;
let client = null;

if (accountSid && authToken) {
  try {
    const Twilio = require('twilio');
    client = new Twilio(accountSid, authToken);
  } catch (e) {
    console.warn('Twilio SDK not installed or failed to load:', e && e.message);
    client = null;
  }
}

async function sendSms(to, body) {
  if (!client) throw new Error('Twilio not configured');
  if (!fromNumber) throw new Error('TWILIO_FROM not set');
  return client.messages.create({ from: fromNumber, to, body });
}

function isConfigured() {
  return !!client && !!fromNumber;
}

module.exports = { sendSms, isConfigured };
