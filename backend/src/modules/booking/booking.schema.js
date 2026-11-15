const mongoose = require('mongoose');
const { Schema } = mongoose;

// Appointment schema supports both legacy fields (date, timeSlot) and the newer
// fields introduced in Phase 4 (appointmentDate, slotStartTime, slotEndTime, etc.).
// The legacy fields are retained for backward compatibility with existing tests
// and routes that still reference them.
const AppointmentSchema = new Schema(
  {
    // References
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },

    // Legacy fields – optional to allow creation via the newer API.
    date: { type: Date },
    timeSlot: { type: String },

    // New Phase 4 fields – optional because older code may not provide them.
    appointmentDate: { type: Date },
    slotStartTime: { type: String },
    slotEndTime: { type: String },
    consultationFee: { type: Number },
    queuePosition: { type: Number },
    prescription: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    patientRating: { type: Number, min: 1, max: 5 },
    patientReview: { type: String },

    // Status & payment fields – enums expanded for Phase 4.
    status: {
      type: String,
      enum: ['booked', 'in-queue', 'completed', 'cancelled', 'no-show'],
      default: 'booked'
    },
    paymentId: { type: String },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'successful', 'failed'],
      default: 'pending'
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

// Ensure legacy fields are populated when the newer fields are used.
AppointmentSchema.pre('validate', async function () {
  // Populate `date` from `appointmentDate` if missing.
  if (!this.date) {
    if (this.appointmentDate) {
      this.date = this.appointmentDate;
    }
  }
  // Populate `timeSlot` from `slotStartTime`/`slotEndTime` if missing.
  if (!this.timeSlot) {
    if (this.slotStartTime) {
      if (this.slotEndTime) {
        this.timeSlot = this.slotStartTime + '-' + this.slotEndTime;
      }
    }
  }
});

// Prevent double-booking for the same doctor/date/timeSlot among non-cancelled
AppointmentSchema.index(
  { doctorId: 1, date: 1, timeSlot: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'cancelled' } } }
);

// Phase 4 unique index – ensures no two appointments share the same doctor,
// appointmentDate, and slotStartTime (excluding cancelled slots via sparse).
AppointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, slotStartTime: 1 },
  { unique: true, sparse: true, name: 'unique_appointment_slot' }
);

const PrescriptionSchema = new Schema(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    medicines: [
      {
        name: String,
        dosage: String,
        duration: String,
        instructions: String,
      },
    ],
    notes: String,
    pdfUrl: String,
  },
  { timestamps: true },
);

const ReviewSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
  },
  { timestamps: true },
);

ReviewSchema.index({ patientId: 1, appointmentId: 1 }, { unique: true });

module.exports = { AppointmentSchema, PrescriptionSchema, ReviewSchema };
