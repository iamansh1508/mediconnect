// One JSON line per event, so logs from every API copy and the worker can be searched together.
const quiet = process.env.NODE_ENV === 'test';
const line = (level) => (msg, extra = {}) => {
  if (quiet && level !== 'error') return;
  console[level === 'info' ? 'log' : level](JSON.stringify({ time: new Date().toISOString(), level, msg, ...extra }));
};

module.exports = { info: line('info'), warn: line('warn'), error: line('error') };
