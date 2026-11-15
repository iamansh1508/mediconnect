const express = require('express');
const router = express.Router();
const { verifyJWT, restrictTo } = require('../../shared/middleware');
const queueController = require('./queue.controller');

// All queue routes require authentication.
router.use(verifyJWT);

// GET /api/v1/queue/:appointmentId/position?date=YYYY-MM-DD
router.get('/:appointmentId/position', queueController.getPosition);

// POST /api/v1/queue/call-next
// Only doctors can call the next patient.
router.post('/call-next', restrictTo('doctor', 'admin'), queueController.callNext);

// GET /api/v1/queue/list?date=YYYY-MM-DD
// Accessible to doctors to view their queue.
router.get('/list', restrictTo('doctor', 'admin'), queueController.getQueueList);

module.exports = router;
