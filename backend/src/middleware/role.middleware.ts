import { Context, Next } from 'hono';
import { JWTPayload } from '../utils/jwt';

export const requireRole = (...allowedRoles: string[]) => {
    return async (c: Context, next: Next) => {
        const user = c.get('user') as JWTPayload;

        if (!user) {
            return c.json({ error: 'Unauthorized - User not found' }, 401);
        }

        if (!allowedRoles.includes(user.role)) {
            return c.json(
                {
                    error: 'Forbidden - Insufficient permissions',
                    required: allowedRoles,
                    current: user.role
                },
                403
            );
        }

        await next();
    };
};

// Predefined role middlewares
export const requireAdmin = requireRole('ADMIN');
export const requireStoreManager = requireRole('ADMIN', 'STORE_MANAGER');
export const requireDeliveryBoy = requireRole('DELIVERY_BOY');
export const requireCustomer = requireRole('CUSTOMER');

// Any authenticated user
export const requireAuth = requireRole('ADMIN', 'STORE_MANAGER', 'DELIVERY_BOY', 'CUSTOMER');
