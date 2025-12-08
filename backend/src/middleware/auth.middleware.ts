import { Context, Next } from 'hono';
import { verifyToken, JWTPayload } from '../utils/jwt';
import { redis } from '../config/redis';

export const authMiddleware = async (c: Context, next: Next) => {
    try {
        const authHeader = c.req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Unauthorized - No token provided' }, 401);
        }

        const token = authHeader.replace('Bearer ', '');

        // Check if token is blacklisted
        const isBlacklisted = await redis.get(`blacklist:${token}`);
        if (isBlacklisted) {
            return c.json({ error: 'Token has been revoked' }, 401);
        }

        // Verify token
        const decoded = verifyToken(token);

        // Set user data in context
        c.set('user', decoded);
        c.set('token', token);

        await next();
    } catch (error: any) {
        return c.json({ error: error.message || 'Invalid or expired token' }, 401);
    }
};

// Get current user from context (helper)
export const getCurrentUser = (c: Context): JWTPayload => {
    const user = c.get('user') as JWTPayload;
    if (!user) {
        throw new Error('User not found in context');
    }
    return user;
};
