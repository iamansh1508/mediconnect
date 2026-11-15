// Demo data: 33 made-up doctors around Bengaluru, demo logins, and a live queue for today.
// WIPES MongoDB and the app's Redis database first (so no cached search or old queue survives). Usage: npm run seed  (refuses in production unless --force)
require('../src/env');
const mongoose = require('mongoose');
const User = require('../src/modules/auth/User.model');
const Doctor = require('../src/modules/doctor/Doctor.model');
const Appointment = require('../src/modules/booking/Appointment.model');
const redis = require('../src/shared/redis');
const { hashPassword } = require('../src/shared/auth');
const { todayIST } = require('../src/shared/http');

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to wipe a production database. Pass --force if you really mean it.');
  process.exit(1);
}

let seed = 42; // fixed seed: the same data every run
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (a) => a[Math.floor(rand() * a.length)];

const FIRST = ['Aarav', 'Ananya', 'Vikram', 'Meera', 'Rohan', 'Kavya', 'Arjun', 'Isha', 'Karan', 'Neha', 'Rahul', 'Priya', 'Sameer', 'Divya', 'Aditya', 'Pooja', 'Nikhil', 'Sneha', 'Varun', 'Riya'];
const LAST = ['Sharma', 'Iyer', 'Reddy', 'Nair', 'Gupta', 'Rao', 'Menon', 'Kulkarni', 'Patel', 'Das', 'Bhat', 'Joshi'];
const SPECIALTIES = ['General Physician', 'Pediatrics', 'Dermatology', 'Cardiology', 'Orthopedics', 'Gynecology', 'ENT', 'Psychiatry', 'Dentistry', 'Ophthalmology'];
const AREAS = [['Koramangala', 12.9352, 77.6245], ['Indiranagar', 12.9784, 77.6408], ['Jayanagar', 12.925, 77.5938], ['Whitefield', 12.9698, 77.75],
  ['HSR Layout', 12.9116, 77.6389], ['Malleshwaram', 13.0031, 77.5643], ['BTM Layout', 12.9166, 77.6101], ['Hebbal', 13.0358, 77.597]];
const COMMENTS = ['Listened carefully and explained everything.', 'Short wait, clear advice.', 'Very kind with my child.', 'Good doctor, clinic was crowded.', 'Sorted out my problem in one visit.'];

const day = (offset) => new Date(Date.parse(todayIST()) + offset * 86400e3).toISOString().slice(0, 10);
const times = (from, to, step = 15) => {
  const out = [];
  for (let m = from * 60; m < to * 60; m += step) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return out;
};
const week = () => Array.from({ length: 7 }, (_, i) => ({ date: day(i), slots: [...times(9, 13), ...times(17, 20)] }));

(async () => {
  await Promise.all([mongoose.connect(process.env.MONGODB_URI), redis.connect()]);
  await Promise.all([mongoose.connection.dropDatabase(), redis.flushdb()]);
  await Promise.all([User, Doctor, Appointment].map((m) => m.init()));
  const password = await hashPassword('demo1234');
  const user = (fields) => User.create({ password, isEmailVerified: true, phone: `98${String(Math.floor(rand() * 1e8)).padStart(8, '0')}`, ...fields });

  await user({ name: 'Admin', email: 'admin@mediconnect.demo', role: 'admin' });
  const demoPatient = await user({ name: 'Asha Patil', email: 'patient@mediconnect.demo' });
  const others = await Promise.all(['Ravi K', 'Sunita M', 'Imran S', 'Lakshmi V', 'Joseph D'].map((name, i) => user({ name, email: `patient${i + 1}@mediconnect.demo` })));

  const doctors = [];
  for (let i = 0; i < 33; i += 1) {
    const demo = i === 0;
    const name = demo ? 'Meera Iyer' : `${pick(FIRST)} ${pick(LAST)}`;
    const [area, lat, lng] = demo ? AREAS[0] : pick(AREAS);
    const u = await user({ name, role: 'doctor', email: demo ? 'doctor@mediconnect.demo' : `doctor${i}@mediconnect.demo` });
    doctors.push(await Doctor.create({
      userId: u._id, name,
      specialty: demo ? 'General Physician' : pick(SPECIALTIES),
      consultationFee: demo ? 500 : 300 + Math.floor(rand() * 10) * 100,
      clinicName: `${name.split(' ')[1]} Clinic, ${area}`,
      address: `${1 + Math.floor(rand() * 200)}, ${Math.floor(rand() * 20) + 1}th Main, ${area}, Bengaluru`,
      bio: 'Made-up demo doctor. Not a real person.',
      location: { type: 'Point', coordinates: [lng + (rand() - 0.5) * 0.03, lat + (rand() - 0.5) * 0.03] },
      schedule: week(),
      status: i >= 30 ? 'pending' : 'approved', // three waiting for the admin
      nmcRegistrationNumber: `NMC${100000 + i}`, isNmcVerified: true,
      rating: demo ? 0 : Math.round((3.6 + rand() * 1.4) * 10) / 10,
      totalReviews: demo ? 0 : Math.floor(rand() * 120),
    }));
  }

  // Past visits with reviews for the demo doctor.
  const demoDoctor = doctors[0];
  for (let i = 0; i < others.length; i += 1) {
    await Appointment.create({
      patientId: others[i]._id, doctorId: demoDoctor._id, date: day(-(i + 1)), time: '10:00', fee: 500,
      status: 'completed', paymentStatus: 'paid', paymentId: `pay_test_seed${i}`,
      prescription: { medicines: [{ name: 'Paracetamol 650 mg', dosage: '1 tablet twice a day', duration: '3 days' }], notes: 'Rest and fluids.' },
      review: { rating: [5, 4, 5, 3, 4][i], comment: COMMENTS[i] },
    });
  }
  await Doctor.updateOne({ _id: demoDoctor._id }, { rating: 4.2, totalReviews: others.length });

  // Today's queue for the demo doctor: three paid patients, with the demo patient second in line.
  // Slots well into the evening, so they are still ahead whenever the seed runs.
  const queue = [[others[0], '19:00'], [demoPatient, '19:15'], [others[1], '19:30']];
  for (const [p, time] of queue) {
    await Appointment.create({ patientId: p._id, doctorId: demoDoctor._id, date: day(0), time, fee: 500, status: 'confirmed', paymentStatus: 'paid', orderId: `order_test_seed_${time}`, paymentId: `pay_test_seed_${time}` });
  }
  // The live order lives in Redis; the API rebuilds it from these rows on first use.

  console.log(`Seeded ${doctors.length} doctors (3 pending approval), ${others.length + 1} patients, and a queue of ${queue.length} for today.`);
  console.log('Logins (password demo1234): patient@mediconnect.demo, doctor@mediconnect.demo, admin@mediconnect.demo');
  await Promise.all([mongoose.disconnect(), redis.quit()]);
})().catch((e) => { console.error(e); process.exit(1); });
