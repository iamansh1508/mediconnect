const { Queue } = require('bullmq');
const log = require('./log');

// BullMQ brings its own Redis client (ioredis), which takes options rather than a URL.
function connection() {
  const u = new URL(process.env.REDIS_URL);
  return {
    host: u.hostname, port: Number(u.port) || 6379,
    username: u.username || undefined, password: decodeURIComponent(u.password) || undefined,
    db: Number(u.pathname.slice(1)) || 0,
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

let queue;
const getQueue = () => (queue ??= new Queue('notifications', { connection: connection() }));

// Queues one SMS ({ phone, text }) or email ({ email, subject, text }) and returns straight away.
// The worker sends it with 5 tries; jobs that still fail stay in the failed set for an admin to retry.
// jobId makes repeats harmless: the same event for the same appointment is queued once.
async function notify(name, data, { jobId, requestId } = {}) {
  if (!data.phone && !data.email) return;
  try {
    await getQueue().add(name, { ...data, requestId }, {
      jobId, attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: false,
    });
  } catch (e) {
    // A notification must never fail the booking or payment that triggered it.
    log.error('could not queue notification', { name, err: e.message, requestId });
  }
}

async function sendSms(phone, text) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
  if (!sid) return log.info('sms (test mode, not sent)', { to: phone, text });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
    body: new URLSearchParams({ To: `+91${phone}`, From: from, Body: text }),
  });
  if (!r.ok) throw new Error(`Twilio ${r.status}: ${await r.text()}`);
}

let mailer;
async function sendEmail(to, subject, text) {
  if (!process.env.SMTP_URL) return log.info('email (test mode, not sent)', { to, subject, text });
  mailer ??= require('nodemailer').createTransport(process.env.SMTP_URL);
  await mailer.sendMail({ from: process.env.MAIL_FROM || 'MediConnect <no-reply@mediconnect.app>', to, subject, text });
}

async function deliver(job) {
  const { phone, email, subject, text, requestId } = job.data;
  if (phone) await sendSms(phone, text);
  else await sendEmail(email, subject, text);
  log.info('notification sent', { name: job.name, id: job.id, attempt: job.attemptsMade + 1, requestId });
}

module.exports = { notify, deliver, connection, getQueue };
