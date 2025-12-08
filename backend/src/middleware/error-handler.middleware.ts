import { Context } from 'hono';
import { ZodError } from 'zod';

export const errorHandler = (err: Error, c: Context) => {
    console.error('❌ Error:', err);

    // Zod validation errors
    if (err instanceof ZodError) {
        return c.json(
            {
                error: 'Validation failed',
                details: err.errors.map(e => ({
                    field: e.path.join('.'),
                    message: e.message,
                })),
            },
            400
        );
    }

    // Database unique constraint violations
    if (err.message.includes('duplicate key') || err.message.includes('unique constraint')) {
        return c.json(
            { error: 'Resource already exists', details: err.message },
            409
        );
    }

    // Foreign key violations
    if (err.message.includes('foreign key') || err.message.includes('violates foreign key constraint')) {
        return c.json(
            { error: 'Referenced resource not found', details: err.message },
            400
        );
    }

    // JWT errors
    if (err.message.includes('jwt') || err.message.includes('token')) {
        return c.json(
            { error: 'Authentication failed', details: err.message },
            401
        );
    }

    // Default error
    return c.json(
        {
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        },
        500
    );
};

// Not found handler
export const notFoundHandler = (c: Context) => {
    return c.json(
        {
            error: 'Not found',
            path: c.req.path,
            method: c.req.method,
        },
        404
    );
};
