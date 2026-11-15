const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: String,
  password: { type: String, select: false },
  role: { type: String, enum: ['patient', 'doctor', 'admin'], default: 'patient' },
  isActive: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 },
  isEmailVerified: { type: Boolean, default: false },
  // Only sha256 hashes of emailed tokens are stored, so a database leak can't be used to take over accounts.
  emailToken: { type: String, select: false },
  emailTokenExpiry: { type: Date, select: false },
  resetToken: { type: String, select: false },
  resetTokenExpiry: { type: Date, select: false },
}, { timestamps: true });

UserSchema.set('toJSON', {
  transform: (doc, r) => {
    for (const k of ['password', 'tokenVersion', 'emailToken', 'emailTokenExpiry', 'resetToken', 'resetTokenExpiry', '__v']) delete r[k];
    return r;
  },
});

module.exports = model('User', UserSchema);
