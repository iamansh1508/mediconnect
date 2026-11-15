// Async route-handler utility.
// Wraps async route handlers and forwards errors to next if available.
const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch((err) => {
    // Log full error for debugging so stack traces surface in server logs.
    // eslint-disable-next-line no-console
    console.error('asyncHandler caught:', err && err.stack ? err.stack : err);

    // Some call sites may invoke the wrapped function without an Express 'next'.
    // Guard to avoid "next is not a function" runtime errors and still return 500.
    if (typeof next === 'function') return next(err);
    try {
      // Best-effort JSON error response when next isn't available.
      return res.status(500).json({ message: err && err.message ? err.message : 'Internal Server Error' });
    } catch (e) {
      // If even sending response fails, log and swallow to avoid crashing.
      // ponytail: logging only; add structured logger when needed.
      // eslint-disable-next-line no-console
      console.error('asyncHandler: failed to send error response', err);
    }
  });
};

module.exports = asyncHandler;

