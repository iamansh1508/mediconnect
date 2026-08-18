const redis = require('../../shared/config/redis');

const REUSE_MESSAGE = 'Refresh token reuse detected. All sessions invalidated. Please login again.';

/** Returns false when JTI was already used (replay). */
async function claimRefreshJti(jti) {
  if (!jti) return true;
  if (await redis.isJtiUsed(jti)) return false;
  return redis.markJtiUsed(jti, redis.getRefreshTokenTtlSeconds());
}

module.exports = { claimRefreshJti, REUSE_MESSAGE };
