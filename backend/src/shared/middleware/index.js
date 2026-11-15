const { verifyJWT } = require('./auth.middleware');
const { restrictTo, requireAnyRole } = require('./role.middleware');
const { errorHandler } = require('./error.middleware');

module.exports = { verifyJWT, restrictTo, requireAnyRole, errorHandler };