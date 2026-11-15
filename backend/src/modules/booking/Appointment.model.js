const mongoose = require('mongoose');
const { AppointmentSchema } = require('./booking.schema');

module.exports = mongoose.models.Appointment || mongoose.model('Appointment', AppointmentSchema);

