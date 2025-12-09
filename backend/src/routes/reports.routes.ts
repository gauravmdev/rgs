import { Hono } from 'hono';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { orders, customers, users, stores, dueClearances } from '../db/schema';
import { authMiddleware, getCurrentUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import {
    generateSalesPDF,
    generateOrdersPDF,
    generateCustomersPDF,
    generateDeliveryPerformancePDF
} from '../utils/pdfGenerator';
import {
    generateSalesExcel,
    generateOrdersExcel,
    generateCustomersExcel,
    generatePaymentsExcel
} from '../utils/excelGenerator';

const reportsRoutes = new Hono();

// All routes require authentication and admin access
reportsRoutes.use('*', authMiddleware);
reportsRoutes.use('*', requireAdmin);

/**
 * GET /api/reports/sales
 * Generate sales report
 */
reportsRoutes.get('/sales', async (c) => {
    try {
        const format = c.req.query('format') || 'pdf'; // pdf or excel
        const startDate = c.req.query('startDate');
        const endDate = c.req.query('endDate');
        const storeId = c.req.query('storeId');

        // Build query conditions
        const conditions: any[] = [
            sql`${orders.status} IN ('DELIVERED', 'RETURNED', 'PARTIAL_RETURNED')`
        ];

        if (startDate) conditions.push(gte(orders.createdAt, new Date(startDate)));
        if (endDate) conditions.push(lte(orders.createdAt, new Date(endDate)));
        if (storeId) conditions.push(eq(orders.storeId, parseInt(storeId)));

        // Fetch sales data grouped by date
        const salesData = await db
            .select({
                date: sql<string>`DATE(${orders.createdAt})`,
                totalSales: sql<number>`SUM(CAST(${orders.invoiceAmount} AS DECIMAL))`,
                totalOrders: sql<number>`COUNT(*)`,
            })
            .from(orders)
            .where(and(...conditions))
            .groupBy(sql`DATE(${orders.createdAt})`)
            .orderBy(sql`DATE(${orders.createdAt})`) as any[];

        // Calculate average order value
        const formattedData = salesData.map(row => ({
            date: row.date,
            totalSales: Number(row.totalSales) || 0,
            totalOrders: Number(row.totalOrders) || 0,
            avgOrderValue: row.totalOrders > 0 ? (Number(row.totalSales) / Number(row.totalOrders)) : 0,
        }));

        // Get store name if filtered
        let storeName: string | undefined;
        if (storeId) {
            const store = await db.query.stores.findFirst({
                where: eq(stores.id, parseInt(storeId))
            });
            storeName = store?.name;
        }

        const filters = { startDate, endDate, storeName };

        // Generate file
        let buffer: Buffer;
        let contentType: string;
        let filename: string;

        if (format === 'excel') {
            buffer = await generateSalesExcel(formattedData, filters);
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            filename = `sales_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        } else {
            buffer = await generateSalesPDF(formattedData, filters);
            contentType = 'application/pdf';
            filename = `sales_report_${new Date().toISOString().split('T')[0]}.pdf`;
        }

        c.header('Content-Type', contentType);
        c.header('Content-Disposition', `attachment; filename="${filename}"`);
        return c.body(buffer as any);
    } catch (error: any) {
        console.error('Generate sales report error:', error);
        return c.json({ error: 'Failed to generate sales report', details: error.message }, 500);
    }
});

/**
 * GET /api/reports/orders
 * Generate orders report
 */
reportsRoutes.get('/orders', async (c) => {
    try {
        const format = c.req.query('format') || 'pdf';
        const startDate = c.req.query('startDate');
        const endDate = c.req.query('endDate');
        const status = c.req.query('status');
        const storeId = c.req.query('storeId');

        // Build query conditions
        const conditions: any[] = [];
        if (startDate) conditions.push(gte(orders.createdAt, new Date(startDate)));
        if (endDate) conditions.push(lte(orders.createdAt, new Date(endDate)));
        if (status) conditions.push(eq(orders.status, status as any));
        if (storeId) conditions.push(eq(orders.storeId, parseInt(storeId)));

        // Fetch orders
        const ordersList = await db.query.orders.findMany({
            where: conditions.length > 0 ? and(...conditions) : undefined,
            with: {
                customer: {
                    with: {
                        user: { columns: { name: true } }
                    }
                },
                store: true
            },
            orderBy: desc(orders.createdAt),
            limit: 1000
        });

        // Format data
        const formattedData = ordersList.map(order => ({
            orderNumber: order.orderNumber,
            customerName: order.customer?.user?.name || 'Unknown',
            storeName: order.store?.name || 'Unknown',
            invoiceAmount: Number(order.invoiceAmount),
            status: order.status || 'CREATED',
            // source removed
            createdAt: (order.createdAt || new Date()).toISOString()
        }));

        // Get store name if filtered
        let storeName: string | undefined;
        if (storeId) {
            const store = await db.query.stores.findFirst({
                where: eq(stores.id, parseInt(storeId))
            });
            storeName = store?.name;
        }

        const filters = { startDate, endDate, status, storeName };

        // Generate file
        let buffer: Buffer;
        let contentType: string;
        let filename: string;

        if (format === 'excel') {
            buffer = await generateOrdersExcel(formattedData, filters);
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            filename = `orders_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        } else {
            buffer = await generateOrdersPDF(formattedData, filters);
            contentType = 'application/pdf';
            filename = `orders_report_${new Date().toISOString().split('T')[0]}.pdf`;
        }

        c.header('Content-Type', contentType);
        c.header('Content-Disposition', `attachment; filename="${filename}"`);
        return c.body(buffer as any);
    } catch (error: any) {
        console.error('Generate orders report error:', error);
        return c.json({ error: 'Failed to generate orders report', details: error.message }, 500);
    }
});

/**
 * GET /api/reports/customers
 * Generate customers report
 */
reportsRoutes.get('/customers', async (c) => {
    try {
        const format = c.req.query('format') || 'pdf';
        const storeId = c.req.query('storeId');

        // Build query conditions
        const conditions: any[] = [eq(users.role, 'CUSTOMER')];
        if (storeId) conditions.push(eq(users.storeId, parseInt(storeId)));

        // Fetch customers
        const customersList = await db.query.users.findMany({
            where: and(...conditions),
            with: {
                customerProfiles: {
                    with: {
                        store: true
                    }
                }
            },
            columns: {
                password: false
            },
            orderBy: desc(users.createdAt),
            limit: 1000
        });

        // Format data
        const formattedData = customersList
            .filter(user => user.customerProfiles && user.customerProfiles.length > 0)
            .map(user => {
                const profile = user.customerProfiles[0];
                return {
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    storeName: profile?.store?.name || 'Unknown',
                    totalOrders: profile?.totalOrders || 0,
                    totalSales: Number(profile?.totalSales || 0),
                    totalDues: Number(profile?.totalDues || 0)
                };
            });

        // Get store name if filtered
        let storeName: string | undefined;
        if (storeId) {
            const store = await db.query.stores.findFirst({
                where: eq(stores.id, parseInt(storeId))
            });
            storeName = store?.name;
        }

        const filters = { storeName };

        // Generate file
        let buffer: Buffer;
        let contentType: string;
        let filename: string;

        if (format === 'excel') {
            buffer = await generateCustomersExcel(formattedData, filters);
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            filename = `customers_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        } else {
            buffer = await generateCustomersPDF(formattedData, filters);
            contentType = 'application/pdf';
            filename = `customers_report_${new Date().toISOString().split('T')[0]}.pdf`;
        }

        c.header('Content-Type', contentType);
        c.header('Content-Disposition', `attachment; filename="${filename}"`);
        return c.body(buffer as any);
    } catch (error: any) {
        console.error('Generate customers report error:', error);
        return c.json({ error: 'Failed to generate customers report', details: error.message }, 500);
    }
});

/**
 * GET /api/reports/delivery-performance
 * Generate delivery performance report
 */
reportsRoutes.get('/delivery-performance', async (c) => {
    try {
        const startDate = c.req.query('startDate');
        const endDate = c.req.query('endDate');

        // Build query conditions
        const conditions: any[] = [
            sql`${orders.status} IN ('DELIVERED', 'RETURNED', 'PARTIAL_RETURNED')`,
            sql`${orders.deliveryPartnerId} IS NOT NULL`
        ];

        if (startDate) conditions.push(gte(orders.deliveredAt, new Date(startDate)));
        if (endDate) conditions.push(lte(orders.deliveredAt, new Date(endDate)));

        // Fetch delivery performance data
        const performanceData = await db
            .select({
                deliveryBoyId: orders.deliveryPartnerId,
                deliveryBoyName: users.name,
                totalDeliveries: sql<number>`COUNT(*)`,
                avgDeliveryTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${orders.deliveredAt} - ${orders.outForDeliveryAt})) / 60)`,
                onTimeDeliveries: sql<number>`COUNT(CASE WHEN EXTRACT(EPOCH FROM (${orders.deliveredAt} - ${orders.outForDeliveryAt})) / 60 <= 30 THEN 1 END)`
            })
            .from(orders)
            .leftJoin(users, eq(orders.deliveryPartnerId, users.id))
            .where(and(...conditions))
            .groupBy(orders.deliveryPartnerId, users.name);

        // Format data
        const formattedData = performanceData.map(row => ({
            deliveryBoyName: row.deliveryBoyName || 'Unknown',
            totalDeliveries: Number(row.totalDeliveries),
            avgDeliveryTime: Number(row.avgDeliveryTime) || 0,
            onTimePercentage: row.totalDeliveries > 0
                ? (Number(row.onTimeDeliveries) / Number(row.totalDeliveries)) * 100
                : 0
        }));

        const filters = { startDate, endDate };

        // Generate PDF (delivery performance doesn't have Excel option)
        const buffer = await generateDeliveryPerformancePDF(formattedData, filters);
        const filename = `delivery_performance_${new Date().toISOString().split('T')[0]}.pdf`;

        c.header('Content-Type', 'application/pdf');
        c.header('Content-Disposition', `attachment; filename="${filename}"`);
        return c.body(buffer as any);
    } catch (error: any) {
        console.error('Generate delivery performance report error:', error);
        return c.json({ error: 'Failed to generate delivery performance report', details: error.message }, 500);
    }
});

/**
 * GET /api/reports/payments
 * Generate payment & dues report
 */
reportsRoutes.get('/payments', async (c) => {
    try {
        const format = c.req.query('format') || 'pdf';
        const storeId = c.req.query('storeId');

        // Build query conditions for customers with dues
        const conditions: any[] = [
            eq(users.role, 'CUSTOMER')
        ];
        if (storeId) conditions.push(eq(users.storeId, parseInt(storeId)));

        // Fetch customers with dues
        const customersWithDues = await db.query.users.findMany({
            where: and(...conditions),
            with: {
                customerProfiles: {
                    with: {
                        store: true,
                        dueClearances: {
                            orderBy: desc(dueClearances.createdAt),
                            limit: 1
                        }
                    }
                }
            },
            columns: {
                password: false
            }
        });

        // Format data
        const formattedData = customersWithDues
            .filter(user => user.customerProfiles && user.customerProfiles.length > 0)
            .map(user => {
                const profile = user.customerProfiles[0];
                const lastClearance = profile?.dueClearances?.[0];
                return {
                    customerName: user.name,
                    storeName: profile?.store?.name || 'Unknown',
                    totalDues: Number(profile?.totalDues || 0),
                    lastPaymentDate: lastClearance?.clearedDate?.toISOString().split('T')[0],
                    lastPaymentAmount: lastClearance ? Number(lastClearance.amount) : undefined
                };
            })
            .filter(customer => customer.totalDues > 0); // Filter customers with actual dues

        // Get store name if filtered
        let storeName: string | undefined;
        if (storeId) {
            const store = await db.query.stores.findFirst({
                where: eq(stores.id, parseInt(storeId))
            });
            storeName = store?.name;
        }

        const filters = { storeName };

        // Generate Excel (payments report doesn't have PDF option currently)
        const buffer = await generatePaymentsExcel(formattedData, filters);
        const filename = `payments_report_${new Date().toISOString().split('T')[0]}.xlsx`;

        c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        c.header('Content-Disposition', `attachment; filename="${filename}"`);
        return c.body(buffer as any);
    } catch (error: any) {
        console.error('Generate payments report error:', error);
        return c.json({ error: 'Failed to generate payments report', details: error.message }, 500);
    }
});

export default reportsRoutes;
