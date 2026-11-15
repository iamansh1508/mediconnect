const mongoose = require('mongoose');
const { ReviewSchema } = require('./booking.schema');

module.exports = mongoose.models.Review || mongoose.model('Review', ReviewSchema);

