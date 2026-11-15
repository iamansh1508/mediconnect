/**
 * Socket.io Configuration
 * Sets up Socket.io server and Redis adapter (if REDIS_URL is configured).
 * Handles connection events and room subscriptions for real-time queue updates.
 */

function configureSocket(server, app) {
  const { Server } = require('socket.io');
  const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
  app.set('io', io);
  console.log('Socket.io initialized (in-process)');

  // Basic connection handler: authenticate via handshake auth.token (JWT) and join patient/doctor rooms.
  io.on('connection', async (socket) => {
    try {
      const token = socket.handshake?.auth?.token;
      if (!token) return;
      const jwt = require('jsonwebtoken');
      const User = require('../User.model');
      const Doctor = require('../../modules/doctor/Doctor.model');
      let decoded = null;
      try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'access-secret');
      } catch (_) { return; }
      if (!decoded || !decoded._id) return;
      const user = await User.findById(decoded._id).select('_id role');
      if (!user) return;

      // Join patient room
      socket.join('patient:' + user._id.toString());

      // If doctor, join their doctor room (doctor document _id)
      if (user.role === 'doctor') {
        const doc = await Doctor.findOne({ userId: user._id }).select('_id');
        if (doc && doc._id) socket.join('doctor:' + doc._id.toString());
      }

      // allow clients to explicitly join doctor rooms by id (auth required)
      socket.on('join:doctor', (doctorId) => {
        // sanity check doctorId format
        if (typeof doctorId === 'string' && doctorId.length > 5) socket.join('doctor:' + doctorId);
      });

      // Queue subscription events
      socket.on('subscribe_to_queue', ({ appointmentDate, appointmentId }) => {
        const roomName = 'queue:' + appointmentDate;
        socket.join(roomName);
        socket.data.appointmentId = appointmentId;
      });

      socket.on('unsubscribe_from_queue', ({ appointmentId }) => {
        const roomName = 'queue:' + appointmentDate;
        socket.leave(roomName);
      });

    } catch (e) {
      console.warn('Socket connection handler error', e && e.message);
    }
  });

  if (process.env.REDIS_URL) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      Promise.all([pubClient.connect(), subClient.connect()])
        .then(() => {
          io.adapter(createAdapter(pubClient, subClient));
          console.log('Socket.io Redis adapter configured');
        })
        .catch((e) => console.warn('Redis adapter connection failed:', e && e.message));
    } catch (e) {
      console.warn('Redis adapter package not installed. Install @socket.io/redis-adapter to enable multi-instance support.');
    }
  }
}

module.exports = { configureSocket };
