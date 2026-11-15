const mongoose = require('mongoose');
const Appointment = require('./Appointment.model');
const Prescription = require('./Prescription.model');
const Review = require('./Review.model');
const Doctor = require('../doctor/Doctor.model');
const bookingService = require('./booking.service');
const { asyncHandler, AppError } = require('../../shared/utils');

/**
 * createBooking
 * Endpoint handler for concurrency-safe booking.
 * Extracts details, handles legacy/new payload structures, and delegates to booking service.
 */
const createBooking = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const doctorId = req.body.doctorId;
  const rawDate = req.body.appointmentDate || req.body.date;
  const appointmentDate = new Date(rawDate);
  let slotStartTime = req.body.slotStartTime;
  let slotEndTime = req.body.slotEndTime;
  let idempotencyKey = req.body.idempotencyKey;

  if (!mongoose.isValidObjectId(doctorId)) {
    throw new AppError(400, 'Invalid doctor ID');
  }

  if (!rawDate || Number.isNaN(appointmentDate.getTime())) {
    throw new AppError(400, 'A valid appointment date is required');
  }

  if ((!slotStartTime || !slotEndTime) && req.body.timeSlot) {
    const parts = req.body.timeSlot.split('-');
    if (parts.length === 2) {
      slotStartTime = slotStartTime || parts[0].trim();
      slotEndTime = slotEndTime || parts[1].trim();
    }
  }

  const validTime = (value) => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!validTime(slotStartTime) || !validTime(slotEndTime)) {
    throw new AppError(400, 'Appointment times must use HH:mm format');
  }

  const timeSlot = `${slotStartTime}-${slotEndTime}`;
  if (!idempotencyKey) {
    const crypto = require('crypto');
    idempotencyKey = crypto.randomUUID();
  }

  try {
    const bookingResult = await bookingService.bookAppointment({
      userId,
      doctorId,
      appointmentDate,
      slotStartTime,
      slotEndTime,
      timeSlot,
      idempotencyKey
    });

    try {
      const queue = require('./queue.service');
      await queue.addToQueue(bookingResult.appointmentId, appointmentDate, 1);
    } catch (queueError) {
      console.warn('Queue enqueue failed, continuing:', queueError && queueError.message);
    }

    try {
      const io = req.app.get('io');
      if (io) {
        io.to('doctor:' + doctorId).emit('appointment:queued', bookingResult.appointment);
        io.to('patient:' + userId).emit('appointment:queued', bookingResult.appointment);
      }
    } catch (socketError) {
      console.warn('Socket emit failed, continuing:', socketError && socketError.message);
    }

    return res.status(201).json(bookingResult);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message || 'Request failed' });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Slot no longer available' });
    }
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// GET /appointments/my
const myAppointments = asyncHandler(async (req, res) => {
  const patientId = req.user._id;
  const appts = await Appointment.find({ patientId }).sort({ date: -1 }).populate('doctorId');
  return res.json({ appointments: appts });
});

// GET /appointments/:id/queue
const getAppointmentQueuePosition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'invalid appointment id');

  const appt = await Appointment.findById(id);
  if (!appt) throw new AppError(404, 'Appointment not found');

  // Prefer Redis queue position when available
  try {
    const queue = require('./queue.service');
    const pos = await queue.getPosition(appt.doctorId.toString(), appt._id.toString(), appt.date);
    return res.json({ position: pos });
  } catch (e) {
    // fallback to DB ordering
  }

  const start = new Date(appt.date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(appt.date);
  end.setHours(23, 59, 59, 999);

  const sameDay = await Appointment.find({ doctorId: appt.doctorId, date: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } }).sort({ createdAt: 1 }).select('_id');
  const ids = sameDay.map(d => d._id.toString());
  const pos = ids.indexOf(appt._id.toString());
  if (pos === -1) return res.json({ position: null });
  return res.json({ position: pos + 1 });
});

// DELETE /appointments/:id
const cancelAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'invalid appointment id');

  const appt = await Appointment.findById(id);
  if (!appt) throw new AppError(404, 'Appointment not found');
  if (appt.patientId.toString() !== req.user._id.toString()) throw new AppError(403, 'Not allowed');

  appt.status = 'cancelled';
  await appt.save();
  // best-effort remove from queue and notify
  try {
    const queue = require('./queue.service');
    await queue.removeFromQueue(appt.doctorId.toString(), appt._id.toString(), appt.date);
  } catch (e) { /* best-effort */ }
  try {
    const io = req.app.get('io');
    if (io) {
      io.to(`doctor:${appt.doctorId.toString()}`).emit('appointment:cancelled', appt);
      io.to(`patient:${req.user._id.toString()}`).emit('appointment:cancelled', appt);
    }
  } catch (e) { /* best-effort */ }

  return res.json({ message: 'Appointment cancelled' });
});

// GET /prescriptions/:id/download
const downloadPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'invalid prescription id');

  const p = await Prescription.findById(id);
  if (!p) throw new AppError(404, 'Prescription not found');
  if (p.pdfUrl) return res.json({ pdfUrl: p.pdfUrl });
  return res.status(501).json({ message: 'Prescription PDF not generated' });
});

// POST /reviews/:doctorId
const postReview = asyncHandler(async (req, res) => {
  const patientId = req.user._id;
  const { doctorId } = req.params;
  const { rating, comment, appointmentId } = req.body;
  if (!doctorId || !rating) throw new AppError(400, 'doctorId and rating required');
  if (!mongoose.isValidObjectId(doctorId)) throw new AppError(400, 'invalid doctor id');
  if (appointmentId && !mongoose.isValidObjectId(appointmentId)) throw new AppError(400, 'invalid appointment id');

  // create review; unique constraints may apply at schema level
  try {
    const review = await Review.create({ patientId, doctorId, appointmentId, rating, comment });

    // Update doctor's aggregate rating (simple incremental average)
    const doc = await Doctor.findById(doctorId);
    if (doc) {
      const total = doc.totalReviews || 0;
      const newTotal = total + 1;
      const newRating = ((doc.rating || 0) * total + parseFloat(rating)) / newTotal;
      doc.rating = newRating;
      doc.totalReviews = newTotal;
      await doc.save();
    }

    return res.status(201).json({ review });
  } catch (err) {
    if (err && err.code === 11000) throw new AppError(409, 'Review already exists');
    throw err;
  }
});

module.exports = {
  bookAppointment: createBooking,
  createBooking,
  myAppointments,
  getAppointmentQueuePosition,
  cancelAppointment,
  downloadPrescription,
  postReview,
};
