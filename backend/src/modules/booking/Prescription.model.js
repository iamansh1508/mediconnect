const mongoose = require('mongoose');
const { PrescriptionSchema } = require('./booking.schema');

module.exports = mongoose.models.Prescription || mongoose.model('Prescription', PrescriptionSchema);

