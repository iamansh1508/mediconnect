/**
 * Global Error Handler Middleware
 * Handles errors across the application and returns consistent JSON responses.
 */

/**
 * Main error handler middleware.
 */
function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const errorCode = error.code || 'INTERNAL_SERVER_ERROR';
  
  // Log full stack trace for server-side errors, just message for client errors
  if (statusCode >= 500) {
    console.error(`[Server Error] ${errorCode}:`, error.stack);
  } else {
    console.warn(`[Client Error] ${errorCode}: ${error.message}`);
  }

  const response = {
    error: {
      code: errorCode,
      message: error.message || 'Something went wrong',
      statusCode: statusCode,
      timestamp: new Date().toISOString()
    }
  };

  return res.status(statusCode).json(response);
}

/**
 * Handles Zod validation errors and formats them into a consistent error response.
 */
function handleValidationError(error) {
  if (error && error.errors) {
    const details = [];
    for (let i = 0; i < error.errors.length; i = i + 1) {
      const err = error.errors[i];
      details.push({
        field: err.path.join('.'),
        message: err.message
      });
    }
    const formattedError = new Error('Validation failed');
    formattedError.statusCode = 400;
    formattedError.code = 'VALIDATION_ERROR';
    formattedError.details = details;
    return formattedError;
  }
  return error;
}

module.exports = {
  errorHandler,
  handleValidationError
};
