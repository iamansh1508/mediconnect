const { test, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { start, client, patient, redis } = require('./helpers');

let app;
before(async () => { app = await start(); });
after(() => app.stop());

test('nobody can sign up as an admin', async () => {
  const r = await client(app.base).post('/api/v1/auth/register', { name: 'Mallory', email: 'm@test.in', phone: '9876543210', password: 'password123', role: 'admin' });
  assert.strictEqual(r.status, 400);
});

test('register logs you in with httpOnly cookies and never returns secrets', async () => {
  const c = client(app.base);
  const r = await c.post('/api/v1/auth/register', { name: 'Asha', email: 'asha@test.in', phone: '9876543210', password: 'password123' });
  assert.strictEqual(r.status, 201);
  assert.ok(c.jar.get('accessToken') && c.jar.get('refreshToken'));
  assert.strictEqual(r.data.accessToken, undefined);
  assert.strictEqual(r.data.user.password, undefined);
  assert.strictEqual((await c.get('/api/v1/auth/me')).data.user.email, 'asha@test.in');
  assert.strictEqual((await client(app.base).post('/api/v1/auth/login', { email: 'asha@test.in', password: 'nope-nope' })).status, 401);
});

test('a refresh token works once; replaying it later signs out every session', async () => {
  const c = await patient(app.base);
  const stolen = c.jar.get('refreshToken');
  assert.strictEqual((await c.post('/api/v1/auth/refresh')).status, 200);
  assert.notStrictEqual(c.jar.get('refreshToken'), stolen);

  // Pretend a minute has passed, so this is outside the two-tabs grace window.
  const { jti } = jwt.decode(stolen);
  await redis.expire(`used_jti:${jti}`, 7 * 24 * 3600 - 60);

  const attacker = client(app.base);
  attacker.jar.set('refreshToken', stolen);
  assert.strictEqual((await attacker.post('/api/v1/auth/refresh')).status, 401);
  // The real user's fresh tokens die too: the whole token family is revoked.
  assert.strictEqual((await c.get('/api/v1/auth/me')).status, 401);
  assert.strictEqual((await c.post('/api/v1/auth/refresh')).status, 401);
});

test('banning a user ends their session at once and blocks login', async () => {
  const c = await patient(app.base);
  const User = require('mongoose').model('User');
  await User.updateOne({ _id: c.user._id }, { isActive: false, $inc: { tokenVersion: 1 } });
  assert.strictEqual((await c.get('/api/v1/auth/me')).status, 401);
  assert.strictEqual((await client(app.base).post('/api/v1/auth/login', { email: c.user.email, password: 'password123' })).status, 403);
});

test('password reset: link works once and signs out old sessions', async () => {
  const c = await patient(app.base);
  const User = require('mongoose').model('User');
  const crypto = require('crypto');
  assert.strictEqual((await client(app.base).post('/api/v1/auth/forgot-password', { email: 'nobody@test.in' })).status, 200);
  await client(app.base).post('/api/v1/auth/forgot-password', { email: c.user.email });
  // The emailed token isn't stored, only its hash; plant a known one to stand in for the email.
  const token = 'a'.repeat(64);
  await User.updateOne({ _id: c.user._id }, { resetToken: crypto.createHash('sha256').update(token).digest('hex') });
  assert.strictEqual((await client(app.base).post('/api/v1/auth/reset-password', { token, password: 'new-password-1' })).status, 200);
  assert.strictEqual((await client(app.base).post('/api/v1/auth/reset-password', { token, password: 'new-password-2' })).status, 400);
  assert.strictEqual((await c.get('/api/v1/auth/me')).status, 401);
  assert.strictEqual((await client(app.base).post('/api/v1/auth/login', { email: c.user.email, password: 'new-password-1' })).status, 200);
});
