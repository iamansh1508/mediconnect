// Proves live updates cross API copies: the demo patient listens on copy A while the demo doctor
// presses "Call next" on copy B. Needs seeded data (npm run seed) and two running copies.
// Usage: node scripts/scale-check.js http://localhost:5001 http://localhost:5002
const { io } = require('socket.io-client');

const [A = 'http://localhost:5001', B = 'http://localhost:5002'] = process.argv.slice(2);

async function login(base, email) {
  const r = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) });
  if (!r.ok) throw new Error(`login ${email} on ${base}: ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

(async () => {
  const patient = await login(A, 'patient@mediconnect.demo');
  const doctor = await login(B, 'doctor@mediconnect.demo');
  const appts = await (await fetch(`${A}/api/v1/appointments/my`, { headers: { cookie: patient } })).json();
  const mine = appts.appointments.find((a) => a.status === 'confirmed' && !a.calledAt);
  if (!mine) throw new Error('The demo patient has no waiting appointment. Run npm run seed first.');

  const socket = io(A, { transports: ['websocket'], extraHeaders: { cookie: patient } });
  await new Promise((resolve, reject) => { socket.on('connect', resolve); socket.on('connect_error', reject); });
  const before = await socket.emitWithAck('queue:watch', mine._id);
  console.log(`Patient on ${A}: position ${before.order.indexOf(mine._id) + 1} of ${before.order.length}`);

  const update = new Promise((resolve, reject) => {
    socket.once('queue:update', resolve);
    setTimeout(() => reject(new Error('No update reached copy A within 5 s')), 5000);
  });
  const r = await fetch(`${B}/api/v1/doctors/me/queue/next`, { method: 'POST', headers: { cookie: doctor } });
  console.log(`Doctor pressed "Call next" on ${B} (served by ${r.headers.get('x-served-by')}, HTTP ${r.status})`);
  const { order } = await update;
  console.log(`Patient on ${A} received the update: now position ${order.indexOf(mine._id) + 1} of ${order.length}`);
  socket.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
