import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { users, stores, customers, orders, orderItems, deliveries } from './schema';

async function seed() {
    console.log('🌱 Starting database seed...');

    try {
        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await db.delete(orderItems);
        await db.delete(deliveries);
        await db.delete(orders);
        await db.delete(customers);
        await db.delete(users);
        await db.delete(stores);

        // Hash password once for all users
        const hashedPassword = await bcrypt.hash('password123', 10);

        // 1. Create Admin
        console.log('👤 Creating admin user...');
        const [admin] = await db.insert(users).values({
            email: 'admin@delivery.com',
            password: hashedPassword,
            name: 'Super Admin',
            role: 'ADMIN',
            phone: '+919999999999',
            isActive: true,
        }).returning();

        // 2. Create Stores
        console.log('🏪 Creating stores...');
        const [store1] = await db.insert(stores).values({
            name: 'Downtown Store',
            address: '123 Main St, Downtown, Mumbai',
            phone: '+919999999991',
            isActive: true,
        }).returning();

        const [store2] = await db.insert(stores).values({
            name: 'Uptown Store',
            address: '456 Park Ave, Uptown, Mumbai',
            phone: '+919999999992',
            isActive: true,
        }).returning();

        // 3. Create Store Managers
        console.log('👔 Creating store managers...');
        const [manager1] = await db.insert(users).values({
            email: 'manager1@delivery.com',
            password: hashedPassword,
            name: 'John Manager',
            role: 'STORE_MANAGER',
            phone: '+919999999981',
            storeId: store1.id,
            isActive: true,
        }).returning();

        const [manager2] = await db.insert(users).values({
            email: 'manager2@delivery.com',
            password: hashedPassword,
            name: 'Jane Manager',
            role: 'STORE_MANAGER',
            phone: '+919999999982',
            storeId: store2.id,
            isActive: true,
        }).returning();

        // 4. Create Delivery Boys
        console.log('🛵 Creating delivery boys...');
        const deliveryBoys = [];

        const [delivery1] = await db.insert(users).values({
            email: 'delivery1@delivery.com',
            password: hashedPassword,
            name: 'Mike Delivery',
            role: 'DELIVERY_BOY',
            phone: '+919999999971',
            storeId: store1.id,
            isActive: true,
        }).returning();
        deliveryBoys.push(delivery1);

        const [delivery2] = await db.insert(users).values({
            email: 'delivery2@delivery.com',
            password: hashedPassword,
            name: 'Sarah Delivery',
            role: 'DELIVERY_BOY',
            phone: '+919999999972',
            storeId: store1.id,
            isActive: true,
        }).returning();
        deliveryBoys.push(delivery2);

        const [delivery3] = await db.insert(users).values({
            email: 'delivery3@delivery.com',
            password: hashedPassword,
            name: 'Tom Delivery',
            role: 'DELIVERY_BOY',
            phone: '+919999999973',
            storeId: store2.id,
            isActive: true,
        }).returning();
        deliveryBoys.push(delivery3);

        const [delivery4] = await db.insert(users).values({
            email: 'delivery4@delivery.com',
            password: hashedPassword,
            name: 'Lisa Delivery',
            role: 'DELIVERY_BOY',
            phone: '+919999999974',
            storeId: store2.id,
            isActive: true,
        }).returning();
        deliveryBoys.push(delivery4);

        // 5. Create Customers
        console.log('👥 Creating customers...');
        const customerData = [];

        for (let i = 1; i <= 10; i++) {
            const storeId = i % 2 === 0 ? store1.id : store2.id;

            const [user] = await db.insert(users).values({
                email: `customer${i}@test.com`,
                password: hashedPassword,
                name: `Customer ${i}`,
                role: 'CUSTOMER',
                phone: `+9199999996${i < 10 ? '0' + i : i}`,
                storeId,
                isActive: true,
            }).returning();

            const [customer] = await db.insert(customers).values({
                userId: user.id,
                storeId,
                totalDues: '0',
                totalOrders: 0,
                totalSales: '0',
            }).returning();

            customerData.push({ user, customer });
        }

        // 6. Create Sample Orders
        console.log('📦 Creating sample orders...');
        const orderStatuses = ['CREATED', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
        // source array removed
        const paymentMethods = ['CASH', 'CARD', 'UPI', 'CUSTOMER_CREDIT'];

        for (let i = 1; i <= 20; i++) {
            const customerIndex = Math.floor(Math.random() * customerData.length);
            const { customer } = customerData[customerIndex];
            const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)] as any;
            // source removed
            const amount = Math.floor(Math.random() * 180) + 20;
            const itemCount = Math.floor(Math.random() * 4) + 2;

            const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(i).padStart(4, '0')}`;

            let paymentMethod = null;
            let paymentStatus: 'PENDING' | 'PAID' = 'PENDING';
            let deliveryPartnerId = null;
            let assignedAt = null;
            let outForDeliveryAt = null;
            let deliveredAt = null;

            if (status === 'ASSIGNED' || status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED') {
                const storeDeliveryBoys = deliveryBoys.filter(d => d.storeId === customer.storeId);
                deliveryPartnerId = storeDeliveryBoys[Math.floor(Math.random() * storeDeliveryBoys.length)].id;
                assignedAt = new Date(Date.now() - Math.random() * 3600000);
            }

            if (status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED') {
                outForDeliveryAt = new Date(assignedAt!.getTime() + Math.random() * 1800000);
            }

            if (status === 'DELIVERED') {
                deliveredAt = new Date(outForDeliveryAt!.getTime() + Math.random() * 1800000);
                paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)] as any;
                paymentStatus = 'PAID';

                await db.update(customers)
                    .set({
                        totalOrders: (customer.totalOrders || 0) + 1,
                        totalSales: String(parseFloat(customer.totalSales || '0') + amount),
                        totalDues: paymentMethod === 'CUSTOMER_CREDIT'
                            ? String(parseFloat(customer.totalDues || '0') + amount)
                            : (customer.totalDues || '0'),
                    })
                    .where(eq(customers.id, customer.id));
            }

            const [order] = await db.insert(orders).values({
                orderNumber,
                customerId: customer.id,
                storeId: customer.storeId,
                // source removed
                status,
                invoiceNumber: `INV-${i}`,
                invoiceAmount: String(amount),
                totalItems: itemCount,
                paymentMethod,
                paymentStatus,
                deliveryPartnerId,
                assignedAt,
                outForDeliveryAt,
                deliveredAt,
                notes: `Sample order ${i}`,
            }).returning();

            for (let j = 1; j <= itemCount; j++) {
                await db.insert(orderItems).values({
                    orderId: order.id,
                    description: `Item ${j} for order ${orderNumber}`,
                    quantity: Math.floor(Math.random() * 3) + 1,
                });
            }

            if (deliveryPartnerId) {
                await db.insert(deliveries).values({
                    orderId: order.id,
                    deliveryPartnerId,
                    assignedAt,
                    outForDeliveryAt,
                    deliveredAt,
                    deliveryTimeMinutes: deliveredAt
                        ? Math.floor((deliveredAt.getTime() - assignedAt!.getTime()) / 60000)
                        : null,
                });
            }
        }

        console.log('✅ Seed completed successfully!');
        console.log('\n📊 Created:');
        console.log('  - 1 Admin');
        console.log('  - 2 Stores');
        console.log('  - 2 Store Managers');
        console.log('  - 4 Delivery Boys');
        console.log('  - 10 Customers');
        console.log('  - 20 Orders with items');
        console.log('\n🔑 Login credentials (password for all: password123):');
        console.log('  Admin: admin@delivery.com');
        console.log('  Manager 1: manager1@delivery.com');
        console.log('  Manager 2: manager2@delivery.com');
        console.log('  Delivery 1-4: delivery1-4@delivery.com');
        console.log('  Customers: customer1-10@test.com');

    } catch (error) {
        console.error('❌ Seed failed:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

seed();
