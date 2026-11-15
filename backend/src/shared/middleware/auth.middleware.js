const jwt = require('jsonwebtoken');
const User = require('../User.model');
const { asyncHandler, AppError } = require('../utils');

// verifyJWT: checks cookie or Authorization header, attaches user to req
const verifyJWT = asyncHandler(async (req, res, next) => {
  const token = (req.cookies && req.cookies.accessToken) ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer') && req.headers.authorization.split(' ')[1]);

  if (!token) {
    throw new AppError(401, 'Unauthorized request');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'access-secret');
  } catch (err) {
    throw new AppError(401, 'Invalid access token');
  }

  const user = await User.findById(decoded._id).select('-password -refreshToken -emailVerificationToken -emailVerificationExpiry');
  if (!user) throw new AppError(401, 'Invalid access token');

  req.user = user;
  return next();
});

// restrictTo: middleware factory that allows only specified roles
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'Unauthorized'));
  if (!roles.includes(req.user.role)) return next(new AppError(403, 'Forbidden'));
  return next();
};

module.exports = { verifyJWT, restrictTo };

