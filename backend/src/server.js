require('dotenv').config();
const http = require('http');
const app = require('./app');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;
let MONGODB_URI = process.env.MONGODB_URI;

async function startServer() {
  // Check email config early and warn
  try {
    const { checkEmailConfig } = require('./shared/email-config.check');
    checkEmailConfig();
  } catch (e) {
    console.warn('Email config checker failed to run:', e && e.message);
  }
  try {
    if (!MONGODB_URI || process.env.USE_INMEM === 'true') {
      console.log('Starting in-memory MongoDB for tests...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      MONGODB_URI = mongod.getUri();
      console.log('In-memory MongoDB URI:', MONGODB_URI.replace(/:\/\/.+?:/, '://<hidden>:'));
    }

    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const server = http.createServer(app);

    // Initialize Redis client if configured (used for OTP, locks, queue)
    try {
      const redisConfig = require('./shared/config/redis');
      if (redisConfig && typeof redisConfig.init === 'function' && process.env.REDIS_URL) {
        redisConfig.init().catch((e) => console.warn('Redis init failed:', e && e.message));
      }
    } catch (e) {
      console.warn('Failed to init redis module:', e && e.message);
    }

    // Initialize Socket.io (in-process). Gate Redis adapter if REDIS_URL set.
    try {
      const { configureSocket } = require('./shared/config/socket');
      configureSocket(server, app);
    } catch (e) {
      console.warn('Socket.io failed to initialize:', e && e.message);
    }

    server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

startServer();
