const router = require('express').Router();
const { z } = require('zod');
const Appointment = require('./Appointment.model');
const Doctor = require('../doctor/Doctor.model');
const User = require('../auth/User.model');
const service = require('./booking.service');
const queue = require('./queue');
const { prescriptionPdf } = require('./pdf');
const { AppError, objectId, validate, todayIST } = require('../../shared/http');
const { requireUser, requireRole } = require('../../shared/auth');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

// Loads an appointment the current user may see: their own as patient, or one with them as doctor.
async function visibleAppointment(req) {
  const appt = await Appointment.findById(req.params.id);
  if (appt && String(appt.patientId) === req.user.id) return appt;
  if (appt && req.user.role === 'doctor' && String(appt.doctorId) === String((await Doctor.mine(req.user))._id)) return appt;
  throw new AppError(404, 'Appointment not found.');
}

// ---- patient ----

router.post('/appointments', requireRole('patient'), validate(z.object({ doctorId: objectId, date, time })), async (req, res) => {
  res.status(201).json({ appointment: await service.book(req.user, req.valid) });
});

router.get('/appointments/my', requireRole('patient'), async (req, res) => {
  const appointments = await Appointment.find({ patientId: req.user._id })
    .sort({ date: -1, time: -1 }).limit(100)
    .populate('doctorId', 'name specialty clinicName address');
  res.json({ appointments });
});

router.get('/appointments/:id', requireUser, async (req, res) => {
  const appt = await visibleAppointment(req);
  let position = null;
  if (appt.status === 'confirmed' && !appt.calledAt) {
    await queue.ensure(appt.doctorId, appt.date);
    position = await queue.position(appt);
  }
  await appt.populate([{ path: 'doctorId', select: 'name specialty clinicName address location' }, { path: 'patientId', select: 'name phone' }]);
  res.json({ appointment: appt, position, holdExpired: service.isExpiredHold(appt) });
});

router.delete('/appointments/:id', requireRole('patient'), async (req, res) => {
  res.json({ appointment: await service.cancel(await visibleAppointment(req), req.id) });
});

router.post('/appointments/:id/review', requireRole('patient'), validate(z.object({
  rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional(),
})), async (req, res) => {
  const { rating, comment } = req.valid;
  // Conditional update, so a double-submitted review counts once.
  const appt = await Appointment.findOneAndUpdate(
    { _id: req.params.id, patientId: req.user._id, status: 'completed', review: null },
    { review: { rating, comment } },
    { returnDocument: 'after' },
  );
  if (!appt) throw new AppError(400, 'You can review a visit once, after it is completed.');
  // Running average, updated atomically in one pipeline.
  await Doctor.updateOne({ _id: appt.doctorId }, [{ $set: {
    rating: { $divide: [{ $add: [{ $multiply: ['$rating', '$totalReviews'] }, rating] }, { $add: ['$totalReviews', 1] }] },
    totalReviews: { $add: ['$totalReviews', 1] },
  } }], { updatePipeline: true });
  res.status(201).json({ appointment: appt });
});

router.get('/appointments/:id/prescription.pdf', requireUser, async (req, res) => {
  const appt = await visibleAppointment(req);
  if (!appt.prescription) throw new AppError(404, 'No prescription for this visit yet.');
  const [doctor, patient] = await Promise.all([Doctor.findById(appt.doctorId), User.findById(appt.patientId)]);
  prescriptionPdf(res, appt, doctor, patient);
});

// ---- doctor ----

router.get('/doctors/me/queue', requireRole('doctor'), async (req, res) => {
  const doctor = await Doctor.mine(req.user);
  const date = todayIST();
  await queue.ensure(doctor._id, date);
  const ids = await queue.order(doctor._id, date);
  const appts = await Appointment.find({ _id: { $in: ids } }).populate('patientId', 'name phone'); // one query, not one per patient
  const byId = new Map(appts.map((a) => [a.id, a]));
  const current = await Appointment.findOne({ doctorId: doctor._id, date, calledAt: { $ne: null }, status: 'confirmed' })
    .sort({ calledAt: -1 }).populate('patientId', 'name phone');
  res.json({ date, current, waiting: ids.map((id) => byId.get(id)).filter(Boolean) });
});

router.post('/doctors/me/queue/next', requireRole('doctor'), async (req, res) => {
  const doctor = await Doctor.mine(req.user);
  res.json({ called: await service.callNext(doctor, todayIST(), req.id) });
});

router.post('/appointments/:id/prescription', requireRole('doctor'), validate(z.object({
  medicines: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    dosage: z.string().trim().max(100).optional(),
    duration: z.string().trim().max(100).optional(),
    instructions: z.string().trim().max(300).optional(),
  })).min(1, 'Add at least one medicine').max(20),
  notes: z.string().trim().max(2000).optional(),
})), async (req, res) => {
  const appt = await visibleAppointment(req);
  if (appt.status !== 'confirmed') throw new AppError(400, 'Only a paid, open visit can get a prescription.');
  Object.assign(appt, { prescription: req.valid, status: 'completed', calledAt: appt.calledAt ?? new Date() });
  await appt.save();
  await queue.remove(appt);
  await service.broadcastQueue(appt.doctorId, appt.date);
  res.status(201).json({ appointment: appt });
});

module.exports = router;
