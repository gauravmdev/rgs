import { Hono } from 'hono';
import { eq, and, or, count, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '../config/database';
import { users, deliveries, stores } from '../db/schema';
import { authMiddleware, getCurrentUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { registerSchema, updateStaffSchema, changePasswordSchema } from '../utils/validators';

const staffRoutes = new Hono();

// All routes require authentication
staffRoutes.use('*', authMiddleware);

/**
 * GET /api/staff
 * Get all staff (Store Managers and Delivery Boys) - Admin only
 */
staffRoutes.get('/', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const role = c.req.query('role'); // Filter by role
        const storeIdParam = c.req.query('storeId'); // Filter by store
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');
        const offset = (page - 1) * limit;

        // Check if user is allowed to list staff
        if (!['ADMIN', 'STORE_MANAGER'].includes(currentUser.role)) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        // Build where conditions
        const conditions = [
            or(
                eq(users.role, 'STORE_MANAGER'),
                eq(users.role, 'DELIVERY_BOY'),
                eq(users.role, 'ADMIN')
            ),
        ];

        if (role && ['ADMIN', 'STORE_MANAGER', 'DELIVERY_BOY'].includes(role)) {
            conditions.push(eq(users.role, role as any));
        }

        // Context-aware store filtering
        if (currentUser.role === 'STORE_MANAGER') {
            // Manager can ONLY see staff from their own store
            if (currentUser.storeId) {
                conditions.push(eq(users.storeId, currentUser.storeId));
            } else {
                // If manager has no store (shouldn't happen), return empty or error?
                // For safety, let's say they see nothing if they have no store
                return c.json({ staff: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
        } else if (storeIdParam) {
            // Admin can filter by store
            conditions.push(eq(users.storeId, parseInt(storeIdParam)));
        }

        const staff = await db.query.users.findMany({
            where: and(...conditions),
            with: {
                store: true,
            },
            columns: {
                password: false,
            },
            limit,
            offset,
        });

        const [totalCount] = await db
            .select({ count: count() })
            .from(users)
            .where(and(...conditions));

        return c.json({
            staff,
            pagination: {
                page,
                limit,
                total: totalCount.count,
                totalPages: Math.ceil(totalCount.count / limit),
            },
        });
    } catch (error: any) {
        console.error('Get staff error:', error);
        throw error;
    }
});

/**
 * GET /api/staff/:id
 * Get single staff member details - Admin only
 */
staffRoutes.get('/:id', requireAdmin, async (c) => {
    try {
        const staffId = parseInt(c.req.param('id'));

        const staff = await db.query.users.findFirst({
            where: and(
                eq(users.id, staffId),
                or(
                    eq(users.role, 'STORE_MANAGER'),
                    eq(users.role, 'DELIVERY_BOY'),
                    eq(users.role, 'ADMIN')
                )
            ),
            with: {
                store: true,
            },
            columns: {
                password: false,
            },
        });

        if (!staff) {
            return c.json({ error: 'Staff member not found' }, 404);
        }

        // If delivery boy, get delivery stats
        let deliveryStats = null;
        if (staff.role === 'DELIVERY_BOY') {
            const [stats] = await db
                .select({
                    totalDeliveries: count(),
                    avgDeliveryTime: sql<number>`AVG(${deliveries.deliveryTimeMinutes})`,
                })
                .from(deliveries)
                .where(eq(deliveries.deliveryPartnerId, staffId));

            deliveryStats = {
                totalDeliveries: stats.totalDeliveries,
                averageDeliveryTime: stats.avgDeliveryTime ? Math.round(stats.avgDeliveryTime) : 0,
            };
        }

        return c.json({
            staff: {
                ...staff,
                deliveryStats,
            },
        });
    } catch (error: any) {
        console.error('Get staff error:', error);
        throw error;
    }
});

/**
 * POST /api/staff
 * Create new staff member (Store Manager or Delivery Boy) - Admin only
 */
staffRoutes.post('/', requireAdmin, async (c) => {
    try {
        const body = await c.req.json();
        const validated = registerSchema.parse(body);

        // Validate role
        if (!['ADMIN', 'STORE_MANAGER', 'DELIVERY_BOY'].includes(validated.role)) {
            return c.json({ error: 'Invalid role' }, 400);
        }

        // Validate store requirement
        if (validated.role !== 'ADMIN' && !validated.storeId) {
            return c.json({ error: 'Store is required for non-admin users' }, 400);
        }

        // Check if email already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, validated.email),
        });

        if (existingUser) {
            return c.json({ error: 'Email already registered' }, 409);
        }

        // Validate store exists if storeId provided
        if (validated.storeId) {
            const store = await db.query.stores.findFirst({
                where: eq(stores.id, validated.storeId),
            });

            if (!store) {
                return c.json({ error: 'Store not found' }, 404);
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(validated.password, 10);

        // Create user
        const [newStaff] = await db.insert(users).values({
            email: validated.email,
            password: hashedPassword,
            name: validated.name,
            role: validated.role,
            phone: validated.phone,
            storeId: validated.storeId || null,
            isActive: true,
        }).returning();

        // Remove password from response
        const { password, ...staffWithoutPassword } = newStaff;

        return c.json({
            message: 'Staff member created successfully',
            staff: staffWithoutPassword,
        }, 201);
    } catch (error: any) {
        console.error('Create staff error:', error);
        throw error;
    }
});

/**
 * PUT /api/staff/:id
 * Update staff member - Admin only
 */
staffRoutes.put('/:id', requireAdmin, async (c) => {
    try {
        const staffId = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const validated = updateStaffSchema.parse(body);

        const staff = await db.query.users.findFirst({
            where: and(
                eq(users.id, staffId),
                or(
                    eq(users.role, 'STORE_MANAGER'),
                    eq(users.role, 'DELIVERY_BOY'),
                    eq(users.role, 'ADMIN')
                )
            ),
        });

        if (!staff) {
            return c.json({ error: 'Staff member not found' }, 404);
        }

        // Update user
        const [updatedStaff] = await db
            .update(users)
            .set(validated)
            .where(eq(users.id, staffId))
            .returning();

        // Remove password from response
        const { password, ...staffWithoutPassword } = updatedStaff;

        return c.json({
            message: 'Staff member updated successfully',
            staff: staffWithoutPassword,
        });
    } catch (error: any) {
        console.error('Update staff error:', error);
        throw error;
    }
});

/**
 * PUT /api/staff/:id/change-password
 * Change staff password - Admin only
 */
staffRoutes.put('/:id/change-password', requireAdmin, async (c) => {
    try {
        const staffId = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const validated = changePasswordSchema.parse(body);

        const staff = await db.query.users.findFirst({
            where: eq(users.id, staffId),
        });

        if (!staff) {
            return c.json({ error: 'Staff member not found' }, 404);
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(validated.newPassword, 10);

        // Update password
        await db
            .update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, staffId));

        return c.json({ message: 'Password changed successfully' });
    } catch (error: any) {
        console.error('Change password error:', error);
        throw error;
    }
});

/**
 * DELETE /api/staff/:id
 * Soft delete staff member - Admin only
 */
staffRoutes.delete('/:id', requireAdmin, async (c) => {
    try {
        const staffId = parseInt(c.req.param('id'));

        const staff = await db.query.users.findFirst({
            where: and(
                eq(users.id, staffId),
                or(
                    eq(users.role, 'STORE_MANAGER'),
                    eq(users.role, 'DELIVERY_BOY'),
                    eq(users.role, 'ADMIN')
                )
            ),
        });

        if (!staff) {
            return c.json({ error: 'Staff member not found' }, 404);
        }

        // If delivery boy, check for pending deliveries
        if (staff.role === 'DELIVERY_BOY') {
            const [pendingDeliveries] = await db
                .select({ count: count() })
                .from(deliveries)
                .where(and(
                    eq(deliveries.deliveryPartnerId, staffId),
                    sql`${deliveries.deliveredAt} IS NULL`
                ));

            if (pendingDeliveries.count > 0) {
                return c.json({
                    error: 'Cannot delete delivery boy with pending deliveries',
                    pendingDeliveriesCount: pendingDeliveries.count,
                }, 400);
            }
        }

        // Soft delete
        await db
            .update(users)
            .set({ isActive: false })
            .where(eq(users.id, staffId));

        return c.json({ message: 'Staff member deleted successfully' });
    } catch (error: any) {
        console.error('Delete staff error:', error);
        throw error;
    }
});

/**
 * GET /api/staff/delivery-boys/:storeId
 * Get active delivery boys for a store - Store Managers can access
 */
staffRoutes.get('/delivery-boys/:storeId', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const storeId = parseInt(c.req.param('storeId'));

        // Check access
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId !== storeId) {
            return c.json({ error: 'Access denied to this store' }, 403);
        }

        const deliveryBoys = await db.query.users.findMany({
            where: and(
                eq(users.storeId, storeId),
                eq(users.role, 'DELIVERY_BOY'),
                eq(users.isActive, true)
            ),
            columns: {
                password: false,
            },
        });

        return c.json({ deliveryBoys });
    } catch (error: any) {
        console.error('Get delivery boys error:', error);
        throw error;
    }
});

export default staffRoutes;
