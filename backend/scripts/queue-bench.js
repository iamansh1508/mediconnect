// Why the queue is a Redis sorted set: compares "call next" and "what's my position?" with a queue of
// N patients, against the obvious alternative of a position field on every appointment document.
// Usage: node scripts/queue-bench.js [N=10000]
require('../src/env');
const mongoose = require('mongoose');
const redis = require('../src/shared/redis');

const N = Number(process.argv[2]) || 10000;
const ROUNDS = 200;
const time = async (fn) => { const t = performance.now(); for (let i = 0; i < ROUNDS; i += 1) await fn(i); return (performance.now() - t) / ROUNDS; };
const fmt = (ms) => `${ms.toFixed(3)} ms`;

(async () => {
  await Promise.all([mongoose.connect(process.env.MONGODB_URI), redis.connect()]);
  const key = 'bench:queue';
  await redis.del(key);
  for (let i = 0; i < N; i += 1000) {
    await redis.zAdd(key, Array.from({ length: Math.min(1000, N - i) }, (_, j) => ({ score: i + j, value: `appt${i + j}` })));
  }
  const coll = mongoose.connection.collection('bench_queue');
  await coll.drop().catch(() => {});
  await coll.insertMany(Array.from({ length: N }, (_, i) => ({ doctorId: 1, position: i + 1 })));
  await coll.createIndex({ doctorId: 1, position: 1 });

  const rank = await time((i) => redis.zRank(key, `appt${N - 1 - i}`));
  const pop = await time(() => redis.zPopMin(key));
  const docPos = await time((i) => coll.findOne({ doctorId: 1, position: N - i }));
  const docShift = await time(async () => { // call next = delete the first, then move everyone else up one
    await coll.deleteOne({ position: 1 });
    await coll.updateMany({ doctorId: 1 }, { $inc: { position: -1 } });
  });

  console.log(`Queue of ${N} patients, average of ${ROUNDS} runs:`);
  console.table({
    'Redis sorted set': { 'my position': fmt(rank), 'call next': fmt(pop) },
    'position field in MongoDB': { 'my position': fmt(docPos), 'call next': fmt(docShift) },
  });
  await redis.del(key);
  await coll.drop();
  await Promise.all([mongoose.disconnect(), redis.quit()]);
})().catch((e) => { console.error(e); process.exit(1); });
