// Sends queued SMS and email. Runs as its own process (npm run worker), so a slow or failing SMS
// provider never holds up a booking, and the worker can be restarted or scaled on its own.
require('./env');
const { Worker } = require('bullmq');
const { deliver, connection } = require('./shared/notify');
const log = require('./shared/log');

const worker = new Worker('notifications', deliver, { connection: connection(), concurrency: 5 });

worker.on('failed', (job, err) => log.warn('notification attempt failed', {
  name: job?.name, id: job?.id, attempt: job?.attemptsMade, final: job?.attemptsMade >= job?.opts.attempts, err: err.message, requestId: job?.data.requestId,
}));
worker.on('ready', () => log.info('worker ready'));

process.on('SIGTERM', async () => {
  await worker.close(); // finish the job in hand first
  process.exit(0);
});
