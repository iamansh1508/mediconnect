const { AppError } = require('../utils');

// Express error handler exported for reuse
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err && (err.statusCode || err.status) ? (err.statusCode || err.status) : 500;
  const message = err && err.message ? err.message : 'Internal Server Error';
  // keep response minimal and consistent
  return res.status(status).json({ message });
};

module.exports = { errorHandler };