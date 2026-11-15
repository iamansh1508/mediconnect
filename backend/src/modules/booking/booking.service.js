const mongoose = require('mongoose');
const Appointment = require('./Appointment.model');
const Doctor = require('../doctor/Doctor.model');
const redisConfig = require('../../shared/config/redis');
const { acquireLock, releaseLock } = require('../../shared/utils/lock');

/**
 * Helper to generate a placeholder Razorpay URL.
 */
function generateRazorpayURL(appointment) {
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  return baseUrl + '/payment/' + appointment._id.toString();
}

/**
 * bookAppointment
 * Core business logic for concurrency-safe booking with Redis locks and idempotency.
 */
async function bookAppointment(bookingData) {
  console.log('Starting booking process for:', bookingData);
  const userId = bookingData.userId;
  const doctorId = bookingData.doctorId;
  const appointmentDate = bookingData.appointmentDate;
  const slotStartTime = bookingData.slotStartTime;
  const slotEndTime = bookingData.slotEndTime;
  const timeSlot = bookingData.timeSlot || `${slotStartTime}-${slotEndTime}`;
  const idempotencyKey = bookingData.idempotencyKey;

  // 1. Validate inputs
  if (!doctorId) {
    console.error('Doctor required');
    throw new Error('Doctor required');
  }
  if (!appointmentDate) {
    console.error('Date required');
    throw new Error('Date required');
  }
  if (!slotStartTime) {
    console.error('Start time required');
    throw new Error('Start time required');
  }
  if (!slotEndTime) {
    console.error('End time required');
    throw new Error('End time required');
  }
  if (!slotEndTime) {
    console.error('End time required');
    throw new Error('End time required');
  }

  const redisClient = redisConfig.client;

  // 2. Verify idempotency (prevent duplicate submissions)
  // If idempotencyKey is provided, check if we already processed this request.
  let cacheKey = null;
  if (idempotencyKey) {
    cacheKey = 'booking:' + userId + ':' + idempotencyKey;
    if (redisClient) {
      console.log('Checking idempotency cache for key:', cacheKey);
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        console.log('Found cached booking result');
        return JSON.parse(cachedResult); // Already booked, return cached result
      }
    }
  }

  // Fetch doctor to get consultation fee
  console.log('Fetching doctor with ID:', doctorId);
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    console.error('Doctor not found');
    throw new Error('Doctor not found');
  }

  // 3. Acquire distributed lock
  // The lock key is unique to the doctor, date, and start time.
  const lockKey = doctorId + ':' + appointmentDate + ':' + slotStartTime;
  console.log('Attempting to acquire lock with key:', lockKey);
  const lockValue = await acquireLock(lockKey, 5000); // 5 second lock
  
  if (lockValue === null) {
    console.error('Failed to acquire lock');
    const lockError = new Error('Slot just booked, please try another');
    lockError.statusCode = 409;
    throw lockError;
  }

  try {
    // 4. Inside lock, check MongoDB for duplicate
    // This is the safety check to ensure the slot is still free in the database.
    console.log('Checking for existing appointment');
    const existingAppointment = await Appointment.findOne({
      doctorId,
      status: { $ne: 'cancelled' },
      $or: [
        { appointmentDate, slotStartTime },
        { date: appointmentDate, timeSlot }
      ]
    });

    if (existingAppointment) {
      console.log('Found existing appointment:', existingAppointment._id);
      const conflictError = new Error('Slot no longer available');
      conflictError.statusCode = 409;
      throw conflictError;
    }

    // 5. Create appointment
    console.log('Creating new appointment');
    const newAppointment = new Appointment({
      doctorId: doctorId,
      patientId: userId,
      date: appointmentDate,
      timeSlot,
      appointmentDate: appointmentDate,
      slotStartTime: slotStartTime,
      slotEndTime: slotEndTime,
      status: 'booked',
      paymentStatus: 'pending',
      consultationFee: doctor.consultationFee
    });
    
    const savedAppointment = await newAppointment.save();
    console.log('Appointment saved with ID:', savedAppointment._id);

    // 6. Release lock
    console.log('Releasing lock');
    await releaseLock(lockKey, lockValue);

    const finalResponse = {
      appointmentId: savedAppointment._id,
      paymentUrl: generateRazorpayURL(savedAppointment),
      appointment: savedAppointment
    };

    // 7. Cache result for idempotency (1 hour TTL)
    if (cacheKey) {
      if (redisClient) {
        console.log('Caching booking result for idempotency');
        const resultJSON = JSON.stringify(finalResponse);
        await redisClient.set(cacheKey, resultJSON, { EX: 3600 });
      }
    }

    // 8. Return appointment + payment URL
    console.log('Booking process completed successfully');
    return finalResponse;

  } catch (error) {
    console.error('Error during booking process:', error);
    // Ensure lock is released if an error occurs during processing
    if (lockValue) {
      console.log('Releasing lock due to error');
      await releaseLock(lockKey, lockValue);
    }
    throw error;
  }
}

module.exports = {
  bookAppointment
};
