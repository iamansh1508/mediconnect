const Appointment = require('./Appointment.model');
const Doctor = require('../doctor/Doctor.model');
const User = require('../auth/User.model');
const queue = require('./queue');
const redis = require('../../shared/redis');
const gateway = require('../payment/razorpay');
const { notify } = require('../../shared/notify');
const { emit } = require('../../shared/socket');
const { AppError, nowIST } = require('../../shared/http');
const log = require('../../shared/log');

const { LIVE } = Appointment;
const HOLD_MS = 15 * 60 * 1000;

// An unpaid booking holds the slot for 15 minutes, then anyone may take it.
const isExpiredHold = (a) => a.status === 'booked' && Date.now() - a.createdAt.getTime() > HOLD_MS;

async function openSlots(doctor, date) {
  const day = doctor.schedule.find((d) => d.date === date);
  if (!day) return [];
  const taken = await Appointment.find({ doctorId: doctor._id, date, status: { $in: LIVE } }).select('time status createdAt');
  const busy = new Set(taken.filter((a) => !isExpiredHold(a)).map((a) => a.time));
  const now = nowIST();
  return day.slots.filter((t) => !busy.has(t) && `${date} ${t}` > now);
}

async function book(patient, { doctorId, date, time }) {
  const doctor = await Doctor.findOne({ _id: doctorId, status: 'approved' });
  if (!doctor) throw new AppError(404, 'Doctor not found.');
  if (!doctor.schedule.find((d) => d.date === date)?.slots.includes(time)) throw new AppError(400, 'The doctor is not available at that time.');
  if (`${date} ${time}` <= nowIST()) throw new AppError(400, 'That time has already passed.');

  const busy = new AppError(409, 'Someone else is booking this slot right now. Pick another time or try again.');
  return redis.withLock(`lock:booking:${doctorId}:${date}:${time}`, 5000, async () => {
    const existing = await Appointment.findOne({ doctorId, date, time, status: { $in: LIVE } });
    if (existing && !isExpiredHold(existing)) throw new AppError(409, 'That slot was just booked. Pick another time.');
    if (existing) await Appointment.updateOne({ _id: existing._id, status: 'booked' }, { status: 'cancelled' });
    try {
      return await Appointment.create({ patientId: patient._id, doctorId, date, time, fee: doctor.consultationFee });
    } catch (e) {
      if (e.code === 11000) throw new AppError(409, 'That slot was just booked. Pick another time.');
      throw e;
    }
  }, busy);
}

async function broadcastQueue(doctorId, date) {
  emit(`queue:${doctorId}:${date}`, 'queue:update', { order: await queue.order(doctorId, date) });
}

// Called by both the checkout callback and Razorpay's webhook; whichever arrives first wins,
// and the conditional update makes the second a no-op.
async function markPaid(orderId, paymentId, requestId) {
  const appt = await Appointment.findOneAndUpdate(
    { orderId, status: 'booked', paymentStatus: 'pending' },
    { status: 'confirmed', paymentStatus: 'paid', paymentId },
    { returnDocument: 'after' },
  );
  if (!appt) {
    const existing = await Appointment.findOne({ orderId });
    // Paid after the 15-minute hold ran out and someone else took the slot: give the money back.
    if (existing?.status === 'cancelled' && existing.paymentStatus === 'pending') {
      await gateway.refund(paymentId);
      Object.assign(existing, { paymentId, paymentStatus: 'refunded' });
      await existing.save();
      log.warn('late payment refunded', { orderId, requestId });
    }
    return existing;
  }
  await queue.join(appt);
  await broadcastQueue(appt.doctorId, appt.date);
  const [patient, doctor] = await Promise.all([User.findById(appt.patientId), Doctor.findById(appt.doctorId)]);
  await notify('appointment.confirmed', {
    phone: patient.phone,
    text: `MediConnect: booked with Dr. ${doctor.name} on ${appt.date} at ${appt.time}. Fee paid: Rs ${appt.fee}.`,
  }, { jobId: `confirmed-${appt.id}`, requestId });
  return appt;
}

async function cancel(appt, requestId) {
  if (!['booked', 'confirmed'].includes(appt.status)) throw new AppError(400, 'This appointment can no longer be cancelled.');
  if (appt.calledAt) throw new AppError(400, 'The doctor has already called you in.');
  const updated = await Appointment.findOneAndUpdate({ _id: appt._id, status: appt.status }, { status: 'cancelled' }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'This appointment just changed. Refresh and try again.');
  if (updated.paymentStatus === 'paid') {
    await gateway.refund(updated.paymentId);
    updated.paymentStatus = 'refunded';
    await updated.save();
    log.info('refund issued', { appointment: updated.id, requestId });
  }
  await queue.remove(updated);
  await broadcastQueue(updated.doctorId, updated.date);
  return updated;
}

async function callNext(doctor, date, requestId) {
  await queue.ensure(doctor._id, date);
  const id = await queue.popNext(doctor._id, date);
  if (!id) return null;
  // ponytail: if Redis restarts between pop and this update, ensure() may re-add this patient; the doctor just calls again.
  const appt = await Appointment.findByIdAndUpdate(id, { calledAt: new Date() }, { returnDocument: 'after' }).populate('patientId', 'name phone');
  emit(`user:${appt.patientId._id}`, 'queue:called', { appointmentId: id });
  await broadcastQueue(doctor._id, date);

  await notify('queue.called', { phone: appt.patientId.phone, text: `MediConnect: it's your turn with Dr. ${doctor.name}. Please go in.` }, { jobId: `called-${id}`, requestId });
  const [nextId] = await queue.order(doctor._id, date);
  if (nextId) {
    const next = await Appointment.findById(nextId).populate('patientId', 'phone');
    await notify('queue.next', { phone: next.patientId.phone, text: `MediConnect: you're next for Dr. ${doctor.name}. Please be ready.` }, { jobId: `next-${nextId}`, requestId });
  }
  return appt;
}

// Which queue room a socket may join, or null.
async function watchRoom(user, appointmentId) {
  if (user.role === 'doctor') {
    const doctor = await Doctor.findOne({ userId: user._id });
    const date = nowIST().slice(0, 10);
    return doctor && { name: `queue:${doctor._id}:${date}`, order: await queue.order(doctor._id, date) };
  }
  const appt = await Appointment.findOne({ _id: appointmentId, patientId: user._id, status: 'confirmed' });
  if (!appt) return null;
  await queue.ensure(appt.doctorId, appt.date);
  return { name: `queue:${appt.doctorId}:${appt.date}`, order: await queue.order(appt.doctorId, appt.date) };
}

module.exports = { book, openSlots, markPaid, cancel, callNext, watchRoom, isExpiredHold, broadcastQueue };
