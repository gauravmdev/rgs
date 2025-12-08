import { Context, Next } from 'hono';
import { JWTPayload } from '../utils/jwt';

/**
 * Middleware to check if user has access to a specific store
 * Admins can access all stores
 * Store Managers and Delivery Boys can only access their assigned store
 */
export const checkStoreAccess = async (c: Context, next: Next) => {
    const user = c.get('user') as JWTPayload;

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // Admins can access all stores
    if (user.role === 'ADMIN') {
        await next();
        return;
    }

    // Get storeId from params or query
    const storeIdParam = c.req.param('storeId') || c.req.query('storeId');

    if (!storeIdParam) {
        // If no storeId specified, allow if user has a store assigned
        if (user.storeId) {
            await next();
            return;
        }
        return c.json({ error: 'Store ID is required' }, 400);
    }

    const storeId = parseInt(storeIdParam);

    // Check if user has access to this store
    if (user.storeId && user.storeId !== storeId) {
        return c.json({
            error: 'Access denied to this store',
            yourStore: user.storeId,
            requestedStore: storeId
        }, 403);
    }

    await next();
};

/**
 * Filter query by store for non-admin users
 * Adds storeId to context for use in queries
 */
export const filterByStore = async (c: Context, next: Next) => {
    const user = c.get('user') as JWTPayload;

    if (user.role !== 'ADMIN' && user.storeId) {
        // Set the storeId in context so routes can use it
        c.set('storeId', user.storeId);
    }

    await next();
};
