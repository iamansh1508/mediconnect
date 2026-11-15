const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { UserSchema } = require('../modules/auth/auth.schema');

// password hashing
// Use async hook without calling next() to avoid mongoose callback mismatch.
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
  this.password = await bcrypt.hash(this.password, saltRounds);
});

UserSchema.methods.isPasswordCorrect = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);

