const mongoose = require('mongoose');
const { Schema } = mongoose;

const TimeSlotSchema = new Schema({
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  isBooked: { type: Boolean, default: false },
}, { _id: false });

const AvailableSlotSchema = new Schema({
  date: { type: String, required: true },
  slots: { type: [TimeSlotSchema], default: [] },
});

const DoctorSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    specialty: { type: String },
    consultationFee: { type: Number },
    availableSlots: [AvailableSlotSchema],
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: undefined,
      },
      coordinates: {
        type: [Number],
        default: undefined,
        index: '2dsphere',
      },
    },
    isApproved: { type: Boolean, default: false },
    nmcRegistrationNumber: { type: String },
    isNmcVerified: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    imageUrl: { type: String },
    bio: { type: String },
    doctorName: { type: String }, // Denormalized from User for text search
  },
  { timestamps: true },
);

DoctorSchema.index({ location: '2dsphere' });
DoctorSchema.index({ specialty: 1, rating: -1 });
DoctorSchema.index({ doctorName: 'text', bio: 'text' }); // Text index for search

// Helper to set location safely — only stores valid [lng, lat] pairs
DoctorSchema.methods.setLocation = function (lng, lat) {
  if (typeof lng === 'number' && typeof lat === 'number' && isFinite(lng) && isFinite(lat)) {
    this.location = { type: 'Point', coordinates: [lng, lat] };
  } else {
    this.location = undefined;
  }
  return this;
};

// Pre-save hook: sync doctorName from linked User
DoctorSchema.pre('save', async function () {
  if (this.isModified('userId') || !this.doctorName) {
    try {
      const User = require('../../shared/User.model');
      const user = await User.findById(this.userId).select('name');
      if (user && user.name) {
        this.doctorName = user.name;
      }
    } catch (e) {
      console.warn('Failed to sync doctorName from User:', e && e.message);
    }
  }
});

module.exports = { DoctorSchema };
