const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const redis = require('./redis');
const { getCookie } = require('./http');
const { userFromAccessToken } = require('./auth');
const log = require('./log');

let io;
let pubsub = [];

// Rooms: user:<userId> for personal events, queue:<doctorId>:<date> for a live queue.
async function attach(server) {
  // WebSocket only, so a load balancer needs no sticky sessions (long-polling would need them).
  io = new Server(server, { transports: ['websocket'] });

  // Every API copy publishes its events through Redis, so a patient connected to copy A
  // still hears a "Call next" handled by copy B.
  const pub = redis.duplicate();
  const sub = redis.duplicate();
  await Promise.all([pub.connect(), sub.connect()]);
  pubsub = [pub, sub];
  io.adapter(createAdapter(pub, sub));

  io.use(async (socket, next) => {
    const user = await userFromAccessToken(getCookie(socket.request.headers.cookie, 'accessToken')).catch(() => null);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    socket.join(`user:${user.id}`);
    next();
  });

  io.on('connection', (socket) => {
    // A patient may only watch the queue of their own paid appointment;
    // a doctor may only watch their own queue.
    socket.on('queue:watch', async (appointmentId, ack = () => {}) => {
      try {
        const { watchRoom } = require('../modules/booking/booking.service');
        const room = await watchRoom(socket.data.user, appointmentId);
        if (!room) return ack({ error: 'You cannot watch this queue.' });
        socket.join(room.name);
        ack({ order: room.order });
      } catch (e) {
        log.warn('queue:watch failed', { err: e.message });
        ack({ error: 'You cannot watch this queue.' });
      }
    });
  });
}

const emit = (room, event, data) => io?.to(room).emit(event, data);

async function close() {
  await io?.close();
  await Promise.all(pubsub.map((c) => c.quit()));
}

module.exports = { attach, emit, close };
