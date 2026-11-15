const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');

// Initiate payment order
router.post('/initiate', paymentController.initiatePayment);

// Razorpay webhook - public endpoint (no JWT required for webhook delivery)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
