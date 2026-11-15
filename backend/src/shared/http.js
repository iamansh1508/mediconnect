const crypto = require('crypto');
const os = require('os');
const { z } = require('zod');
const log = require('./log');

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// Validated data goes on req.valid (Express 5 makes req.query read-only).
const validate = (schema, where = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[where] ?? {});
  if (!r.success) {
    const msg = r.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
    return next(new AppError(400, msg));
  }
  req.valid = r.data;
  next();
};

const getCookie = (header, name) => {
  const m = (header || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
};

const host = `${os.hostname()}#${process.pid}`; // which API copy answered
function requestLog(req, res, next) {
  req.id = req.get('x-request-id') || crypto.randomUUID();
  res.set({ 'x-request-id': req.id, 'x-served-by': host, 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'same-origin' });
  const start = process.hrtime.bigint();
  res.on('finish', () => log.info('request', {
    id: req.id, method: req.method, path: req.originalUrl, status: res.statusCode,
    ms: Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10, user: req.user?.id,
  }));
  next();
}

function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  if (err.code === 11000) [status, message] = [409, 'That already exists.'];
  if (err.name === 'CastError') [status, message] = [400, 'Invalid id.'];
  if (status >= 500) {
    log.error('unhandled error', { id: req.id, err: err.stack });
    message = 'Something went wrong on our side. Try again.';
  }
  res.status(status).json({ message });
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// India-only app: dates and times are Indian Standard Time, whatever the server's clock zone.
const nowIST = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16); // 'YYYY-MM-DD HH:mm'
const todayIST = () => nowIST().slice(0, 10);

module.exports = { AppError, objectId, validate, getCookie, requestLog, errorHandler, escapeRegex, nowIST, todayIST };
