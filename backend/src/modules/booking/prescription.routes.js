const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../../shared/middleware');
const controller = require('../../controllers/prescription.controller');

// All prescription routes require authentication.
router.use(verifyJWT);

// POST /api/v1/prescriptions
router.post('/', controller.createPrescription);

// GET /api/v1/prescriptions/:prescriptionId
router.get('/:prescriptionId', controller.getPrescription);

module.exports = router;
