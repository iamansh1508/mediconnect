const mongoose = require('mongoose');
const Doctor = require('./Doctor.model');
const { client: redisClient } = require('../../shared/config/redis');
const { buildPaginationResponse } = require('../../utils/pagination');

async function searchDoctors(latitude, longitude, radius, specialty, minRating, cursor, limit) {
  // Step 1: Validate required inputs
  if (
    latitude === undefined ||
    latitude === null ||
    longitude === undefined ||
    longitude === null ||
    latitude === '' ||
    longitude === '' ||
    Number.isNaN(Number(latitude)) ||
    Number.isNaN(Number(longitude))
  ) {
    throw new Error('lat and lng required');
  }

  const parsedLat = Number(latitude);
  const parsedLng = Number(longitude);
  const parsedRadius = Number(radius) > 0 ? Number(radius) : 5000;
  const parsedLimit = Number.isFinite(limit) ? limit : 20;
  const normalizedRating = typeof minRating === 'number' && isFinite(minRating) ? minRating : 0;

  // Step 2: Build cache key from params
  const normalizedSpecialty = typeof specialty === 'string' && specialty.trim().length > 0 ? specialty.trim() : 'any';
  const cacheKey = `search:${parsedLat}:${parsedLng}:${parsedRadius}:${normalizedSpecialty}:${normalizedRating}`;

  // Step 3: Check Redis cache
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        const filteredCursor = cursor || null;

        const paginated = buildPaginationResponse(items, cursor, parsedLimit, items.length);
        return {
          doctors: paginated.items,
          pagination: paginated.pagination,
        };
      }
    } catch (e) {
      console.warn('Redis searchDoctors cache read failed', e && e.message);
    }
  }

  // Step 4: Build MongoDB geospatial query using $near
  const query = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parsedLng, parsedLat],
        },
        $maxDistance: parsedRadius,
      },
    },
  };

  // Step 5: Add specialty filter if provided
  if (specialty && typeof specialty === 'string' && specialty.trim().length > 0) {
    query.specialty = specialty.trim();
  }

  // Step 6: Add rating filter if minRating > 0
  if (normalizedRating > 0) {
    query.rating = { $gte: normalizedRating };
  }

  // Step 7: Add cursor filter (find docs after cursor)
  let cursorQuery = {};
  if (cursor && typeof cursor === 'string' && cursor.trim().length > 0) {
    if (!mongoose.isValidObjectId(cursor)) {
      throw new Error('Invalid cursor format');
    }
    cursorQuery = { _id: { $gt: cursor } };
  }

  // Step 8: Execute query, get limit + 1 results
  const docs = await Doctor.find({
    ...query,
    ...cursorQuery,
  })
    .sort({ _id: 1 })
    .limit(parsedLimit + 1)
    .populate('userId', 'name email');

  const paginated = buildPaginationResponse(docs, cursor, parsedLimit, docs.length);
  const response = {
    doctors: paginated.items,
    pagination: paginated.pagination,
  };
  // Step 10: Cache for 1 hour
  if (redisClient) {
    try {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
    } catch (e) {
      console.warn('Redis searchDoctors cache write failed', e && e.message);
    }
  }

  return response;
}

/**
 * Invalidate doctor search cache on profile updates.
 * Finds all search:* keys in Redis and deletes them.
 */
async function invalidateDoctorCache() {
  if (!redisClient) {
    return;
  }

  // Find all search:* keys in Redis and delete them.
  try {
    const pattern = 'search:*';
    let keys = [];

    for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
      if (keys.length >= 200) {
        const deletePromises = [];
        for (let i = 0; i < keys.length; i = i + 1) {
          deletePromises.push(redisClient.del(keys[i]));
        }
        await Promise.all(deletePromises);
        keys = [];
      }
    }

    if (keys.length > 0) {
      const deletePromises = [];
      for (let i = 0; i < keys.length; i++) {
        deletePromises.push(redisClient.del(keys[i]));
      }
      await Promise.all(deletePromises);
    }
  } catch (e) {
    console.warn('Redis invalidateDoctorCache failed', e && e.message);
  }
}


// Aggregation pipeline for doctor search with text index
async function searchDoctorsByText(query, limit = 20) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('Search query required');
  }

  return await Doctor.aggregate([
    { $match: { $text: { $search: query } } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $project: {
        _id: 1,
        specialty: 1,
        consultationFee: 1,
        rating: 1,
        totalReviews: 1,
        imageUrl: 1,
        bio: 1,
        doctorName: 1,
        isApproved: 1,
        'userId.name': '$user.name',
        'userId.email': '$user.email',
      },
    },
    { $limit: limit },
  ]);
}

module.exports = {
  searchDoctorsByText,
  searchDoctors,
  invalidateDoctorCache,
};
