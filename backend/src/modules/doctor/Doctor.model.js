const { Schema, model } = require('mongoose');
const { AppError } = require('../../shared/http');

const DoctorSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true }, // copied from the user so search needs no join
  specialty: { type: String, trim: true },
  consultationFee: { type: Number, min: 0, default: 500 },
  clinicName: String,
  address: String,
  bio: String,
  // GeoJSON point, [longitude, latitude]. Left unset until the doctor places the clinic on the map.
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number], default: undefined },
  },
  slotMinutes: { type: Number, default: 15 },
  // Working hours as slot start times per day, e.g. { date: '2026-11-20', slots: ['09:00', '09:15'] }.
  schedule: [{ _id: false, date: String, slots: [String] }],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  nmcRegistrationNumber: String,
  isNmcVerified: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
}, { timestamps: true });

DoctorSchema.index({ location: '2dsphere' });
DoctorSchema.index({ status: 1, specialty: 1, rating: -1 });

// The logged-in doctor's own profile.
DoctorSchema.statics.mine = async function mine(user) {
  return (await this.findOne({ userId: user._id })) ?? Promise.reject(new AppError(404, 'Doctor profile not found.'));
};

module.exports = model('Doctor', DoctorSchema);
