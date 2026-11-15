const redisConfig = require('../shared/config/redis');
const User = require('../shared/User.model');

/**
 * Token Utilities for JTI tracking and session revocation.
 */

// Marks a refresh JTI as used in Redis.
async function storeUsedJTI(jti, expirySeconds) {
  try {
    const isSuccess = await redisConfig.markJtiUsed(jti, expirySeconds);
    return isSuccess;
  } catch (error) {
    console.error('Failed to store JTI:', error);
    return false;
  }
}

// Checks if a JTI has already been used (detects reuse/stolen tokens).
async function checkJTIReuse(jti) {
  try {
    const isUsed = await redisConfig.isJtiUsed(jti);
    return isUsed;
  } catch (error) {
    console.error('Failed to check JTI reuse:', error);
    return true; // Assume reused if Redis check fails (fail closed)
  }
}

// Revokes all refresh tokens for a user.
async function revokeAllUserSessions(userId) {
  try {
    await User.findByIdAndUpdate(userId, { $set: { refreshToken: '' } });
    return true;
  } catch (error) {
    console.error('Failed to revoke sessions:', error);
    return false;
  }
}

module.exports = {
  storeUsedJTI,
  checkJTIReuse,
  revokeAllUserSessions
};
