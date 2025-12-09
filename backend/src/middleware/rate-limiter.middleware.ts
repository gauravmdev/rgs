import { Context, Next } from 'hono';
import { redis } from '../config/redis';
import { HTTPException } from 'hono/http-exception';

const WINDOW_SIZE_IN_SECONDS = 60;
const MAX_WINDOW_REQUEST_COUNT = 100;

export const rateLimiterMiddleware = async (c: Context, next: Next) => {
    // Skip rate limiting for health check
    if (c.req.path === '/health') {
        return next();
    }

    const ip = c.req.header('x-forwarded-for') || 'unknown';
    const key = `ratelimit:${ip}`;

    try {
        const currentCount = await redis.incr(key);

        if (currentCount === 1) {
            await redis.expire(key, WINDOW_SIZE_IN_SECONDS);
        }

        if (currentCount > MAX_WINDOW_REQUEST_COUNT) {
            throw new HTTPException(429, { message: 'Too Many Requests' });
        }

        await next();
    } catch (error) {
        if (error instanceof HTTPException) {
            throw error;
        }
        // Fail open if Redis is down
        console.error('Rate Limiter Error:', error);
        await next();
    }
};
