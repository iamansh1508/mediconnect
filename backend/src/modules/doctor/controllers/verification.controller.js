// Verification controller for doctor NMC verification and registration
const mongoose = require('mongoose');
const Doctor = require('../Doctor.model');
const { asyncHandler, AppError } = require('../../../shared/utils');
const { verifyDoctorNMC } = require('../../../utils/doctorVerification');
const doctorService = require('../doctor.service');

/**
 * Verify doctor NMC registration (mocked).
 * POST /api/v1/doctors/verify-nmc
 * Body: { nmcRegistrationNumber }
 */
const verifyNMC = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { nmcRegistrationNumber } = req.body;

  if (!nmcRegistrationNumber || typeof nmcRegistrationNumber !== 'string') {
    throw new AppError(400, 'nmcRegistrationNumber is required');
  }

  const result = await verifyDoctorNMC(nmcRegistrationNumber);

  if (result.verified) {
    // Update doctor profile with verified NMC number
    const doctor = await Doctor.findOneAndUpdate(
      { userId },
      { $set: { nmcRegistrationNumber: result.registrationNumber, isNmcVerified: true } },
      { new: true }
    ).populate('userId', 'name email');

    // Invalidate search cache after verification update
    try {
      await doctorService.invalidateDoctorCache();
    } catch (e) {
      console.warn('Cache invalidation failed', e && e.message);
    }

    return res.json({
      message: 'NMC verification successful',
      verified: true,
      registrationNumber: result.registrationNumber,
      verifiedAt: result.verifiedAt,
      doctor: doctor,
    });
  } else {
    return res.status(400).json({
      message: 'NMC verification failed',
      verified: false,
      reason: result.reason,
    });
  }
});

/**
 * Approve doctor registration (legacy endpoint).
 * POST /api/v1/doctors/verify-registration
 * Body: { nmcNumber }
 */
const verifyRegistration = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { nmcNumber } = req.body;
  if (!nmcNumber) throw new AppError(400, 'nmcNumber required');

  let doctor = await Doctor.findOneAndUpdate(
    { userId },
    { $set: { nmcRegistrationNumber: nmcNumber, isNmcVerified: true } },
    { new: true, upsert: true }
  ).populate('userId', 'name email');

  // Invalidate search cache after verification update
  try {
    await doctorService.invalidateDoctorCache();
  } catch (e) {
    console.warn('Cache invalidation failed', e && e.message);
  }

  return res.json({
    message: 'Doctor verified (mock)',
    doctor: doctor,
  });
});

/**
 * Get pending doctors (for admin approval).
 * GET /api/v1/admin/doctors/pending
 */
const getPendingDoctors = asyncHandler(async (req, res) => {
  const doctors = await Doctor.find({
    isApproved: false,
    isNmcVerified: false,
  }).populate('userId', 'name email');

  return res.json({ doctors });
});

module.exports = {
  verifyNMC,
  verifyRegistration,
  getPendingDoctors,
};
