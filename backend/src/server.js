require('./env');
const http = require('http');
const mongoose = require('mongoose');
const redis = require('./shared/redis');
const socket = require('./shared/socket');
const log = require('./shared/log');
const app = require('./app');

(async () => {
  await Promise.all([mongoose.connect(process.env.MONGODB_URI), redis.connect()]);
  const server = http.createServer(app);
  await socket.attach(server);
  // Small deployments can run the notification worker inside the API process instead of separately.
  if (process.env.RUN_WORKER_IN_API === 'true') require('./worker');
  const port = Number(process.env.PORT) || 5000;
  server.listen(port, () => log.info('api listening', { port }));
  // On deploy or scale-down, stop taking new connections and let in-flight requests finish.
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
})().catch((e) => {
  log.error('startup failed', { err: e.message });
  process.exit(1);
});
