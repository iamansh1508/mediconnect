const mongoose = require('mongoose');
const Doctor = require('./Doctor.model');
const Appointment = require('../booking/Appointment.model');
const Prescription = require('../booking/Prescription.model');
const User = require('../../shared/User.model');
const { asyncHandler, AppError } = require('../../shared/utils');
const doctorService = require('./doctor.service');
const { verifyDoctorNMC } = require('../../utils/doctorVerification');

// List doctors with optional filters: specialty, rating, and cursor-based pagination (cursor, limit)
const listDoctors = asyncHandler(async (req, res) => {
  const { specialty, minRating, cursor, limit: rawLimit } = req.query;
  const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 100);

  const q = {};
  if (specialty) q.specialty = specialty;
  if (minRating) q.rating = { $gte: parseFloat(minRating) };

  if (cursor) {
    if (!mongoose.isValidObjectId(cursor)) {
      throw new AppError(400, 'Invalid cursor format');
    }
    q._id = { $gt: cursor };
  }

  // Fetch limit + 1 to determine if more pages exist without extra count query
  const docs = await Doctor.find(q)
    .sort({ _id: 1 })
    .limit(limit + 1)
    .populate('userId', 'name email');

  const hasNextPage = docs.length > limit;
  const items = hasNextPage ? docs.slice(0, limit) : docs;
  const nextCursor = hasNextPage ? items[items.length - 1]._id : null;

  return res.json({
    doctors: items,
    nextCursor,
    hasNextPage,
  });
});

const nearbyDoctors = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 5000 } = req.query;
  if (!lat || !lng) throw new AppError(400, 'lat and lng required');

  try {
    const result = await doctorService.searchDoctors(lat, lng, radius, null, null, null, 50);
    return res.json({ doctors: result.doctors });
  } catch (err) {
    throw new AppError(400, err.message || 'Search failed');
  }
});

const getDoctorById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'invalid doctor id');
  const doc = await Doctor.findById(id).populate('userId', 'name email');
  if (!doc) throw new AppError(404, 'Doctor not found');
  return res.json({ doctor: doc });
});

const searchDoctors = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    throw new AppError(400, 'search query required');
  }

  try {
    const doctorService = require('./doctor.service');
    const docs = await doctorService.searchDoctorsByText(q, 20);
    return res.json({ doctors: docs });
  } catch (err) {
    throw new AppError(400, err.message || 'Search failed');
  }
});

// Geospatial search with filters and cursor pagination
const geospatialSearch = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 5000, specialty, minRating, cursor, limit = 20 } = req.query;
  if (!lat || !lng) throw new AppError(400, 'lat and lng required');

  try {
    const result = await doctorService.searchDoctors(
      lat,
      lng,
      radius,
      specialty || null,
      minRating ? parseFloat(minRating) : null,
      cursor || null,
      parseInt(limit, 10)
    );
    return res.json({
      doctors: result.doctors,
      pagination: result.pagination,
    });
  } catch (err) {
    throw new AppError(400, err.message || 'Search failed');
  }
});

// For doctors: get or create their Doctor profile linked to the logged-in user
const getMyProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let doc = await Doctor.findOne({ userId }).populate('userId', 'name email');
  if (!doc) {
    // create a minimal Doctor document lazily
    doc = await Doctor.create({ userId });
    await doc.populate('userId', 'name email');
  }
  return res.json({ doctor: doc });
});

const { uploadImage, isConfigured: isCloudinaryConfigured } = require('../../shared/cloudinary.client');

const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { specialty, consultationFee, nmcRegistrationNumber, location, imageBase64, imageUrl, bio } = req.body;

  let doc = await Doctor.findOne({ userId });
  if (!doc) {
    doc = new Doctor({ userId });
  }

  // Apply safe field updates
  if (specialty !== undefined) doc.specialty = specialty;
  if (consultationFee !== undefined) doc.consultationFee = consultationFee;
  if (nmcRegistrationNumber !== undefined) doc.nmcRegistrationNumber = nmcRegistrationNumber;
  if (bio !== undefined) doc.bio = bio;

  // Handle location using the schema's setLocation helper (validates lng, lat)
  // Accepts GeoJSON Point from Leaflet: { type: 'Point', coordinates: [lng, lat] }
  if (location !== undefined) {
    if (!location) {
      doc.location = undefined;
    } else if (
      location.type === 'Point' &&
      Array.isArray(location.coordinates) &&
      location.coordinates.length === 2 &&
      typeof location.coordinates[0] === 'number' &&
      typeof location.coordinates[1] === 'number' &&
      isFinite(location.coordinates[0]) &&
      isFinite(location.coordinates[1])
    ) {
      const [lng, lat] = location.coordinates;
      doc.setLocation(lng, lat);
    } else {
      // Don't set location until valid [lng, lat] exist to avoid 500 on empty geo coordinates
      doc.location = undefined;
    }
  }

  // Image handling: accept imageBase64 (data URI) or imageUrl. If Cloudinary configured, upload base64/imageUrl and store secure_url.
  try {
    if (imageBase64 && isCloudinaryConfigured()) {
      const uploadRes = await uploadImage({ data: imageBase64, filename: `doctor_${userId.toString()}`, folder: 'mediconnect/doctors' });
      if (uploadRes && uploadRes.secure_url) doc.imageUrl = uploadRes.secure_url;
    } else if (imageUrl && isCloudinaryConfigured()) {
      // If client provides a public URL, ask Cloudinary to fetch it so we host it reliably
      const uploadRes = await uploadImage({ data: imageUrl, filename: `doctor_${userId.toString()}`, folder: 'mediconnect/doctors' });
      if (uploadRes && uploadRes.secure_url) doc.imageUrl = uploadRes.secure_url;
    } else if (imageUrl) {
      // Cloudinary not configured, accept external URL as-is (dev fallback)
      doc.imageUrl = imageUrl;
    }
  } catch (e) {
    console.error('Cloudinary upload failed', e && e.message);
    // don't fail the whole request for image upload issues — warn and continue
  }

  await doc.save();
  await doc.populate('userId', 'name email');
  // Invalidate search cache after profile update
  try {
    await doctorService.invalidateDoctorCache();
  } catch (e) {
    console.warn('Cache invalidation failed', e && e.message);
  }
  return res.json({ message: 'Profile updated', doctor: doc });
});

const verifyRegistration = asyncHandler(async (req, res) => {
  // ponytail: mocked verification. In prod call NMC API here.
  const userId = req.user._id;
  const { nmcNumber } = req.body;
  if (!nmcNumber) throw new AppError(400, 'nmcNumber required');

  let doc = await Doctor.findOneAndUpdate({ userId }, { $set: { nmcRegistrationNumber: nmcNumber, isNmcVerified: true } }, { new: true, upsert: true }).populate('userId', 'name email');
  // Invalidate search cache after verification update
  try {
    await doctorService.invalidateDoctorCache();
  } catch (e) {
    console.warn('Cache invalidation failed', e && e.message);
  }
  return res.json({ message: 'Doctor verified (mock)', doctor: doc });
});

const updateAvailability = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { availableSlots } = req.body;
  if (!Array.isArray(availableSlots)) throw new AppError(400, 'availableSlots must be an array');

  const doc = await Doctor.findOneAndUpdate({ userId }, { $set: { availableSlots } }, { new: true, upsert: true }).populate('userId', 'name email');
  // Invalidate search cache after availability update
  try {
    await doctorService.invalidateDoctorCache();
  } catch (e) {
    console.warn('Cache invalidation failed', e && e.message);
  }
  return res.json({ doctor: doc });
});

const appointmentsToday = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const doc = await Doctor.findOne({ userId });
  if (!doc) return res.json({ appointments: [] });

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const appts = await Appointment.find({ doctorId: doc._id, date: { $gte: start, $lte: end } }).populate('patientId', 'name email');
  return res.json({ appointments: appts });
});

const callNext = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params; // appointment id
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'invalid appointment id');

  const doc = await Doctor.findOne({ userId });
  if (!doc) throw new AppError(404, 'Doctor profile not found');

  const appt = await Appointment.findOne({ _id: id, doctorId: doc._id });
  if (!appt) throw new AppError(404, 'Appointment not found');

  // minimal action: mark as in-queue (or completed if already in-queue)
  appt.status = appt.status === 'in-queue' ? 'completed' : 'in-queue';
  await appt.save();

  // ponytail: SMS / socket notifications would be triggered here (fire-and-forget)
  try {
    const io = req.app.get('io');
    if (io) {
      io.to(`doctor:${doc._id.toString()}`).emit('appointment:updated', appt);
      if (appt.patientId) io.to(`patient:${appt.patientId.toString()}`).emit('appointment:updated', appt);
    }
  } catch (e) {
    console.warn('Socket emit failed', e && e.message);
  }

  return res.json({ appointment: appt });
});

const createPrescription = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { appointmentId, medicines, notes } = req.body;
  if (!appointmentId || !Array.isArray(medicines)) throw new AppError(400, 'appointmentId and medicines required');

  const doc = await Doctor.findOne({ userId });
  if (!doc) throw new AppError(404, 'Doctor profile not found');

  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new AppError(404, 'Appointment not found');

  const prescription = await Prescription.create({ appointmentId, doctorId: doc._id, patientId: appt.patientId, medicines, notes });

  return res.status(201).json({ prescription });
});

const patientHistory = asyncHandler(async (req, res) => {
  const { id: patientId } = req.params;

  const userId = req.user._id;
  const doc = await Doctor.findOne({ userId });
  if (!doc) throw new AppError(404, 'Doctor profile not found');

  if (patientId) {
    if (!mongoose.isValidObjectId(patientId)) throw new AppError(400, 'invalid patient id');
    const history = await Appointment.find({ patientId, doctorId: doc._id }).sort({ date: -1 }).limit(20);
    return res.json({ history });
  }

  // Return list of appointments/patients for this doctor
  const appts = await Appointment.find({ doctorId: doc._id }).sort({ date: -1 }).limit(50).populate('patientId', 'name email phone');
  return res.json({ patients: appts });
});

/**
 * Set doctor schedule for a specific date.
 * POST /api/v1/doctors/schedule
 * Body: { date, startTime, endTime, slotDuration }
 */
const setSchedule = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { date, startTime, endTime, slotDuration } = req.body;

  // Validate inputs
  if (!date || typeof date !== 'string') {
    throw new AppError(400, 'date is required');
  }
  if (!startTime || typeof startTime !== 'string') {
    throw new AppError(400, 'startTime is required');
  }
  if (!endTime || typeof endTime !== 'string') {
    throw new AppError(400, 'endTime is required');
  }
  if (!slotDuration || typeof slotDuration !== 'number' || slotDuration <= 0) {
    throw new AppError(400, 'slotDuration must be a positive number');
  }

  // Find doctor profile
  const doctor = await Doctor.findOne({ userId });
  if (!doctor) {
    throw new AppError(404, 'Doctor profile not found');
  }

  // Parse start and end times (format: HH:MM)
  const startParts = startTime.split(':');
  const endParts = endTime.split(':');

  if (startParts.length !== 2 || endParts.length !== 2) {
    throw new AppError(400, 'Invalid time format. Use HH:MM');
  }

  const startHour = parseInt(startParts[0], 10);
  const startMin = parseInt(startParts[1], 10);
  const endHour = parseInt(endParts[0], 10);
  const endMin = parseInt(endParts[1], 10);

  if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
    throw new AppError(400, 'Invalid time format. Use HH:MM');
  }

  if (startHour < 0 || startHour > 23 || startMin < 0 || startMin > 59) {
    throw new AppError(400, 'Invalid start time');
  }

  if (endHour < 0 || endHour > 23 || endMin < 0 || endMin > 59) {
    throw new AppError(400, 'Invalid end time');
  }

  const startTotalMinutes = startHour * 60 + startMin;
  const endTotalMinutes = endHour * 60 + endMin;

  if (startTotalMinutes >= endTotalMinutes) {
    throw new AppError(400, 'End time must be after start time');
  }

  // Generate time slots using index-based loop
  const slots = [];
  let currentMinutes = startTotalMinutes;

  for (let i = 0; currentMinutes + slotDuration <= endTotalMinutes; i = i + 1) {
    const slotStartHour = Math.floor(currentMinutes / 60);
    const slotStartMin = currentMinutes % 60;
    const slotEndMinutes = currentMinutes + slotDuration;
    const slotEndHour = Math.floor(slotEndMinutes / 60);
    const slotEndMin = slotEndMinutes % 60;

    const startStr = String(slotStartHour).padStart(2, '0') + ':' + String(slotStartMin).padStart(2, '0');
    const endStr = String(slotEndHour).padStart(2, '0') + ':' + String(slotEndMin).padStart(2, '0');

    slots.push({
      startTime: startStr,
      endTime: endStr,
      isBooked: false,
    });

    currentMinutes = currentMinutes + slotDuration;
  }

  if (slots.length === 0) {
    throw new AppError(400, 'No slots could be generated with given duration');
  }

  // Create schedule entry
  const scheduleEntry = {
    date: date,
    slots: slots,
  };

  // Update Doctor: $push to available_slots array
  // Using the availableSlots field from schema
  doctor.availableSlots = doctor.availableSlots || [];
  doctor.availableSlots.push(scheduleEntry);
  await doctor.save();

  return res.json({
    date: date,
    slotsCreated: slots.length,
  });
});

/**
 * Get available slots for a doctor on a specific date.
 * GET /api/v1/doctors/:doctorId/schedule?date=YYYY-MM-DD
 */
const getAvailableSlots = asyncHandler(async (req, res) => {
  const { doctorId } = req.params;
  const { date } = req.query;

  if (!mongoose.isValidObjectId(doctorId)) {
    throw new AppError(400, 'invalid doctorId');
  }

  if (!date || typeof date !== 'string') {
    throw new AppError(400, 'date query parameter is required');
  }

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw new AppError(404, 'Doctor not found');
  }

  // Find schedule entry for the given date
  const scheduleEntry = doctor.availableSlots.find((entry) => entry.date === date);

  if (!scheduleEntry) {
    return res.json({
      date: date,
      slots: [],
      totalAvailable: 0,
    });
  }

  // Filter out booked slots (isBooked = false)
  const availableSlots = [];
  for (let i = 0; i < scheduleEntry.slots.length; i = i + 1) {
    if (!scheduleEntry.slots[i].isBooked) {
      availableSlots.push(scheduleEntry.slots[i]);
    }
  }

  return res.json({
    date: date,
    slots: availableSlots,
    totalAvailable: availableSlots.length,
  });
});

/**
 * Verify doctor NMC registration (mocked).
 * POST /api/v1/doctors/verify-nmc
 * Body: { nmcRegistrationNumber }
 */
const verifyNMC = asyncHandler(async (req, res) => {
  const { nmcRegistrationNumber } = req.body;

  if (!nmcRegistrationNumber || typeof nmcRegistrationNumber !== 'string') {
    throw new AppError(400, 'nmcRegistrationNumber is required');
  }

  const result = await verifyDoctorNMC(nmcRegistrationNumber);

  if (result.verified) {
    // Update doctor profile with verified NMC number
    const userId = req.user._id;
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

module.exports = {
  listDoctors,
  nearbyDoctors,
  getDoctorById,
  searchDoctors,
  geospatialSearch,
  getMyProfile,
  updateProfile,
  verifyRegistration,
  updateAvailability,
  appointmentsToday,
  callNext,
  createPrescription,
  patientHistory,
  setSchedule,
  getAvailableSlots,
  verifyNMC,
};
