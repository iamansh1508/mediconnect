const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const app = express();
const { AppError } = require('./shared/utils');

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5181',
  'http://127.0.0.1:5181',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(require('express-session')({
  secret: process.env.SESSION_SECRET || 'fallback-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' },
}));
app.use(require('passport').initialize());
app.use(require('passport').session());

// Explicit route imports - no fallbacks to expose startup errors
const authRoutes = require('./modules/auth/auth.routes');
const doctorRoutes = require('./modules/doctor/doctor.routes');
const bookingRoutes = require('./modules/booking/booking.routes');
const paymentRoutes = require('./modules/payment/payment.routes');
const queueRoutes = require('./modules/booking/queue.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const prescriptionRoutes = require('./modules/booking/prescription.routes');

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/appointments', bookingRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/queue', queueRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/prescriptions', prescriptionRoutes);

// Centralized error handler from shared middleware
const { errorHandler } = require('./shared/middleware');
app.use(errorHandler);

module.exports = app;
