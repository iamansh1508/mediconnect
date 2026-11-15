const express = require('express');
const router = express.Router();
const { verifyJWT, restrictTo } = require('../../shared/middleware');
const {
  pendingDoctors,
  approveDoctor,
  rejectDoctor,
  analytics,
  listUsers,
  banUser,
  unbanUser,
} = require('./admin.controller');

// Admin area — require admin role.
router.use(verifyJWT, restrictTo('admin'));

router.get('/', (req, res) => res.json({ message: 'Admin root', user: req.user }));

// Doctor approval endpoints
router.get('/doctors/pending', pendingDoctors);
router.put('/doctors/:id/approve', approveDoctor);
router.put('/doctors/:id/reject', rejectDoctor);

// Analytics endpoint
router.get('/analytics', analytics);

// User management endpoints
router.get('/users', listUsers);
router.put('/users/:id/ban', banUser);
router.put('/users/:id/unban', unbanUser);

module.exports = router;

