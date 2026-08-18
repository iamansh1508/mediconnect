const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../shared/User.model');
const { asyncHandler, AppError, sendEmail, emailVerificationMailgenContent, forgotPasswordMailgenContent } = require('../../shared/utils');

// Generate OTP (6-digit numeric)
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// OTP storage: prefer Redis (if connected), fall back to in-memory Map for dev
const redisConfig = require('../../shared/config/redis');
const { claimRefreshJti, REUSE_MESSAGE } = require('./refreshJti');
const fallbackOtpStore = new Map();

async function otpSet(identifier, otp) {
  if (redisConfig && redisConfig.client) {
    try {
      await redisConfig.client.set(`otp:${identifier}`, JSON.stringify({ otp, attempts: 0 }), { EX: 300 });
      return;
    } catch (e) {
      console.warn('Redis set OTP failed, falling back to memory:', e && e.message);
    }
  }
  fallbackOtpStore.set(identifier, { otp, createdAt: Date.now(), attempts: 0 });
}

async function otpGet(identifier) {
  if (redisConfig && redisConfig.client) {
    try {
      const raw = await redisConfig.client.get(`otp:${identifier}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Redis get OTP failed, falling back to memory:', e && e.message);
    }
  }
  return fallbackOtpStore.get(identifier) || null;
}

async function otpDelete(identifier) {
  if (redisConfig && redisConfig.client) {
    try {
      await redisConfig.client.del(`otp:${identifier}`);
      return;
    } catch (e) {
      console.warn('Redis del OTP failed, falling back to memory:', e && e.message);
    }
  }
  fallbackOtpStore.delete(identifier);
}

async function otpIncAttempts(identifier) {
  if (redisConfig && redisConfig.client) {
    try {
      const raw = await redisConfig.client.get(`otp:${identifier}`);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      obj.attempts = (obj.attempts || 0) + 1;
      await redisConfig.client.set(`otp:${identifier}`, JSON.stringify(obj), { EX: 300 });
      return obj.attempts;
    } catch (e) {
      console.warn('Redis increment OTP attempts failed, falling back to memory:', e && e.message);
    }
  }
  const cur = fallbackOtpStore.get(identifier);
  if (!cur) return null;
  cur.attempts = (cur.attempts || 0) + 1;
  fallbackOtpStore.set(identifier, cur);
  return cur.attempts;
}

async function invalidateUserSessions(user) {
  if (!user) return;
  try {
    user.refreshToken = '';
    await user.save({ validateBeforeSave: false });
  } catch (saveErr) {
    console.error('Failed to clear refreshToken after reuse detection', saveErr && saveErr.message);
  }
}

// Twilio client (dev-safe): sends SMS when TWILIO_* env vars present
const { sendSms, isConfigured: isTwilioConfigured } = require('../../shared/twilio.client');

const generateAccessAndRefreshTokens = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const jti = crypto.randomUUID();

  const accessToken = jwt.sign({ _id: user._id }, process.env.ACCESS_TOKEN_SECRET || 'access-secret', {
    expiresIn: process.env.ACCESS_TOKEN_TTL || '15m',
  });

  const refreshToken = jwt.sign({ _id: user._id, jti }, process.env.REFRESH_TOKEN_SECRET || 'refresh-secret', {
    expiresIn: process.env.REFRESH_TOKEN_TTL || '7d',
  });

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

const registerUser = async (req, res) => {
  try {
    const { name, role, email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ message: 'email, username and password required' });
    }

    const existedUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existedUser) return res.status(409).json({ message: 'User with email or username already exists' });

    const user = await User.create({ name, email, password, username, role: role || 'patient', isEmailVerified: false });

    // generate a temporary verification token
    const unHashedToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(unHashedToken).digest('hex');
    const tokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = tokenExpiry;
    await user.save({ validateBeforeSave: false });

    // send verification email (best-effort)
    try {
      await sendEmail({
        email: user.email,
        subject: 'Please verify your email',
        mailgenContent: emailVerificationMailgenContent(
          user.username,
          `${req.protocol}://${req.get('host')}/api/v1/users/verify-email/${unHashedToken}`,
        ),
      });
    } catch (e) {
      // swallow — email failure shouldn't block registration
      console.error('sendEmail failed', e && e.message);
    }

    const createdUser = await User.findById(user._id).select('-password -refreshToken -emailVerificationToken -emailVerificationExpiry');

    return res.status(201).json({ message: 'User registered', user: createdUser });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Registration failed' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isPasswordValid = typeof user.isPasswordCorrect === 'function'
      ? await user.isPasswordCorrect(password)
      : await require('bcrypt').compare(password, user.password || '');

    if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials' });

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select('-password -refreshToken -emailVerificationToken -emailVerificationExpiry');

    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production' };

    return res
      .status(200)
      .cookie('accessToken', accessToken, cookieOptions)
      .cookie('refreshToken', refreshToken, cookieOptions)
      .json({ message: 'Logged in', user: loggedInUser, accessToken, refreshToken });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Login failed' });
  }
};

const logoutUser = async (req, res) => {
  try {
    if (req.user && req.user._id) {
      await User.findByIdAndUpdate(req.user._id, { $set: { refreshToken: '' } });
    }
    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production' };
    return res.status(200).clearCookie('accessToken', cookieOptions).clearCookie('refreshToken', cookieOptions).json({ message: 'Logged out' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Logout failed' });
  }
};

const getCurrentUser = async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  return res.status(200).json({ user: req.user });
};

const refreshAccessToken = async (req, res) => {
  try {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingRefreshToken) return res.status(401).json({ message: 'Refresh token required' });

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET || 'refresh-secret');
    const user = await User.findById(decodedToken?._id);
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });

    if (incomingRefreshToken !== user?.refreshToken) {
      await invalidateUserSessions(user);
      return res.status(401).json({ message: REUSE_MESSAGE });
    }

    if (!(await claimRefreshJti(decodedToken.jti))) {
      await invalidateUserSessions(user);
      return res.status(401).json({ message: REUSE_MESSAGE });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production' };
    return res
      .status(200)
      .cookie('accessToken', accessToken, cookieOptions)
      .cookie('refreshToken', refreshToken, cookieOptions)
      .json({ message: 'Access token refreshed', accessToken, refreshToken });
  } catch (err) {
    return res.status(401).json({ message: err?.message || 'Invalid refresh token' });
  }
};

const forgotPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'email required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const unHashedToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(unHashedToken).digest('hex');
    const tokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour

    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordExpiry = tokenExpiry;
    await user.save({ validateBeforeSave: false });

    try {
      await sendEmail({
        email: user.email,
        subject: 'Reset your password',
        mailgenContent: forgotPasswordMailgenContent(
          user.username || user.email,
          `${process.env.FORGOT_PASSWORD_REDIRECT_URL || 'https://example.com/reset-password'}/${unHashedToken}`,
        ),
      });
    } catch (e) {
      console.error('sendEmail failed', e && e.message);
    }

    return res.status(200).json({ message: 'Password reset token generated' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Forgot password failed' });
  }
};

const resetForgotPassword = async (req, res) => {
  try {
    const { resetToken } = req.params;
    const { newPassword } = req.body;
    if (!resetToken || !newPassword) return res.status(400).json({ message: 'token and newPassword required' });

    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const user = await User.findOne({ forgotPasswordToken: hashedToken, forgotPasswordExpiry: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Token invalid or expired' });

    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Reset password failed' });
  }
};

const changeCurrentPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isValid = typeof user.isPasswordCorrect === 'function'
      ? await user.isPasswordCorrect(oldPassword)
      : await require('bcrypt').compare(oldPassword, user.password || '');

    if (!isValid) return res.status(401).json({ message: 'Invalid old password' });

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Change password failed' });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { verificationToken } = req.params;
    if (!verificationToken) return res.status(400).json({ message: 'verification token missing' });

    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    const user = await User.findOne({ emailVerificationToken: hashedToken, emailVerificationExpiry: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Token is invalid or expired' });

    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    user.isEmailVerified = true;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({ message: 'Email verified' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Verify email failed' });
  }
};

const resendEmailVerification = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isEmailVerified) return res.status(409).json({ message: 'Email already verified' });

    const unHashedToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(unHashedToken).digest('hex');
    const tokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = tokenExpiry;
    await user.save({ validateBeforeSave: false });

    // send verification email (best-effort)
    try {
      await sendEmail({
        email: user.email,
        subject: 'Please verify your email',
        mailgenContent: emailVerificationMailgenContent(
          user.username || user.email,
          `${req.protocol}://${req.get('host')}/api/v1/users/verify-email/${unHashedToken}`,
        ),
      });
    } catch (e) {
      console.error('sendEmail failed', e && e.message);
    }

    return res.status(200).json({ message: 'Verification token regenerated' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Resend verification failed' });
  }
};

// NEW: OTP Endpoints
const sendOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email && !phone) {
      return res.status(400).json({ message: 'Email or phone required' });
    }

    // Generate OTP
    const otp = generateOTP();
    const identifier = email || phone;
    
    // Store OTP with 5-minute expiry (Redis preferred)
    await otpSet(identifier, otp);

    // Try to send via SMS (Twilio) if phone provided and configured.
    const isDev = process.env.NODE_ENV !== 'production';

    if (phone && isTwilioConfigured()) {
      try {
        await sendSms(phone, `Your MediConnect OTP is ${otp}`);
      } catch (e) {
        console.error('Twilio send failed', e && e.message);
      }
    } else if (phone && !isTwilioConfigured()) {
      // Twilio not configured — warn. In dev we still return the OTP in response for convenience.
      console.warn('Twilio not configured; OTP not sent via SMS');
    }

    return res.status(200).json({
      message: 'OTP sent successfully',
      ...(isDev && { otp }) // Only show OTP in development
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to send OTP' });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, phone, otp } = req.body;
    if (!email && !phone) {
      return res.status(400).json({ message: 'Email or phone required' });
    }
    if (!otp) {
      return res.status(400).json({ message: 'OTP required' });
    }

    const identifier = email || phone;
    const storedData = await otpGet(identifier);

    if (!storedData) {
      return res.status(400).json({ message: 'OTP expired or not found' });
    }

    // For memory fallback we stored createdAt; Redis TTL will have expired already so no extra check needed.
    if (storedData.createdAt) {
      const fiveMinutes = 5 * 60 * 1000;
      if (Date.now() - storedData.createdAt > fiveMinutes) {
        await otpDelete(identifier);
        return res.status(400).json({ message: 'OTP expired' });
      }
    }

    // Check max attempts (3)
    if ((storedData.attempts || 0) >= 3) {
      await otpDelete(identifier);
      return res.status(400).json({ message: 'Too many failed attempts. Please request new OTP.' });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      await otpIncAttempts(identifier);
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // OTP verified - remove from store
    await otpDelete(identifier);

    return res.status(200).json({ message: 'OTP verified successfully' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to verify OTP' });
  }
};

module.exports = {
  registerUser: asyncHandler(registerUser),
  login: asyncHandler(login),
  logoutUser: asyncHandler(logoutUser),
  getCurrentUser: asyncHandler(getCurrentUser),
  refreshAccessToken: asyncHandler(refreshAccessToken),
  forgotPasswordRequest: asyncHandler(forgotPasswordRequest),
  resetForgotPassword: asyncHandler(resetForgotPassword),
  changeCurrentPassword: asyncHandler(changeCurrentPassword),
  verifyEmail: asyncHandler(verifyEmail),
  resendEmailVerification: asyncHandler(resendEmailVerification),
  sendOTP: asyncHandler(sendOTP),
  verifyOTP: asyncHandler(verifyOTP),
};
