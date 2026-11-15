const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const redis = require('./shared/redis');
const { AppError, requestLog, errorHandler } = require('./shared/http');

const app = express();
app.set('trust proxy', 1); // one proxy in front (nginx or the host's load balancer), so req.ip is the real client

app.use(requestLog);
app.use(require('./modules/payment/payment.routes').webhook); // needs the raw body: before express.json()
app.use(express.json({ limit: '100kb' }));

app.get('/health', async (req, res) => {
  const mongo = mongoose.connection.readyState === 1;
  const cache = redis.status === 'ready' && (await redis.ping().catch(() => null)) === 'PONG';
  res.status(mongo && cache ? 200 : 503).json({ mongo, redis: cache });
});

for (const m of ['auth', 'doctor', 'booking', 'payment', 'admin']) app.use('/api/v1', require(`./modules/${m}/${m}.routes`));
app.use('/api', (req, res, next) => next(new AppError(404, 'Not found.')));

// The API also serves the built React app, so the site and API share one origin:
// no CORS setup, and the login cookies stay first-party.
const dist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(dist, { index: false }));
app.get('/{*path}', (req, res, next) => res.sendFile(path.join(dist, 'index.html'), (e) => e && next(new AppError(404, 'Not found.'))));

app.use(errorHandler);

module.exports = app;
