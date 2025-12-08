import { Hono } from 'hono';
import { eq, and, sql, gte, lte, desc, count } from 'drizzle-orm';
import { db } from '../config/database';
import { orders, customers, users, deliveries, stores, returns } from '../db/schema';
import { authMiddleware, getCurrentUser } from '../middleware/auth.middleware';
import { cacheService } from '../config/redis';

const analyticsRoutes = new Hono();

// All routes require authentication
analyticsRoutes.use('*', authMiddleware);

/**
 * GET /api/analytics/dashboard
 * Real-time dashboard stats
 */
analyticsRoutes.get('/dashboard', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const storeIdParam = c.req.query('storeId');

        // Determine which store to query
        let storeId: number | undefined;
        if (currentUser.role === 'ADMIN') {
            storeId = storeIdParam ? parseInt(storeIdParam) : undefined;
        } else if (currentUser.role === 'STORE_MANAGER') {
            if (!currentUser.storeId) {
                return c.json({ error: 'Store manager not assigned to any store' }, 403);
            }
            storeId = currentUser.storeId;
        } else if (currentUser.storeId) {
            storeId = currentUser.storeId;
        }

        // Cache key
        const cacheKey = `cache:dashboard:${storeId || 'all'}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return c.json(cached);
        }

        // Today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Build where conditions
        const storeCondition = storeId ? eq(orders.storeId, storeId) : undefined;
        const todayCondition = and(
            gte(orders.createdAt, today),
            lte(orders.createdAt, tomorrow),
            storeCondition
        );

        // Today's Gross Sale (invoiced amount for all completed/returned orders)
        const [todayGrossSalesData] = await db
            .select({
                totalSales: sql<string>`COALESCE(SUM(CAST(${orders.invoiceAmount} AS DECIMAL)), 0)`,
                totalOrders: count(),
            })
            .from(orders)
            .where(and(
                todayCondition,
                sql`${orders.status} IN ('DELIVERED', 'RETURNED', 'PARTIAL_RETURNED')`
            ));

        // Today's Refunds (for orders created today)
        const [todayRefundsData] = await db
            .select({
                totalRefunds: sql<string>`COALESCE(SUM(CAST(${returns.refundAmount} AS DECIMAL)), 0)`,
            })
            .from(returns)
            .innerJoin(orders, eq(returns.orderId, orders.id))
            .where(todayCondition);

        const netTodaySales = parseFloat(todayGrossSalesData.totalSales || '0') - parseFloat(todayRefundsData.totalRefunds || '0');

        // Today's orders count
        const [todayOrdersCount] = await db
            .select({ count: count() })
            .from(orders)
            .where(todayCondition);

        // Active orders by status
        const activeStatuses = ['CREATED', 'ASSIGNED', 'OUT_FOR_DELIVERY'];
        const activeOrdersData = await Promise.all(
            activeStatuses.map(async (status) => {
                const [result] = await db
                    .select({ count: count() })
                    .from(orders)
                    .where(and(eq(orders.status, status as any), storeCondition));
                return { status, count: result.count };
            })
        );

        // Total customer dues for the store
        const [duesData] = await db
            .select({
                totalDues: sql<string>`COALESCE(SUM(CAST(${customers.totalDues} AS DECIMAL)), 0)`,
            })
            .from(customers)
            .where(storeId ? eq(customers.storeId, storeId) : undefined);

        // Recent orders (last 10)
        const recentOrders = await db.query.orders.findMany({
            where: storeCondition,
            with: {
                customer: {
                    with: {
                        user: {
                            columns: { password: false },
                        },
                    },
                },
                store: true,
            },
            orderBy: desc(orders.createdAt),
            limit: 10,
        });

        const result = {
            stats: {
                todaySales: netTodaySales,
                todayOrders: todayOrdersCount.count,
                activeOrders: activeOrdersData.reduce((acc, curr) => {
                    acc[curr.status.toLowerCase()] = curr.count;
                    return acc;
                }, {} as Record<string, number>),
                totalDues: parseFloat(duesData.totalDues || '0'),
            },
            recentOrders: recentOrders.map(order => ({
                ...order,
                customerName: order.customer?.user?.name || 'Unknown',
                storeName: order.store?.name || 'Unknown',
            })),
        };

        // Cache for 30 seconds
        await cacheService.set(cacheKey, result, 30);

        return c.json(result);
    } catch (error: any) {
        console.error('Dashboard error:', error);
        throw error;
    }
});

/**
 * GET /api/analytics/daily-sales
 * Daily sales report
 */
analyticsRoutes.get('/daily-sales', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const storeIdParam = c.req.query('storeId');
        const startDate = c.req.query('startDate');
        const endDate = c.req.query('endDate');

        // Determine store
        let storeId: number | undefined;
        if (currentUser.role === 'ADMIN') {
            storeId = storeIdParam ? parseInt(storeIdParam) : undefined;
        } else if (currentUser.storeId) {
            storeId = currentUser.storeId;
        }

        // Default to last 30 days if not provided
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Cache key
        const cacheKey = `cache:daily-sales:${storeId || 'all'}:${start.toISOString()}:${end.toISOString()}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return c.json(cached);
        }

        const conditions = [
            gte(orders.createdAt, start),
            lte(orders.createdAt, end),
        ];
        if (storeId) {
            conditions.push(eq(orders.storeId, storeId));
        }

        // Group by date - Gross Sales (All completed/returned sales)
        const salesData = await db
            .select({
                date: sql<string>`DATE(${orders.createdAt})`,
                totalOrders: count(),
                grossSales: sql<string>`COALESCE(SUM(CASE WHEN ${orders.status} IN ('DELIVERED', 'RETURNED', 'PARTIAL_RETURNED') THEN CAST(${orders.invoiceAmount} AS DECIMAL) ELSE 0 END), 0)`,
                deliveredOrders: sql<number>`COUNT(CASE WHEN ${orders.status} = 'DELIVERED' THEN 1 END)`,
                cancelledOrders: sql<number>`COUNT(CASE WHEN ${orders.status} = 'CANCELLED' THEN 1 END)`,
                returnedOrders: sql<number>`COUNT(CASE WHEN ${orders.status} IN ('RETURNED', 'PARTIAL_RETURNED') THEN 1 END)`,
            })
            .from(orders)
            .where(and(...conditions))
            .groupBy(sql`DATE(${orders.createdAt})`)
            .orderBy(sql`DATE(${orders.createdAt})`);

        // Fetch Refunds grouped by Order Date
        // We need to join returns -> orders to get the order's createdAt
        const refundsData = await db
            .select({
                date: sql<string>`DATE(${orders.createdAt})`,
                totalRefunds: sql<string>`COALESCE(SUM(CAST(${returns.refundAmount} AS DECIMAL)), 0)`,
            })
            .from(returns)
            .innerJoin(orders, eq(returns.orderId, orders.id))
            .where(and(...conditions))
            .groupBy(sql`DATE(${orders.createdAt})`);

        // Create a map for refunds for easy lookup
        const refundsMap = new Map();
        refundsData.forEach(r => {
            // Ensure date format matches (usually YYYY-MM-DD from DATE())
            const dateStr = new Date(r.date).toISOString().split('T')[0];
            refundsMap.set(dateStr, parseFloat(r.totalRefunds));
        });

        // Merge data
        const mergedData = salesData.map(row => {
            const dateStr = new Date(row.date).toISOString().split('T')[0];
            const grossSales = parseFloat(row.grossSales || '0');
            const totalRefunds = refundsMap.get(dateStr) || 0;
            const netSales = grossSales - totalRefunds;

            return {
                date: row.date,
                totalOrders: row.totalOrders,
                grossSales,
                totalRefunds,
                netSales, // This is what the user calls "Total Sales"
                totalSales: netSales, // For backward compatibility/consistency with user request
                deliveredOrders: row.deliveredOrders,
                cancelledOrders: row.cancelledOrders,
                returnedOrders: row.returnedOrders,
            };
        });

        const result = {
            salesData: mergedData,
        };

        // Cache for 5 minutes
        await cacheService.set(cacheKey, result, 300);

        return c.json(result);
    } catch (error: any) {
        console.error('Daily sales error:', error);
        throw error;
    }
});

/**
 * GET /api/analytics/weekly-sales
 * Weekly sales report
 */
analyticsRoutes.get('/weekly-sales', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const storeIdParam = c.req.query('storeId');
        const weeks = parseInt(c.req.query('weeks') || '4');

        // Determine store
        let storeId: number | undefined;
        if (currentUser.role === 'ADMIN') {
            storeId = storeIdParam ? parseInt(storeIdParam) : undefined;
        } else if (currentUser.storeId) {
            storeId = currentUser.storeId;
        }

        // Cache key
        const cacheKey = `cache:weekly-sales:${storeId || 'all'}:${weeks}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return c.json(cached);
        }

        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

        const conditions = [
            gte(orders.createdAt, startDate),
            lte(orders.createdAt, endDate),
        ];
        if (storeId) {
            conditions.push(eq(orders.storeId, storeId));
        }

        // Group by week - Gross Sales
        const weeklySales = await db
            .select({
                week: sql<string>`DATE_TRUNC('week', ${orders.createdAt})`,
                totalOrders: count(),
                grossSales: sql<string>`COALESCE(SUM(CASE WHEN ${orders.status} IN ('DELIVERED', 'RETURNED', 'PARTIAL_RETURNED') THEN CAST(${orders.invoiceAmount} AS DECIMAL) ELSE 0 END), 0)`,
            })
            .from(orders)
            .where(and(...conditions))
            .groupBy(sql`DATE_TRUNC('week', ${orders.createdAt})`)
            .orderBy(sql`DATE_TRUNC('week', ${orders.createdAt})`);

        // Fetch Refunds grouped by Order Week
        const refundsData = await db
            .select({
                week: sql<string>`DATE_TRUNC('week', ${orders.createdAt})`,
                totalRefunds: sql<string>`COALESCE(SUM(CAST(${returns.refundAmount} AS DECIMAL)), 0)`,
            })
            .from(returns)
            .innerJoin(orders, eq(returns.orderId, orders.id))
            .where(and(...conditions))
            .groupBy(sql`DATE_TRUNC('week', ${orders.createdAt})`);

        const refundsMap = new Map();
        refundsData.forEach(r => {
            const weekStr = new Date(r.week).toISOString().split('T')[0]; // Simplify key
            refundsMap.set(weekStr, parseFloat(r.totalRefunds));
        });

        const mergedData = weeklySales.map(row => {
            const weekStr = new Date(row.week).toISOString().split('T')[0];
            const grossSales = parseFloat(row.grossSales || '0');
            const totalRefunds = refundsMap.get(weekStr) || 0;
            const netSales = grossSales - totalRefunds;

            return {
                week: row.week,
                totalOrders: row.totalOrders,
                grossSales,
                totalRefunds,
                netSales,
                totalSales: netSales, // User requested Total Sales = Gross - Refunds
                averageOrderValue: row.totalOrders > 0 ? netSales / row.totalOrders : 0,
            };
        });

        const result = {
            weeklySales: mergedData,
        };

        // Cache for 5 minutes
        await cacheService.set(cacheKey, result, 300);

        return c.json(result);
    } catch (error: any) {
        console.error('Weekly sales error:', error);
        throw error;
    }
});

/**
 * GET /api/analytics/delivery-performance
 * Delivery partner performance stats
 */
analyticsRoutes.get('/delivery-performance', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const storeIdParam = c.req.query('storeId');
        const deliveryPartnerId = c.req.query('deliveryPartnerId');

        // Determine store
        let storeId: number | undefined;
        if (currentUser.role === 'ADMIN') {
            storeId = storeIdParam ? parseInt(storeIdParam) : undefined;
        } else if (currentUser.storeId) {
            storeId = currentUser.storeId;
        }

        // Cache key
        const cacheKey = `cache:delivery-performance:${storeId || 'all'}:${deliveryPartnerId || 'all'}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return c.json(cached);
        }

        const conditions = [sql`${deliveries.deliveredAt} IS NOT NULL`];
        if (deliveryPartnerId) {
            conditions.push(eq(deliveries.deliveryPartnerId, parseInt(deliveryPartnerId)));
        }

        // Get delivery stats grouped by partner
        const performanceData = await db
            .select({
                deliveryPartnerId: deliveries.deliveryPartnerId,
                partnerName: users.name,
                totalDeliveries: count(),
                avgDeliveryTime: sql<number>`AVG(${deliveries.deliveryTimeMinutes})`,
            })
            .from(deliveries)
            .innerJoin(users, eq(deliveries.deliveryPartnerId, users.id))
            .where(and(
                ...conditions,
                storeId ? eq(users.storeId, storeId) : undefined
            ))
            .groupBy(deliveries.deliveryPartnerId, users.name)
            .orderBy(desc(count()));

        const result = {
            deliveryPerformance: performanceData.map(row => ({
                deliveryPartnerId: row.deliveryPartnerId,
                name: row.partnerName,
                totalDeliveries: row.totalDeliveries,
                averageDeliveryTime: row.avgDeliveryTime ? Math.round(row.avgDeliveryTime) : 0,
            })),
        };

        // Cache for 5 minutes
        await cacheService.set(cacheKey, result, 300);

        return c.json(result);
    } catch (error: any) {
        console.error('Delivery performance error:', error);
        throw error;
    }
});

/**
 * GET /api/analytics/top-customers
 * Top customers by sales
 */
analyticsRoutes.get('/top-customers', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const storeIdParam = c.req.query('storeId');
        const limit = parseInt(c.req.query('limit') || '10');

        // Determine store
        let storeId: number | undefined;
        if (currentUser.role === 'ADMIN') {
            storeId = storeIdParam ? parseInt(storeIdParam) : undefined;
        } else if (currentUser.storeId) {
            storeId = currentUser.storeId;
        }

        // Cache key
        const cacheKey = `cache:top-customers:${storeId || 'all'}:${limit}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return c.json(cached);
        }

        const topCustomers = await db.query.customers.findMany({
            where: storeId ? eq(customers.storeId, storeId) : undefined,
            with: {
                user: {
                    columns: { password: false },
                },
            },
            orderBy: desc(customers.totalSales),
            limit,
        });

        const result = {
            topCustomers: topCustomers.map(customer => ({
                id: customer.id,
                name: customer.user?.name || 'Unknown',
                email: customer.user?.email || 'Unknown',
                totalOrders: customer.totalOrders,
                totalSales: parseFloat(customer.totalSales || '0'),
                totalDues: parseFloat(customer.totalDues || '0'),
            })),
        };

        // Cache for 10 minutes
        await cacheService.set(cacheKey, result, 600);

        return c.json(result);
    } catch (error: any) {
        console.error('Top customers error:', error);
        throw error;
    }
});

/**
 * GET /api/analytics/payment-methods
 * Payment method breakdown
 */
analyticsRoutes.get('/payment-methods', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const storeIdParam = c.req.query('storeId');

        // Determine store
        let storeId: number | undefined;
        if (currentUser.role === 'ADMIN') {
            storeId = storeIdParam ? parseInt(storeIdParam) : undefined;
        } else if (currentUser.storeId) {
            storeId = currentUser.storeId;
        }

        // Cache key
        const cacheKey = `cache:payment-methods:${storeId || 'all'}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return c.json(cached);
        }

        const conditions = [
            sql`${orders.status} IN ('DELIVERED', 'RETURNED', 'PARTIAL_RETURNED')`,
            sql`${orders.paymentMethod} IS NOT NULL`,
        ];
        if (storeId) {
            conditions.push(eq(orders.storeId, storeId));
        }

        const paymentData = await db
            .select({
                paymentMethod: orders.paymentMethod,
                count: count(),
                totalAmount: sql<string>`COALESCE(SUM(CAST(${orders.invoiceAmount} AS DECIMAL)), 0)`,
            })
            .from(orders)
            .where(and(...conditions))
            .groupBy(orders.paymentMethod);

        const total = paymentData.reduce((sum, row) => sum + row.count, 0);

        const result = {
            paymentBreakdown: paymentData.map(row => ({
                paymentMethod: row.paymentMethod,
                count: row.count,
                totalAmount: parseFloat(row.totalAmount || '0'),
                percentage: total > 0 ? Math.round((row.count / total) * 100) : 0,
            })),
        };

        // Cache for 5 minutes
        await cacheService.set(cacheKey, result, 300);

        return c.json(result);
    } catch (error: any) {
        console.error('Payment methods error:', error);
        throw error;
    }
});

/**
 * GET /api/analytics/order-sources
 * Order source breakdown
 */
analyticsRoutes.get('/order-sources', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const storeIdParam = c.req.query('storeId');

        // Determine store
        let storeId: number | undefined;
        if (currentUser.role === 'ADMIN') {
            storeId = storeIdParam ? parseInt(storeIdParam) : undefined;
        } else if (currentUser.storeId) {
            storeId = currentUser.storeId;
        }

        // Cache key
        const cacheKey = `cache:order-sources:${storeId || 'all'}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return c.json(cached);
        }

        const sourceData = await db
            .select({
                source: orders.source,
                count: count(),
                totalSales: sql<string>`COALESCE(SUM(CASE WHEN ${orders.status} IN ('DELIVERED', 'RETURNED', 'PARTIAL_RETURNED') THEN CAST(${orders.invoiceAmount} AS DECIMAL) ELSE 0 END), 0)`,
            })
            .from(orders)
            .where(storeId ? eq(orders.storeId, storeId) : undefined)
            .groupBy(orders.source);

        const total = sourceData.reduce((sum, row) => sum + row.count, 0);

        const result = {
            sourceBreakdown: sourceData.map(row => ({
                source: row.source,
                count: row.count,
                totalSales: parseFloat(row.totalSales || '0'),
                percentage: total > 0 ? Math.round((row.count / total) * 100) : 0,
            })),
        };

        // Cache for 5 minutes
        await cacheService.set(cacheKey, result, 300);

        return c.json(result);
    } catch (error: any) {
        console.error('Order sources error:', error);
        throw error;
    }
});

export default analyticsRoutes;
