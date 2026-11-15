const router = require('express').Router();
const { z } = require('zod');
const Doctor = require('./Doctor.model');
const Appointment = require('../booking/Appointment.model');
const redis = require('../../shared/redis');
const { openSlots } = require('../booking/booking.service');
const { AppError, objectId, validate, todayIST } = require('../../shared/http');
const { requireRole } = require('../../shared/auth');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const PUBLIC = '-schedule -userId -__v';

const km = ([lng1, lat1], [lng2, lat2]) => { // haversine
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(a)) * 10) / 10;
};
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- public ----

const searchQuery = z.object({
  q: z.string().trim().max(60).optional(),
  specialty: z.string().trim().max(60).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(100).default(10),
  cursor: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get('/doctors', validate(searchQuery, 'query'), async (req, res) => {
  const { q, specialty, minRating, lat, lng, radiusKm, cursor, limit } = req.valid;
  const cacheKey = `search:${JSON.stringify(req.valid)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return res.type('json').send(cached);

  const filter = { status: 'approved' };
  if (q) filter.$or = ['name', 'specialty', 'clinicName'].map((f) => ({ [f]: new RegExp(escape(q), 'i') })); // ponytail: regex scan, fine for thousands of doctors; move to Atlas Search beyond that
  if (specialty) filter.specialty = specialty;
  if (minRating) filter.rating = { $gte: minRating };
  if (lat !== undefined && lng !== undefined) filter.location = { $geoWithin: { $centerSphere: [[lng, lat], radiusKm / 6378.1] } };
  // Cursor on _id, not skip(): skip still walks every skipped document, so deep pages get slower.
  if (cursor) filter._id = { $gt: cursor };

  const docs = await Doctor.find(filter).sort({ _id: 1 }).limit(limit + 1).select(PUBLIC).lean();
  const page = docs.slice(0, limit);
  const nextCursor = docs.length > limit ? String(page.at(-1)._id) : null;
  if (lat !== undefined && lng !== undefined) {
    page.forEach((d) => { d.distanceKm = km([lng, lat], d.location.coordinates); });
    page.sort((a, b) => a.distanceKm - b.distanceKm); // ponytail: nearest-first within a page only
  }
  const body = JSON.stringify({ doctors: page, nextCursor });
  // A doctor's edits can show up to 60 seconds late; that is fine for search, and it keeps repeated
  // identical searches off the database.
  await redis.set(cacheKey, body, { EX: 60 });
  res.type('json').send(body);
});

router.get('/doctors/specialties', async (req, res) => {
  res.json({ specialties: (await Doctor.distinct('specialty', { status: 'approved' })).filter(Boolean).sort() });
});

// ---- doctor's own profile (before /doctors/:id so "me" isn't read as an id) ----

const myDoctor = async (req) => (await Doctor.findOne({ userId: req.user._id })) ?? Promise.reject(new AppError(404, 'Doctor profile not found.'));

router.get('/doctors/me', requireRole('doctor'), async (req, res) => res.json({ doctor: await myDoctor(req) }));

router.put('/doctors/me', requireRole('doctor'), validate(z.object({
  specialty: z.string().trim().min(2).max(60).optional(),
  consultationFee: z.number().int().min(0).max(100000).optional(),
  clinicName: z.string().trim().max(100).optional(),
  address: z.string().trim().max(300).optional(),
  bio: z.string().trim().max(2000).optional(),
  slotMinutes: z.number().int().min(5).max(120).optional(),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  nmcRegistrationNumber: z.string().trim().max(30).optional(),
})), async (req, res) => {
  const doctor = await myDoctor(req);
  const { location, ...fields } = req.valid;
  Object.assign(doctor, fields);
  if (location) doctor.location = { type: 'Point', coordinates: [location.lng, location.lat] };
  // MOCKED license check. A real one would look the number up in the National Medical Commission
  // register; there is no public API for it, so this only checks the format.
  if (fields.nmcRegistrationNumber !== undefined) doctor.isNmcVerified = /^NMC\d{6,}$/i.test(fields.nmcRegistrationNumber);
  await doctor.save();
  res.json({ doctor });
});

router.put('/doctors/me/schedule', requireRole('doctor'), validate(z.object({ date, from: hhmm, to: hhmm })), async (req, res) => {
  const { date: day, from, to } = req.valid;
  if (day < todayIST()) throw new AppError(400, 'That day has already passed.');
  const doctor = await myDoctor(req);
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const slots = [];
  for (let m = toMin(from); m + doctor.slotMinutes <= toMin(to); m += doctor.slotMinutes) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  if (!slots.length) throw new AppError(400, `"To" must be at least ${doctor.slotMinutes} minutes after "From".`);
  // Replace that day's hours, and drop days that have passed.
  doctor.schedule = [...doctor.schedule.filter((d) => d.date !== day && d.date >= todayIST()), { date: day, slots }]
    .sort((a, b) => a.date.localeCompare(b.date));
  await doctor.save();
  res.json({ schedule: doctor.schedule });
});

router.delete('/doctors/me/schedule/:date', requireRole('doctor'), async (req, res) => {
  const doctor = await myDoctor(req);
  doctor.schedule = doctor.schedule.filter((d) => d.date !== req.params.date);
  await doctor.save();
  res.json({ schedule: doctor.schedule });
});

router.get('/doctors/me/appointments', requireRole('doctor'), validate(z.object({ date: date.optional() }), 'query'), async (req, res) => {
  const doctor = await myDoctor(req);
  const appointments = await Appointment.find({ doctorId: doctor._id, date: req.valid.date ?? todayIST(), status: { $ne: 'cancelled' } })
    .sort({ time: 1 }).populate('patientId', 'name phone');
  res.json({ appointments });
});

router.get('/doctors/me/patients/:patientId', requireRole('doctor'), async (req, res) => {
  const doctor = await myDoctor(req);
  const visits = await Appointment.find({ doctorId: doctor._id, patientId: req.params.patientId, status: { $ne: 'cancelled' } })
    .sort({ date: -1, time: -1 }).populate('patientId', 'name phone email');
  if (!visits.length) throw new AppError(404, 'No visits with this patient.');
  res.json({ patient: visits[0].patientId, visits });
});

// ---- public, by id ----

router.get('/doctors/:id', async (req, res) => {
  const doctor = await Doctor.findOne({ _id: req.params.id, status: 'approved' }).select(PUBLIC);
  if (!doctor) throw new AppError(404, 'Doctor not found.');
  const reviews = await Appointment.find({ doctorId: doctor._id, review: { $ne: null } })
    .sort({ 'review.createdAt': -1 }).limit(10).select('review patientId').populate('patientId', 'name');
  res.json({
    doctor,
    // First name only: reviews are public.
    reviews: reviews.map((a) => ({ ...a.review.toObject(), patientName: a.patientId?.name.split(' ')[0] })),
  });
});

router.get('/doctors/:id/slots', validate(z.object({ date }), 'query'), async (req, res) => {
  const doctor = await Doctor.findOne({ _id: req.params.id, status: 'approved' });
  if (!doctor) throw new AppError(404, 'Doctor not found.');
  const days = doctor.schedule.filter((d) => d.date >= todayIST()).map((d) => d.date);
  res.json({ date: req.valid.date, slots: await openSlots(doctor, req.valid.date), days });
});

module.exports = router;
