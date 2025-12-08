import { Hono } from 'hono';
import { eq, and, count, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { stores, users, orders, customers } from '../db/schema';
import { authMiddleware, getCurrentUser } from '../middleware/auth.middleware';
import { requireAdmin, requireStoreManager } from '../middleware/role.middleware';
import { createStoreSchema, updateStoreSchema } from '../utils/validators';

const storeRoutes = new Hono();

// All routes require authentication
storeRoutes.use('*', authMiddleware);

/**
 * GET /api/stores
 * Get all stores (Admin sees all, Store Manager sees only theirs)
 */
storeRoutes.get('/', requireStoreManager, async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '10');
        const offset = (page - 1) * limit;

        // Build query based on role
        let whereClause = undefined;
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId) {
            whereClause = eq(stores.id, currentUser.storeId);
        }

        const storesList = await db.query.stores.findMany({
            where: whereClause,
            limit,
            offset,
        });

        // Get stats for each store
        const storesWithStats = await Promise.all(
            storesList.map(async (store) => {
                const [managersCount] = await db
                    .select({ count: count() })
                    .from(users)
                    .where(and(eq(users.storeId, store.id), eq(users.role, 'STORE_MANAGER')));

                const [deliveryBoysCount] = await db
                    .select({ count: count() })
                    .from(users)
                    .where(and(eq(users.storeId, store.id), eq(users.role, 'DELIVERY_BOY')));

                const [ordersCount] = await db
                    .select({ count: count() })
                    .from(orders)
                    .where(eq(orders.storeId, store.id));

                const [salesData] = await db
                    .select({
                        totalSales: sql<string>`COALESCE(SUM(CAST(${orders.invoiceAmount} AS DECIMAL)), 0)`,
                    })
                    .from(orders)
                    .where(and(
                        eq(orders.storeId, store.id),
                        eq(orders.status, 'DELIVERED')
                    ));

                return {
                    ...store,
                    managersCount: managersCount.count,
                    deliveryBoysCount: deliveryBoysCount.count,
                    totalOrders: ordersCount.count,
                    totalSales: parseFloat(salesData.totalSales || '0'),
                };
            })
        );

        const [totalCount] = await db
            .select({ count: count() })
            .from(stores)
            .where(whereClause);

        return c.json({
            stores: storesWithStats,
            pagination: {
                page,
                limit,
                total: totalCount.count,
                totalPages: Math.ceil(totalCount.count / limit),
            },
        });
    } catch (error: any) {
        console.error('Get stores error:', error);
        throw error;
    }
});

/**
 * GET /api/stores/:id
 * Get single store details
 */
storeRoutes.get('/:id', requireStoreManager, async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const storeId = parseInt(c.req.param('id'));

        // Check access
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId !== storeId) {
            return c.json({ error: 'Access denied to this store' }, 403);
        }

        const store = await db.query.stores.findFirst({
            where: eq(stores.id, storeId),
        });

        if (!store) {
            return c.json({ error: 'Store not found' }, 404);
        }

        // Get managers
        const managers = await db.query.users.findMany({
            where: and(eq(users.storeId, storeId), eq(users.role, 'STORE_MANAGER')),
            columns: {
                password: false,
            },
        });

        // Get delivery boys
        const deliveryBoys = await db.query.users.findMany({
            where: and(eq(users.storeId, storeId), eq(users.role, 'DELIVERY_BOY')),
            columns: {
                password: false,
            },
        });

        // Get customer count
        const [customerCount] = await db
            .select({ count: count() })
            .from(customers)
            .where(eq(customers.storeId, storeId));

        // Get order stats
        const [orderStats] = await db
            .select({
                totalOrders: count(),
                totalSales: sql<string>`COALESCE(SUM(CAST(${orders.invoiceAmount} AS DECIMAL)), 0)`,
            })
            .from(orders)
            .where(and(
                eq(orders.storeId, storeId),
                eq(orders.status, 'DELIVERED')
            ));

        return c.json({
            store: {
                ...store,
                managers,
                deliveryBoys,
                customerCount: customerCount.count,
                totalOrders: orderStats.totalOrders,
                totalSales: parseFloat(orderStats.totalSales || '0'),
            },
        });
    } catch (error: any) {
        console.error('Get store error:', error);
        throw error;
    }
});

/**
 * POST /api/stores
 * Create new store (Admin only)
 */
storeRoutes.post('/', requireAdmin, async (c) => {
    try {
        const body = await c.req.json();
        const validated = createStoreSchema.parse(body);

        const [newStore] = await db.insert(stores).values({
            name: validated.name,
            address: validated.address,
            phone: validated.phone,
            isActive: true,
        }).returning();

        return c.json({
            message: 'Store created successfully',
            store: newStore,
        }, 201);
    } catch (error: any) {
        console.error('Create store error:', error);
        throw error;
    }
});

/**
 * PUT /api/stores/:id
 * Update store (Admin only)
 */
storeRoutes.put('/:id', requireAdmin, async (c) => {
    try {
        const storeId = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const validated = updateStoreSchema.parse(body);

        const store = await db.query.stores.findFirst({
            where: eq(stores.id, storeId),
        });

        if (!store) {
            return c.json({ error: 'Store not found' }, 404);
        }

        const [updatedStore] = await db
            .update(stores)
            .set(validated)
            .where(eq(stores.id, storeId))
            .returning();

        return c.json({
            message: 'Store updated successfully',
            store: updatedStore,
        });
    } catch (error: any) {
        console.error('Update store error:', error);
        throw error;
    }
});

/**
 * DELETE /api/stores/:id
 * Soft delete store (Admin only)
 */
storeRoutes.delete('/:id', requireAdmin, async (c) => {
    try {
        const storeId = parseInt(c.req.param('id'));

        const store = await db.query.stores.findFirst({
            where: eq(stores.id, storeId),
        });

        if (!store) {
            return c.json({ error: 'Store not found' }, 404);
        }

        // Check for active orders
        const [activeOrders] = await db
            .select({ count: count() })
            .from(orders)
            .where(and(
                eq(orders.storeId, storeId),
                sql`${orders.status} NOT IN ('DELIVERED', 'CANCELLED', 'RETURNED', 'PARTIAL_RETURNED')`
            ));

        if (activeOrders.count > 0) {
            return c.json({
                error: 'Cannot delete store with active orders',
                activeOrdersCount: activeOrders.count,
            }, 400);
        }

        // Soft delete
        await db
            .update(stores)
            .set({ isActive: false })
            .where(eq(stores.id, storeId));

        return c.json({ message: 'Store deleted successfully' });
    } catch (error: any) {
        console.error('Delete store error:', error);
        throw error;
    }
});

export default storeRoutes;
