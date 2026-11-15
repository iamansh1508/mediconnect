const redisConfig = require('../../shared/config/redis');

function queueKeyForDate(appointmentDate) {
  const date = new Date(appointmentDate);
  const dateKey = Number.isNaN(date.getTime())
    ? appointmentDate
    : date.toISOString().slice(0, 10);
  return 'queue:' + dateKey;
}

/**
 * addToQueue
 * Adds an appointment to the Redis Sorted Set for a given date.
 * Uses ZADD with score = timestamp of the appointment.
 */
async function addToQueue(appointmentId, appointmentDate, initialPosition) {
  const redisClient = redisConfig.client;
  if (!redisClient) {
    return null;
  }

  const queueKey = queueKeyForDate(appointmentDate);
  const score = new Date(appointmentDate).getTime();

  try {
    const result = await redisClient.zAdd(queueKey, [{ score: score, value: appointmentId.toString() }]);
    await redisClient.expire(queueKey, 60 * 60 * 24 * 2);
    return result === 1;
  } catch (error) {
    console.warn('queue.addToQueue failed', error && error.message);
    return null;
  }
}

/**
 * getQueuePosition
 * Returns the 1-based position of an appointment in the queue.
 * Uses ZRANK to get 0-based rank, then converts to 1-based.
 */
async function getQueuePosition(appointmentId, appointmentDate) {
  const redisClient = redisConfig.client;
  if (!redisClient) {
    return null;
  }

  const queueKey = queueKeyForDate(appointmentDate);

  try {
    const rank = await redisClient.zRank(queueKey, appointmentId.toString());
    if (rank === null) {
      return null;
    }
    return rank + 1;
  } catch (error) {
    console.warn('queue.getQueuePosition failed', error && error.message);
    return null;
  }
}

/**
 * callNextPatient
 * Removes the first patient from the queue (lowest score) and returns their appointment ID.
 * Uses ZRANGE to get the first member, then ZREM to remove it.
 */
async function callNextPatient(appointmentDate) {
  const redisClient = redisConfig.client;
  if (!redisClient) {
    return null;
  }

  const queueKey = queueKeyForDate(appointmentDate);

  try {
    const removedIds = await redisClient.zRange(queueKey, 0, 0);
    if (removedIds.length === 0) {
      return null;
    }

    const nextAppointmentId = removedIds[0];
    await redisClient.zRem(queueKey, nextAppointmentId);
    return nextAppointmentId;
  } catch (error) {
    console.warn('queue.callNextPatient failed', error && error.message);
    return null;
  }
}

/**
 * getAllInQueue
 * Returns all appointment IDs in the queue for a given date, ordered by position.
 * Uses ZRANGE to get all members in order.
 */
async function getAllInQueue(appointmentDate) {
  const redisClient = redisConfig.client;
  if (!redisClient) {
    return [];
  }

  const queueKey = queueKeyForDate(appointmentDate);

  try {
    const allIds = await redisClient.zRange(queueKey, 0, -1);
    return allIds;
  } catch (error) {
    console.warn('queue.getAllInQueue failed', error && error.message);
    return [];
  }
}

/**
 * updateQueuePosition
 * Updates the position of an appointment in the queue by changing its score.
 * Uses ZADD to update the score.
 */
async function updateQueuePosition(appointmentId, appointmentDate, newPosition) {
  const redisClient = redisConfig.client;
  if (!redisClient) {
    return false;
  }

  const queueKey = queueKeyForDate(appointmentDate);

  try {
    const success = await redisClient.zAdd(queueKey, { score: newPosition, value: appointmentId.toString() });
    return success >= 0;
  } catch (error) {
    console.warn('queue.updateQueuePosition failed', error && error.message);
    return false;
  }
}

/**
 * clearQueueForDate
 * Clears the entire queue for a given date.
 * Uses DEL to remove the key.
 */
async function clearQueueForDate(appointmentDate) {
  const redisClient = redisConfig.client;
  if (!redisClient) {
    return false;
  }

  const queueKey = queueKeyForDate(appointmentDate);

  try {
    await redisClient.del(queueKey);
    return true;
  } catch (error) {
    console.warn('queue.clearQueueForDate failed', error && error.message);
    return false;
  }
}

module.exports = {
  addToQueue,
  getQueuePosition,
  callNextPatient,
  getAllInQueue,
  updateQueuePosition,
  clearQueueForDate
};
