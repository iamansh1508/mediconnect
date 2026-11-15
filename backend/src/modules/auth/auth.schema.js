const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    name: { type: String },
    email: { type: String, unique: true, required: true, index: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String },
    role: { type: String, enum: ['patient', 'doctor', 'admin'], required: true },
    phone: { type: String },
    isActive: { type: Boolean, default: true },
    refreshToken: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpiry: { type: Date },
    forgotPasswordToken: { type: String },
    forgotPasswordExpiry: { type: Date },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    providerId: { type: String },
    profileImage: { type: String },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } },
);

module.exports = { UserSchema };
