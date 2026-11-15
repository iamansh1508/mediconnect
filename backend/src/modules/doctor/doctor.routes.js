const express = require('express');
const router = express.Router();
const { verifyJWT, restrictTo } = require('../../shared/middleware');

// Focused controllers (split from monolithic doctor.controller.js)
const {
  listDoctors,
  nearbyDoctors,
  getDoctorById,
  searchDoctors,
  geospatialSearch,
  getMyProfile,
} = require('./controllers/search.controller');
const {
  setSchedule,
  getAvailableSlots,
  getMySchedule,
  deleteMySchedule,
} = require('./controllers/schedule.controller');
const { verifyNMC, verifyRegistration } = require('./controllers/verification.controller');

// Legacy controller for remaining endpoints (updateProfile, updateAvailability, etc.)
const legacyController = require('./doctor.controller');

// All doctor routes require authentication.
router.use(verifyJWT);

// Convenience: allow doctors to update their own profile via PUT /me
router.put('/me', restrictTo('doctor', 'admin'), legacyController.updateProfile);

// Public to authenticated users
router.get('/', listDoctors);
router.get('/search', searchDoctors); // Text search by name and bio
router.get('/nearby', nearbyDoctors);
router.get('/search/geo', geospatialSearch);

// Doctor-only endpoints
router.get('/me', restrictTo('doctor', 'admin'), getMyProfile);
router.get('/patients', restrictTo('doctor', 'admin'), legacyController.patientHistory);

// Doctor profile and actions
router.get('/profile', restrictTo('doctor', 'admin'), getMyProfile);
router.put('/profile', restrictTo('doctor', 'admin'), legacyController.updateProfile);
router.post('/verify-registration', restrictTo('doctor', 'admin'), verifyRegistration);
router.put('/availability', restrictTo('doctor', 'admin'), legacyController.updateAvailability);
router.post('/schedule', restrictTo('doctor', 'admin'), setSchedule);
router.get('/me/schedule', restrictTo('doctor', 'admin'), getMySchedule);
router.delete('/schedule/:scheduleId', restrictTo('doctor', 'admin'), deleteMySchedule);
router.get('/:doctorId/schedule', restrictTo('doctor', 'admin'), getAvailableSlots);
router.post('/verify-nmc', restrictTo('doctor', 'admin'), verifyNMC);
router.get('/appointments/today', restrictTo('doctor', 'admin'), legacyController.appointmentsToday);
router.put('/appointments/:id/call-next', restrictTo('doctor', 'admin'), legacyController.callNext);
router.post('/prescriptions', restrictTo('doctor', 'admin'), legacyController.createPrescription);
router.get('/patients/:id/history', restrictTo('doctor', 'admin'), legacyController.patientHistory);

router.get('/:id', getDoctorById);

module.exports = router;
