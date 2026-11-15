const { z } = require('zod');

// Zod schema for registration validation
const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['patient', 'doctor'], { message: 'Role must be patient or doctor' }),
  specialty: z.string().optional()
});

// Zod schema for login validation
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

// Zod schema for refresh token validation
const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

// Middleware to validate request body against a Zod schema
function validateRequest(schema) {
  return async function (req, res, next) {
    try {
      const validationResult = await schema.parseAsync(req.body);
      req.body = validationResult;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(function (err) {
          return {
            field: err.path.join('.'),
            message: err.message
          };
        });
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors,
            statusCode: 400
          }
        });
      }
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid request',
          statusCode: 400
        }
      });
    }
  };
}

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  validateRequest
};
