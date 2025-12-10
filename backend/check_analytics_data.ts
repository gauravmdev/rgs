
import { db } from './src/config/database';
import { orders } from './src/db/schema';
import { sql } from 'drizzle-orm';

async function checkData() {
    try {
        console.log('Checking Orders Data...');

        const totalOrders = await db.select({ count: sql<number>`count(*)` }).from(orders);
        console.log('Total Orders:', totalOrders[0].count);

        if (totalOrders[0].count === 0) {
            console.log('No orders found!');
            return;
        }

        const statusDistribution = await db
            .select({
                status: orders.status,
                count: sql<number>`count(*)`
            })
            .from(orders)
            .groupBy(orders.status);

        console.log('Status Distribution:', statusDistribution);

        const dateRange = await db
            .select({
                minDate: sql<string>`min(${orders.createdAt})`,
                maxDate: sql<string>`max(${orders.createdAt})`
            })
            .from(orders);

        console.log('Date Range:', dateRange);

        // Check recent delivered orders (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentDelivered = await db
            .select({ count: sql<number>`count(*)` })
            .from(orders)
            .where(sql`${orders.createdAt} >= ${thirtyDaysAgo.toISOString()} AND ${orders.status} = 'DELIVERED'`);

        console.log(`Delivered orders in last 30 days (since ${thirtyDaysAgo.toISOString()}):`, recentDelivered[0].count);

    } catch (error) {
        console.error('Error checking data:', error);
    } finally {
        process.exit(0);
    }
}

checkData();
