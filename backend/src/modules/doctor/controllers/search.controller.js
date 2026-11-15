// Search controller for doctor search functionality
const mongoose = require('mongoose');
const Doctor = require('../Doctor.model');
const { asyncHandler, AppError } = require('../../../shared/utils');
const doctorService = require('../doctor.service');
const { verifyDoctorNMC } = require('../../../utils/doctorVerification');

/**
 * Search doctors by text query (name, bio, specialty)
 * GET /api/v1/doctors/search?q=...
 */
const searchDoctors = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    throw new AppError(400, 'search query required');
  }

  try {
    const docs = await doctorService.searchDoctorsByText(q, 20);
    return res.json({ doctors: docs });
  } catch (err) {
    throw new AppError(400, err.message || 'Search failed');
  }
});

/**
 * Geospatial search with filters and cursor pagination
 * GET /api/v1/doctors/search/geo?lat=...&lng=...&radius=...&specialty=...&minRating=...&cursor=...&limit=...
 */
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

/**
 * List doctors with optional filters: specialty, rating, and cursor-based pagination
 * GET /api/v1/doctors?specialty=...&minRating=...&cursor=...&limit=...
 */
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

/**
 * Get doctor by ID
 * GET /api/v1/doctors/:id
 */
const getDoctorById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'invalid doctor id');
  const doc = await Doctor.findById(id).populate('userId', 'name email');
  if (!doc) throw new AppError(404, 'Doctor not found');
  return res.json({ doctor: doc });
});

/**
 * Get current doctor's profile (for authenticated doctor)
 * GET /api/v1/doctors/me
 */
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

/**
 * Get nearby doctors (legacy endpoint, now uses service)
 * GET /api/v1/doctors/nearby?lat=...&lng=...&radius=...
 */
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

module.exports = {
  listDoctors,
  nearbyDoctors,
  getDoctorById,
  searchDoctors,
  geospatialSearch,
  getMyProfile,
};
