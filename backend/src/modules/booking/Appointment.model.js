const { Schema, model } = require('mongoose');

const LIVE = ['booked', 'confirmed', 'completed'];

const AppointmentSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD', Indian time
  time: { type: String, required: true }, // slot start, 'HH:mm'
  // booked = slot held for 15 minutes awaiting payment; confirmed = paid and in the queue.
  status: { type: String, enum: [...LIVE, 'cancelled'], default: 'booked' },
  fee: { type: Number, required: true }, // rupees, copied from the doctor when booked
  paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
  orderId: String,
  paymentId: String,
  calledAt: Date,
  prescription: {
    type: new Schema({
      medicines: [{ _id: false, name: String, dosage: String, duration: String, instructions: String }],
      notes: String,
    }, { _id: false, timestamps: { createdAt: true, updatedAt: false } }),
    default: undefined,
  },
  review: {
    type: new Schema({ rating: { type: Number, min: 1, max: 5 }, comment: String }, { _id: false, timestamps: { createdAt: true, updatedAt: false } }),
    default: undefined,
  },
}, { timestamps: true });

// The database's own guarantee against double-booking: at most one live appointment per doctor, day
// and time. Partial, so a cancelled slot can be booked again. The Redis lock stops nearly every race
// before it gets here; this index catches the rest (an expired lock, a Redis restart).
AppointmentSchema.index({ doctorId: 1, date: 1, time: 1 }, { unique: true, partialFilterExpression: { status: { $in: LIVE } } });
AppointmentSchema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $type: 'string' } } });

module.exports = model('Appointment', AppointmentSchema);
module.exports.LIVE = LIVE;
