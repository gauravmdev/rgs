import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '../config/database';
import { users, customers } from '../db/schema';
import { generateToken } from '../utils/jwt';
import { loginSchema, registerSchema } from '../utils/validators';
import { authMiddleware, getCurrentUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { redis } from '../config/redis';

const auth = new Hono();

/**
 * POST /api/auth/register
 * Register new user (Admin only)
 */
auth.post('/register', authMiddleware, requireAdmin, async (c) => {
    try {
        const body = await c.req.json();
        const validated = registerSchema.parse(body);

        // Check if email already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, validated.email),
        });

        if (existingUser) {
            return c.json({ error: 'Email already registered' }, 409);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(validated.password, 10);

        // Create user
        const [newUser] = await db.insert(users).values({
            email: validated.email,
            password: hashedPassword,
            name: validated.name,
            role: validated.role,
            phone: validated.phone,
            storeId: validated.storeId || null,
            isActive: true,
        }).returning();

        // If role is CUSTOMER, create customer record
        if (validated.role === 'CUSTOMER' && validated.storeId) {
            await db.insert(customers).values({
                userId: newUser.id,
                storeId: validated.storeId,
                totalDues: '0',
                totalOrders: 0,
                totalSales: '0',
            });
        }

        // Remove password from response
        const { password, ...userWithoutPassword } = newUser;

        return c.json({
            message: 'User registered successfully',
            user: userWithoutPassword,
        }, 201);
    } catch (error: any) {
        console.error('Register error:', error);
        throw error;
    }
});

/**
 * POST /api/auth/login
 * Login user
 */
auth.post('/login', async (c) => {
    try {
        const body = await c.req.json();
        const validated = loginSchema.parse(body);

        // Find user by email
        const user = await db.query.users.findFirst({
            where: eq(users.email, validated.email),
            with: {
                store: true,
            },
        });

        if (!user) {
            return c.json({ error: 'Invalid email or password' }, 401);
        }

        // Check if user is active
        if (!user.isActive) {
            return c.json({ error: 'Account is disabled' }, 403);
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(validated.password, user.password);

        if (!isPasswordValid) {
            return c.json({ error: 'Invalid email or password' }, 401);
        }

        // Generate JWT token
        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            storeId: user.storeId || undefined,
        });

        // Remove password from response
        const { password, ...userWithoutPassword } = user;

        return c.json({
            message: 'Login successful',
            token,
            user: {
                ...userWithoutPassword,
                storeName: user.store?.name,
            },
        });
    } catch (error: any) {
        console.error('Login error:', error);
        throw error;
    }
});

/**
 * GET /api/auth/me
 * Get current user details
 */
auth.get('/me', authMiddleware, async (c) => {
    try {
        const currentUser = getCurrentUser(c);

        // Fetch fresh user data
        const user = await db.query.users.findFirst({
            where: eq(users.id, currentUser.userId),
            with: {
                store: true,
            },
        });

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        if (!user.isActive) {
            return c.json({ error: 'Account is disabled' }, 403);
        }

        // Remove password from response
        const { password, ...userWithoutPassword } = user;

        return c.json({
            user: {
                ...userWithoutPassword,
                storeName: user.store?.name,
            },
        });
    } catch (error: any) {
        console.error('Get me error:', error);
        throw error;
    }
});

/**
 * POST /api/auth/logout
 * Logout user (blacklist token)
 */
auth.post('/logout', authMiddleware, async (c) => {
    try {
        const token = c.get('token') as string;

        // Blacklist token for 7 days (default JWT expiry)
        await redis.setex(`blacklist:${token}`, 60 * 60 * 24 * 7, '1');

        return c.json({ message: 'Logged out successfully' });
    } catch (error: any) {
        console.error('Logout error:', error);
        throw error;
    }
});

/**
 * POST /api/auth/change-password
 * Change password for current user
 */
auth.post('/change-password', authMiddleware, async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const body = await c.req.json();

        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return c.json({ error: 'Current password and new password are required' }, 400);
        }

        if (newPassword.length < 6) {
            return c.json({ error: 'New password must be at least 6 characters' }, 400);
        }

        // Get user
        const user = await db.query.users.findFirst({
            where: eq(users.id, currentUser.userId),
        });

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isPasswordValid) {
            return c.json({ error: 'Current password is incorrect' }, 401);
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, currentUser.userId));

        return c.json({ message: 'Password changed successfully' });
    } catch (error: any) {
        console.error('Change password error:', error);
        throw error;
    }
});

export default auth;
