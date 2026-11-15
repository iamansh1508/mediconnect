const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = require('express').Router();
const { z } = require('zod');
const User = require('./User.model');
const Doctor = require('../doctor/Doctor.model');
const redis = require('../../shared/redis');
const { notify } = require('../../shared/notify');
const { AppError, validate, rateLimit, getCookie } = require('../../shared/http');
const { hashPassword, checkPassword, issueTokens, clearTokens, requireUser, REFRESH_TTL } = require('../../shared/auth');

const limit = rateLimit('auth', Number(process.env.AUTH_RATE_LIMIT || 20), 15 * 60);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const appUrl = () => process.env.APP_URL || 'http://localhost:5173';
const password = z.string().min(8, 'Use at least 8 characters').max(128);
const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number');

// Returns the raw token for the email link and stores only its hash.
async function emailToken(userId, field, hours) {
  const raw = crypto.randomBytes(32).toString('hex');
  await User.updateOne({ _id: userId }, { [field]: sha256(raw), [`${field}Expiry`]: Date.now() + hours * 3600e3 });
  return raw;
}

async function sendVerification(user, requestId) {
  const token = await emailToken(user._id, 'emailToken', 24);
  await notify('email.verify', {
    email: user.email, subject: 'Confirm your MediConnect email',
    text: `Hi ${user.name},\n\nConfirm your email by opening this link within 24 hours:\n${appUrl()}/verify-email/${token}`,
  }, { requestId });
}

router.post('/auth/register', limit, validate(z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  phone,
  password,
  role: z.enum(['patient', 'doctor']).default('patient'), // admins are created by the seed script only
  specialty: z.string().trim().min(2).max(60).optional(),
})), async (req, res) => {
  const { password: pw, specialty, ...fields } = req.valid;
  if (await User.exists({ email: fields.email })) throw new AppError(409, 'An account with this email already exists. Log in instead.');
  const user = await User.create({ ...fields, password: await hashPassword(pw) });
  if (user.role === 'doctor') await Doctor.create({ userId: user._id, name: user.name, specialty });
  await sendVerification(user, req.id);
  issueTokens(res, user);
  res.status(201).json({ user });
});

router.post('/auth/login', limit, validate(z.object({ email: z.string().trim().toLowerCase(), password: z.string() })), async (req, res) => {
  const user = await User.findOne({ email: req.valid.email }).select('+password');
  if (!user || !(await checkPassword(req.valid.password, user.password))) throw new AppError(401, 'Wrong email or password.');
  if (!user.isActive) throw new AppError(403, 'This account has been suspended. Contact support.');
  issueTokens(res, user);
  res.json({ user });
});

router.post('/auth/refresh', async (req, res) => {
  let p;
  try { p = jwt.verify(getCookie(req.headers.cookie, 'refreshToken'), process.env.REFRESH_TOKEN_SECRET); } catch { throw new AppError(401, 'Please log in again.'); }
  const user = await User.findById(p.sub);
  if (!user || !user.isActive || user.tokenVersion !== p.tv) throw new AppError(401, 'Please log in again.');

  // Each refresh token works once. Seeing it again means it was copied, so end every session.
  const key = `used_jti:${p.jti}`;
  if ((await redis.set(key, '1', { NX: true, EX: REFRESH_TTL })) !== 'OK') {
    // ponytail: 10-second grace for two tabs refreshing at the same moment; shorten if that window worries you.
    const benign = REFRESH_TTL - (await redis.ttl(key)) <= 10;
    if (!benign) {
      await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
      clearTokens(res);
      throw new AppError(401, 'Your login was used somewhere else, so we signed out every session. Log in again.');
    }
  }
  issueTokens(res, user);
  res.json({ user });
});

router.post('/auth/logout', async (req, res) => {
  try {
    const p = jwt.verify(getCookie(req.headers.cookie, 'refreshToken'), process.env.REFRESH_TOKEN_SECRET);
    await redis.set(`used_jti:${p.jti}`, '1', { EX: REFRESH_TTL });
  } catch { /* already expired or missing: nothing to revoke */ }
  clearTokens(res);
  res.json({ message: 'Logged out.' });
});

router.get('/auth/me', requireUser, (req, res) => res.json({ user: req.user }));

router.put('/auth/me', requireUser, validate(z.object({ name: z.string().trim().min(2).max(80).optional(), phone: phone.optional() })), async (req, res) => {
  Object.assign(req.user, req.valid);
  await req.user.save();
  if (req.valid.name && req.user.role === 'doctor') await Doctor.updateOne({ userId: req.user._id }, { name: req.valid.name });
  res.json({ user: req.user });
});

router.post('/auth/change-password', requireUser, validate(z.object({ currentPassword: z.string(), newPassword: password })), async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await checkPassword(req.valid.currentPassword, user.password))) throw new AppError(400, 'Your current password is wrong.');
  user.password = await hashPassword(req.valid.newPassword);
  user.tokenVersion += 1; // sign out other devices
  await user.save();
  issueTokens(res, user);
  res.json({ message: 'Password changed.' });
});

router.post('/auth/forgot-password', limit, validate(z.object({ email: z.string().trim().toLowerCase() })), async (req, res) => {
  const user = await User.findOne({ email: req.valid.email });
  if (user) {
    const token = await emailToken(user._id, 'resetToken', 1);
    await notify('email.reset', {
      email: user.email, subject: 'Reset your MediConnect password',
      text: `Hi ${user.name},\n\nReset your password within 1 hour:\n${appUrl()}/reset-password/${token}\n\nIf you didn't ask for this, ignore this email.`,
    }, { requestId: req.id });
  }
  // Same answer either way, so this can't be used to find out who has an account.
  res.json({ message: "If that email has an account, we've sent a reset link." });
});

router.post('/auth/reset-password', limit, validate(z.object({ token: z.string(), password })), async (req, res) => {
  const user = await User.findOne({ resetToken: sha256(req.valid.token), resetTokenExpiry: { $gt: new Date() } });
  if (!user) throw new AppError(400, 'This reset link is invalid or has expired. Ask for a new one.');
  await User.updateOne({ _id: user._id }, {
    password: await hashPassword(req.valid.password), $unset: { resetToken: 1, resetTokenExpiry: 1 }, $inc: { tokenVersion: 1 },
  });
  res.json({ message: 'Password reset. Log in with your new password.' });
});

router.post('/auth/verify-email', validate(z.object({ token: z.string() })), async (req, res) => {
  const user = await User.findOneAndUpdate(
    { emailToken: sha256(req.valid.token), emailTokenExpiry: { $gt: new Date() } },
    { isEmailVerified: true, $unset: { emailToken: 1, emailTokenExpiry: 1 } },
  );
  if (!user) throw new AppError(400, 'This link is invalid or has expired. Send a new one from your profile.');
  res.json({ message: 'Email confirmed.' });
});

router.post('/auth/resend-verification', requireUser, async (req, res) => {
  if (req.user.isEmailVerified) throw new AppError(400, 'Your email is already confirmed.');
  await sendVerification(req.user, req.id);
  res.json({ message: 'We sent a new link.' });
});

module.exports = router;
