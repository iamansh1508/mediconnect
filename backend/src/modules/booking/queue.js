// The live queue for one doctor on one day is a Redis sorted set, scored by slot time (minutes since
// midnight). Joining, looking up a position and calling the next patient are all O(log N); the
// alternative, a position field on every appointment, means rewriting N documents on every call.
const redis = require('../../shared/redis');
const Appointment = require('./Appointment.model');

const key = (doctorId, date) => `queue:${doctorId}:${date}`;
const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

async function join(appt) {
  const k = key(appt.doctorId, appt.date);
  await redis.zAdd(k, { score: minutes(appt.time), value: String(appt._id) });
  await redis.expire(k, 3 * 86400);
}

const remove = (appt) => redis.zRem(key(appt.doctorId, appt.date), String(appt._id));
const order = (doctorId, date) => redis.zRange(key(doctorId, date), 0, -1);

async function position(appt) {
  const rank = await redis.zRank(key(appt.doctorId, appt.date), String(appt._id));
  return rank === null ? null : rank + 1;
}

async function popNext(doctorId, date) {
  const top = await redis.zPopMin(key(doctorId, date));
  return top?.value ?? null;
}

// MongoDB is the record; Redis only holds the order. If Redis lost the set (restart without
// persistence), rebuild it from paid appointments nobody has called yet.
async function ensure(doctorId, date) {
  if (await redis.exists(key(doctorId, date))) return;
  const waiting = await Appointment.find({ doctorId, date, status: 'confirmed', calledAt: null }).select('doctorId date time');
  for (const a of waiting) await join(a);
}

module.exports = { join, remove, order, position, popNext, ensure, key };
