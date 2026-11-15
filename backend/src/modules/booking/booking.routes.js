const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../../shared/middleware');
const controller = require('./booking.controller');

// All booking routes require authentication.
router.use(verifyJWT);

// POST /api/v1/appointments/book
router.post('/book', controller.bookAppointment);

// GET /api/v1/appointments/my
router.get('/my', controller.myAppointments);

// GET /api/v1/appointments/:id/queue
router.get('/:id/queue', controller.getAppointmentQueuePosition);

// DELETE /api/v1/appointments/:id
router.delete('/:id', controller.cancelAppointment);

// GET /api/v1/prescriptions/:id/download
router.get('/prescriptions/:id/download', controller.downloadPrescription);

// POST /api/v1/reviews/:doctorId
router.post('/reviews/:doctorId', controller.postReview);

module.exports = router;

