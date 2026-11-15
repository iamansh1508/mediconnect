const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const { AppError, getCookie } = require('./http');

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}

async function checkPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  return crypto.timingSafeEqual(await scrypt(password, salt, 64), Buffer.from(hash, 'hex'));
}

const ACCESS_TTL = 15 * 60;
const REFRESH_TTL = 7 * 24 * 3600;
const REFRESH_PATH = '/api/v1/auth';
const cookie = (seconds, path) => ({
  httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: seconds * 1000, path,
});

// tv (token version) lets us end every session of a user at once by incrementing user.tokenVersion.
function issueTokens(res, user) {
  const tv = user.tokenVersion;
  res.cookie('accessToken', jwt.sign({ sub: user.id, tv }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TTL }), cookie(ACCESS_TTL, '/'));
  res.cookie('refreshToken', jwt.sign({ sub: user.id, tv, jti: crypto.randomUUID() }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TTL }), cookie(REFRESH_TTL, REFRESH_PATH));
}

function clearTokens(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: REFRESH_PATH });
}

async function userFromAccessToken(token) {
  let p;
  try { p = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET); } catch { return null; }
  const User = require('../modules/auth/User.model');
  const user = await User.findById(p.sub);
  return user && user.isActive && user.tokenVersion === p.tv ? user : null;
}

async function requireUser(req, res, next) {
  req.user = await userFromAccessToken(getCookie(req.headers.cookie, 'accessToken'));
  if (!req.user) return next(new AppError(401, 'Please log in.'));
  next();
}

const requireRole = (...roles) => [requireUser, (req, res, next) =>
  next(roles.includes(req.user.role) ? undefined : new AppError(403, 'You do not have access to this.'))];

module.exports = {
  hashPassword, checkPassword, issueTokens, clearTokens, userFromAccessToken, requireUser, requireRole, REFRESH_TTL,
};
