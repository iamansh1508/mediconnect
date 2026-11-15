const router = require('express').Router();
const { z } = require('zod');
const User = require('../auth/User.model');
const Doctor = require('../doctor/Doctor.model');
const Appointment = require('../booking/Appointment.model');
const { getQueue } = require('../../shared/notify');
const { AppError, validate, escapeRegex, todayIST } = require('../../shared/http');
const { requireRole } = require('../../shared/auth');

router.use('/admin', requireRole('admin'));

router.get('/admin/stats', async (req, res) => {
  const weekAgo = new Date(Date.now() - 6 * 86400e3).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 10);
  const count = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const [users, doctors, [appts]] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    Doctor.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Appointment.aggregate([{ $facet: {
      byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
      revenue: [{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$fee' } } }],
      rating: [{ $match: { review: { $ne: null } } }, { $group: { _id: null, avg: { $avg: '$review.rating' }, n: { $sum: 1 } } }],
      perDay: [{ $match: { date: { $gte: weekAgo, $lte: todayIST() }, status: { $ne: 'cancelled' } } }, { $group: { _id: '$date', n: { $sum: 1 } } }, { $sort: { _id: 1 } }],
    } }]),
  ]);
  res.json({
    users: count(users),
    doctors: count(doctors),
    appointments: count(appts.byStatus),
    revenue: appts.revenue[0]?.total ?? 0,
    averageRating: appts.rating[0] ? Math.round(appts.rating[0].avg * 10) / 10 : null,
    reviews: appts.rating[0]?.n ?? 0,
    perDay: appts.perDay.map((d) => ({ date: d._id, appointments: d.n })),
  });
});

router.get('/admin/doctors', validate(z.object({ status: z.enum(['pending', 'approved', 'rejected']).default('pending') }), 'query'), async (req, res) => {
  const doctors = await Doctor.find({ status: req.valid.status }).sort({ createdAt: 1 }).limit(100).populate('userId', 'email phone');
  res.json({ doctors });
});

router.patch('/admin/doctors/:id', validate(z.object({ status: z.enum(['approved', 'rejected']) })), async (req, res) => {
  const doctor = await Doctor.findByIdAndUpdate(req.params.id, { status: req.valid.status }, { returnDocument: 'after' });
  if (!doctor) throw new AppError(404, 'Doctor not found.');
  res.json({ doctor });
});

router.get('/admin/users', validate(z.object({ q: z.string().trim().max(60).optional(), role: z.enum(['patient', 'doctor', 'admin']).optional() }), 'query'), async (req, res) => {
  const { q, role } = req.valid;
  const filter = role ? { role } : {};
  if (q) filter.$or = [{ name: new RegExp(escapeRegex(q), 'i') }, { email: q.toLowerCase() }];
  res.json({ users: await User.find(filter).sort({ createdAt: -1 }).limit(100) });
});

router.patch('/admin/users/:id', validate(z.object({ isActive: z.boolean() })), async (req, res) => {
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, role: { $ne: 'admin' } },
    // Bumping tokenVersion signs a banned user out of every session immediately.
    { isActive: req.valid.isActive, $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' },
  );
  if (!user) throw new AppError(404, 'User not found, or is an admin.');
  res.json({ user });
});

// Notifications that failed all 5 tries (the dead-letter set).
router.get('/admin/notifications/failed', async (req, res) => {
  const jobs = await getQueue().getFailed(0, 49);
  res.json({ jobs: jobs.map((j) => ({ id: j.id, name: j.name, to: j.data.phone || j.data.email, error: j.failedReason, attempts: j.attemptsMade, failedAt: j.finishedOn })) });
});

router.post('/admin/notifications/:id/retry', async (req, res) => {
  const job = await getQueue().getJob(req.params.id);
  if (!job || !(await job.isFailed())) throw new AppError(404, 'No failed notification with that id.');
  await job.retry();
  res.json({ message: 'Queued again.' });
});

module.exports = router;
