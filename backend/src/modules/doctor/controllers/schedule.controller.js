// Schedule controller for doctor schedule management
const mongoose = require('mongoose');
const Doctor = require('../Doctor.model');
const { asyncHandler, AppError } = require('../../../shared/utils');

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

  for (let i = 0; currentMinutes + slotDuration <= endTotalMinutes; i++) {
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
  for (let i = 0; i < scheduleEntry.slots.length; i++) {
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

const getMySchedule = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ userId: req.user._id }).select('availableSlots');
  if (!doctor) {
    throw new AppError(404, 'Doctor profile not found');
  }

  const schedules = doctor.availableSlots.map((schedule) => {
    const firstSlot = schedule.slots[0];
    const lastSlot = schedule.slots[schedule.slots.length - 1];
    const toMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    const slotDuration = firstSlot
      ? (toMinutes(lastSlot.endTime) - toMinutes(firstSlot.startTime)) / schedule.slots.length
      : 0;

    return {
      _id: schedule._id,
      date: schedule.date,
      startTime: firstSlot?.startTime,
      endTime: lastSlot?.endTime,
      slotDuration,
      slots: schedule.slots,
    };
  });

  return res.json({ schedules });
});

const deleteMySchedule = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ userId: req.user._id });
  if (!doctor) {
    throw new AppError(404, 'Doctor profile not found');
  }

  const schedule = doctor.availableSlots.id(req.params.scheduleId);
  if (!schedule) {
    throw new AppError(404, 'Schedule not found');
  }

  schedule.deleteOne();
  await doctor.save();
  return res.json({ message: 'Schedule deleted' });
});

module.exports = {
  setSchedule,
  getAvailableSlots,
  getMySchedule,
  deleteMySchedule,
};
