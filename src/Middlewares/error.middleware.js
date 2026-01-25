/**
 * Custom API Error class
 */
export class ApiError extends Error {
    constructor(statusCode, message, errors = [], stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.success = false;
        this.errors = errors;
        this.data = null;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends ApiError {
    constructor(message = 'Resource not found') {
        super(404, message);
    }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends ApiError {
    constructor(message = 'Bad request', errors = []) {
        super(400, message, errors);
    }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized access') {
        super(401, message);
    }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends ApiError {
    constructor(message = 'Access forbidden') {
        super(403, message);
    }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends ApiError {
    constructor(message = 'Resource already exists') {
        super(409, message);
    }
}

/**
 * Validation Error (422)
 */
export class ValidationError extends ApiError {
    constructor(errors = [], message = 'Validation failed') {
        super(422, message, errors);
    }
}

/**
 * Internal Server Error (500)
 */
export class InternalError extends ApiError {
    constructor(message = 'Internal server error') {
        super(500, message);
    }
}

/**
 * Async handler wrapper to catch errors in async routes
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 Not Found handler for undefined routes
 */
export const notFoundHandler = (req, res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
};

/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
    // Prevent calling next() in error handler - just send response
    if (res.headersSent) {
        return;
    }

    let error = err;

    // Log error for debugging
    if (process.env.NODE_ENV !== 'production') {
        console.error('Error:', {
            message: err?.message,
            stack: err?.stack,
            path: req?.path,
            method: req?.method
        });
    }

    try {
        // Handle Mongoose CastError (invalid ObjectId)
        if (err.name === 'CastError') {
            error = new BadRequestError(`Invalid ${err.path}: ${err.value}`);
        }

        // Handle Mongoose Validation Error
        if (err.name === 'ValidationError' && err.errors) {
            const errors = Object.values(err.errors).map(e => ({
                field: e.path,
                message: e.message
            }));
            error = new ValidationError(errors, 'Validation failed');
        }

        // Handle Mongoose Duplicate Key Error
        if (err.code === 11000 && err.keyValue) {
            const field = Object.keys(err.keyValue)[0];
            error = new ConflictError(`${field} already exists`);
        }

        // Handle JWT Errors
        if (err.name === 'JsonWebTokenError') {
            error = new UnauthorizedError('Invalid token');
        }

        if (err.name === 'TokenExpiredError') {
            error = new UnauthorizedError('Token expired');
        }

        // Handle Firebase Auth Errors
        if (err.code?.startsWith?.('auth/')) {
            const firebaseErrors = {
                'auth/id-token-expired': 'Token expired, please login again',
                'auth/id-token-revoked': 'Token revoked, please login again',
                'auth/invalid-id-token': 'Invalid token',
                'auth/argument-error': 'Invalid token format',
                'auth/user-not-found': 'User not found',
                'auth/user-disabled': 'User account is disabled'
            };
            error = new UnauthorizedError(firebaseErrors[err.code] || 'Authentication failed');
        }

        // Default to ApiError or create one
        if (!(error instanceof ApiError)) {
            error = new ApiError(
                error?.statusCode || 500,
                error?.message || 'Internal server error'
            );
        }

        // Send response
        const response = {
            success: false,
            message: error.message,
            ...(error.errors?.length > 0 && { errors: error.errors }),
            ...(process.env.NODE_ENV !== 'production' && { stack: err?.stack })
        };

        res.status(error.statusCode).json(response);
    } catch (handlerError) {
        // Fallback if error handler itself fails
        console.error('Error handler failed:', handlerError);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            ...(process.env.NODE_ENV !== 'production' && { 
                originalError: err?.message,
                handlerError: handlerError?.message 
            })
        });
    }
};
