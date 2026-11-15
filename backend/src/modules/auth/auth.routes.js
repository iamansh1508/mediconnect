const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');
const { verifyJWT } = require('../../shared/middleware');
const { authRateLimiter, strictRateLimiter } = require('../../middleware/rateLimiter');
const passport = require('passport');

const protect = verifyJWT; // backward-compatible alias for route files

// Public - apply rate limiting to auth endpoints
router.post('/register', authRateLimiter, controller.registerUser);
router.post('/login', authRateLimiter, controller.login);
router.post('/refresh-token', authRateLimiter, controller.refreshAccessToken);
router.post('/refresh', controller.refreshAccessToken); // backward compat
router.post('/forgot-password', strictRateLimiter, controller.forgotPasswordRequest);
router.post('/reset-password/:resetToken', strictRateLimiter, controller.resetForgotPassword);
router.get('/verify-email/:verificationToken', controller.verifyEmail);

router.get('/google/failure', (req, res) => res.status(400).json({ message: 'Google authentication failed' }));

// Google OAuth routes only when strategy is configured
if (passport._strategies && passport._strategies['google']) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/api/v1/auth/google/failure' }),
    controller.googleCallback
  );
}

// OTP endpoints
router.post('/send-otp', strictRateLimiter, controller.sendOTP);
router.post('/verify-otp', strictRateLimiter, controller.verifyOTP);

// Protected
router.post('/resend-verification', protect, controller.resendEmailVerification);
router.get('/me', protect, controller.getCurrentUser);
router.put('/me', protect, controller.updateCurrentUser);
router.post('/change-password', protect, controller.changeCurrentPassword);
router.post('/logout', protect, controller.logoutUser);

// Dev-only debug endpoint to expose raw tokens for test runs.
// Access guarded: only enabled when NODE_ENV !== 'production' and requires header 'x-dev-allow: true'
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/tokens', (req, res) => {
    if (req.headers['x-dev-allow'] !== 'true') return res.status(403).json({ message: 'Forbidden' });
    return res.status(200).json({ accessToken: req.cookies?.accessToken, refreshToken: req.cookies?.refreshToken });
  });
}

module.exports = router;
