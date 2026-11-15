const mongoose = require('mongoose');
require('dotenv').config();
const Doctor = require('../src/modules/doctor/Doctor.model');
const User = require('../src/shared/User.model');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mediconnect');

  let user = await User.findOne({ email: 'seed-doctor@example.com' });
  if (!user) {
    user = await User.create({ name: 'Seed Doctor', email: 'seed-doctor@example.com', username: 'seeddoctor', password: 'Password123!', role: 'doctor' });
    console.log('created user', user._id.toString());
  } else {
    console.log('user exists', user._id.toString());
  }

  let doc = await Doctor.findOne({ userId: user._id });
  if (!doc) {
    doc = await Doctor.create({ userId: user._id, specialty: 'General', consultationFee: 300, isApproved: true, location: { type: 'Point', coordinates: [77.5946, 12.9716] } });
    console.log('created doctor', doc._id.toString());
  } else {
    console.log('doctor exists', doc._id.toString());
  }

  await mongoose.disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
