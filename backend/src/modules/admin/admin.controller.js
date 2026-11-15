const mongoose = require('mongoose');
const Doctor = require('../doctor/Doctor.model');
const User = require('../../shared/User.model');
const Appointment = require('../booking/Appointment.model');
const Review = require('../booking/Review.model');
const { asyncHandler } = require('../../shared/utils');
const { AppError } = require('../../shared/utils');

// GET /admin/doctors/pending
const pendingDoctors = asyncHandler(async (req, res) => {
  const docs = await Doctor.find({ isApproved: false })
    .populate('userId', 'name email phone')
    .limit(50);
  return res.json({ doctors: docs });
});

// PUT /admin/doctors/:id/approve
const approveDoctor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Invalid doctor ID');

  const doc = await Doctor.findByIdAndUpdate(
    id,
    { $set: { isApproved: true } },
    { new: true }
  ).populate('userId', 'name email');

  if (!doc) throw new AppError(404, 'Doctor not found');
  return res.json({ message: 'Doctor approved', doctor: doc });
});

// PUT /admin/doctors/:id/reject
const rejectDoctor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Invalid doctor ID');

  const doc = await Doctor.findByIdAndUpdate(
    id,
    { $set: { isApproved: false } },
    { new: true }
  ).populate('userId', 'name email');

  if (!doc) throw new AppError(404, 'Doctor not found');
  return res.json({ message: 'Doctor rejected', doctor: doc });
});

// GET /admin/analytics
const analytics = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalDoctors = await Doctor.countDocuments();
  const approvedDoctors = await Doctor.countDocuments({ isApproved: true });
  const totalAppointments = await Appointment.countDocuments();
  const completedAppointments = await Appointment.countDocuments({ status: 'completed' });
  const totalReviews = await Review.countDocuments();

  return res.json({
    stats: {
      totalUsers,
      totalDoctors,
      approvedDoctors,
      pendingDoctors: totalDoctors - approvedDoctors,
      totalAppointments,
      completedAppointments,
      totalReviews,
      avgRating: totalReviews > 0 ? 4.5 : 0, // placeholder: aggregate from Review collection when needed
    },
  });
});

// GET /admin/users
const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select('-password -refreshToken -emailVerificationToken -emailVerificationExpiry')
    .limit(100);
  return res.json({ users });
});

// PUT /admin/users/:id/ban
const banUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Invalid user ID');

  const user = await User.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { new: true }
  ).select('-password -refreshToken -emailVerificationToken -emailVerificationExpiry');

  if (!user) throw new AppError(404, 'User not found');
  return res.json({ message: 'User banned', user });
});

// PUT /admin/users/:id/unban
const unbanUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Invalid user ID');

  const user = await User.findByIdAndUpdate(
    id,
    { $set: { isActive: true } },
    { new: true }
  ).select('-password -refreshToken -emailVerificationToken -emailVerificationExpiry');

  if (!user) throw new AppError(404, 'User not found');
  return res.json({ message: 'User unbanned', user });
});

module.exports = {
  pendingDoctors,
  approveDoctor,
  rejectDoctor,
  analytics,
  listUsers,
  banUser,
  unbanUser,
};
