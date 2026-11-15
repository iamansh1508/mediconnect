const { AppError } = require('../utils');

// restrictTo: allow only listed roles (synchronous)
// Usage: router.get('/admin', restrictTo('admin'), handler)
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'Unauthorized'));
  if (!roles.includes(req.user.role)) return next(new AppError(403, 'Forbidden'));
  return next();
};

// requireAnyRole: allow if user has any of the provided roles
const requireAnyRole = (roles = []) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'Unauthorized'));
  for (const r of roles) if (req.user.role === r) return next();
  return next(new AppError(403, 'Forbidden'));
};

module.exports = { restrictTo, requireAnyRole };
