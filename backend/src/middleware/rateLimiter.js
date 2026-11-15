// Rate limiter middleware using express-rate-limit
// Protects auth endpoints against brute force attacks

const rateLimit = require('express-rate-limit');

/**
 * General rate limiter: 100 requests per 15 minutes per IP
 * Applied to auth endpoints (register, login)
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Stricter rate limiter for sensitive endpoints: 5 requests per 15 minutes
 * Can be used for password reset, email verification, etc.
 */
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authRateLimiter,
  strictRateLimiter,
};
