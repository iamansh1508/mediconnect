const mongoose = require('mongoose');
const { DoctorSchema } = require('./doctor.schema');

module.exports = mongoose.models.Doctor || mongoose.model('Doctor', DoctorSchema);

