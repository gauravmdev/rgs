import { Hono } from 'hono';
import { eq, and, or, like, ilike, desc, sql, count } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '../config/database';
import { users, customers, orders, dueClearances, deliveries, returns, orderItems, stores } from '../db/schema';
import { authMiddleware, getCurrentUser } from '../middleware/auth.middleware';
import { requireAdmin, requireStoreManager } from '../middleware/role.middleware';
import { createCustomerSchema, updateCustomerSchema, clearDuesSchema } from '../utils/validators';

const customerRoutes = new Hono();

// All routes require authentication
customerRoutes.use('*', authMiddleware);

/**
 * GET /api/customers
 * Get all customers (Admin/Manager see their store's customers)
 */
customerRoutes.get('/', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');
        const offset = (page - 1) * limit;
        const search = c.req.query('search');

        // Base query
        const baseQuery = db
            .select({
                customer: customers,
                user: users,
                store: stores,
            })
            .from(customers)
            .innerJoin(users, eq(customers.userId, users.id))
            .leftJoin(stores, eq(customers.storeId, stores.id))
            .where(eq(users.role, 'CUSTOMER'));

        // Apply filters
        const conditions = [eq(users.role, 'CUSTOMER')];

        // Store filter
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId) {
            conditions.push(eq(customers.storeId, currentUser.storeId));
        }

        // Search filter (name, phone, email, apartment)
        if (search) {
            console.log(`Searching customers for store ${currentUser.role === 'STORE_MANAGER' ? currentUser.storeId : 'all'} with term:`, search);
            conditions.push(
                or(
                    ilike(users.name, `%${search}%`),
                    ilike(users.phone, `%${search}%`),
                    ilike(users.email, `%${search}%`),
                    ilike(customers.apartment, `%${search}%`)
                )!
            );
        }

        const results = await db
            .select({
                customer: customers,
                user: users,
                store: stores,
            })
            .from(customers)
            .innerJoin(users, eq(customers.userId, users.id))
            .leftJoin(stores, eq(customers.storeId, stores.id))
            .where(and(...conditions))
            .limit(limit)
            .offset(offset)
            .orderBy(desc(customers.createdAt));

        const formattedCustomers = results.map(({ customer, user, store }) => ({
            id: customer.id,
            userId: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            storeId: customer.storeId,
            storeName: store?.name,
            totalDues: parseFloat(customer.totalDues || '0'),
            totalOrders: customer.totalOrders,
            totalSales: parseFloat(customer.totalSales || '0'),
            apartment: customer.apartment,
            address: customer.address,
            isActive: user.isActive,
            createdAt: user.createdAt,
        }));

        const [totalCount] = await db
            .select({ count: count() })
            .from(customers)
            .innerJoin(users, eq(customers.userId, users.id))
            .where(and(...conditions));

        return c.json({
            customers: formattedCustomers,
            pagination: {
                page,
                limit,
                total: totalCount.count,
                totalPages: Math.ceil(totalCount.count / limit),
            },
        });
    } catch (error: any) {
        console.error('Get customers error:', error);
        throw error;
    }
});

/**
 * GET /api/customers/:id
 * Get single customer details
 */
customerRoutes.get('/:id', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const customerId = parseInt(c.req.param('id'));

        const customer = await db.query.customers.findFirst({
            where: eq(customers.id, customerId),
            with: {
                user: true,
                store: true,
                orders: {
                    limit: 10,
                    orderBy: desc(orders.createdAt),
                },
                dueClearances: {
                    limit: 10,
                    orderBy: desc(dueClearances.createdAt),
                    with: {
                        creator: {
                            columns: { name: true }
                        }
                    }
                }
            },
        });

        if (!customer) {
            return c.json({ error: 'Customer not found' }, 404);
        }

        // Check access
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId !== customer.storeId) {
            return c.json({ error: 'Access denied to this customer' }, 403);
        }

        // Remove password
        if (customer.user) {
            const { password, ...userWithoutPassword } = customer.user;
            return c.json({
                customer: {
                    ...customer,
                    user: userWithoutPassword,
                },
                orders: customer.orders,
                dueClearances: customer.dueClearances,
            });
        }

        return c.json({ customer });
    } catch (error: any) {
        console.error('Get customer error:', error);
        throw error;
    }
});

/**
 * POST /api/customers
 * Create new customer (Admin/Manager)
 */
customerRoutes.post('/', async (c) => {
    try {
        const currentUser = getCurrentUser(c);

        // Only Admin or Manager can create customers directly
        if (currentUser.role !== 'ADMIN' && currentUser.role !== 'STORE_MANAGER') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const body = await c.req.json();
        const validated = createCustomerSchema.parse(body);

        // Security: For Store Managers, FORCE their storeId regardless of request body
        let finalStoreId = validated.storeId;
        if (currentUser.role === 'STORE_MANAGER') {
            if (!currentUser.storeId) {
                return c.json({ error: 'Store manager not assigned to any store' }, 403);
            }
            finalStoreId = currentUser.storeId;
        }

        // Check if storeId is present (required for all)
        if (!finalStoreId) {
            return c.json({ error: 'Store ID is required' }, 400);
        }

        // Check if email already exists (only if provided)
        if (validated.email) {
            const existingUser = await db.query.users.findFirst({
                where: eq(users.email, validated.email),
            });

            if (existingUser) {
                return c.json({ error: 'Email already registered' }, 409);
            }
        }

        // Hash password if provided
        let hashedPassword = null;
        if (validated.password) {
            hashedPassword = await bcrypt.hash(validated.password, 10);
        }

        // Transaction to create user and customer profile
        const result = await db.transaction(async (tx) => {
            // 1. Create User
            const [newUser] = await tx.insert(users).values({
                email: validated.email || null,
                password: hashedPassword,
                name: validated.name,
                role: 'CUSTOMER',
                phone: validated.phone,
                storeId: finalStoreId,
                isActive: true,
            }).returning();

            // 2. Create Customer Profile
            const [newCustomer] = await tx.insert(customers).values({
                userId: newUser.id,
                storeId: finalStoreId,
                totalDues: '0',
                totalOrders: 0,
                totalSales: '0',
                apartment: validated.apartment,
                address: validated.address,
            }).returning();

            return { newUser, newCustomer };
        });

        // Remove password from response
        const { password, ...userWithoutPassword } = result.newUser;

        return c.json({
            message: 'Customer created successfully',
            customer: {
                id: result.newCustomer.id,
                userId: result.newUser.id,
                name: result.newUser.name,
                email: result.newUser.email,
                phone: result.newUser.phone,
                storeId: result.newUser.storeId,
                storeName: '', // Will be updated on subsequent fetches or can be inferred if needed
                totalDues: parseFloat(result.newCustomer.totalDues || '0'),
                totalOrders: result.newCustomer.totalOrders,
                totalSales: parseFloat(result.newCustomer.totalSales || '0'),
                apartment: result.newCustomer.apartment,
                address: result.newCustomer.address,
                isActive: result.newUser.isActive,
                createdAt: result.newUser.createdAt,
            },
        }, 201);
    } catch (error: any) {
        console.error('Create customer error:', error);
        throw error;
    }
});

/**
 * PUT /api/customers/:id
 * Update customer details
 */
customerRoutes.put('/:id', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const customerId = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const validated = updateCustomerSchema.parse(body);

        const customer = await db.query.customers.findFirst({
            where: eq(customers.id, customerId),
            with: { user: true }
        });

        if (!customer) {
            return c.json({ error: 'Customer not found' }, 404);
        }

        // Check access
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId !== customer.storeId) {
            return c.json({ error: 'Access denied to this customer' }, 403);
        }

        // Update user record
        const userData: any = {};
        if (validated.name) userData.name = validated.name;
        if (validated.phone) userData.phone = validated.phone;

        let userWithoutPassword: any = {};

        if (Object.keys(userData).length > 0) {
            const [updatedUser] = await db
                .update(users)
                .set(userData)
                .where(eq(users.id, customer.userId!))
                .returning();
            const { password, ...u } = updatedUser;
            userWithoutPassword = u;
        }

        // Update customer profile
        const customerData: any = {};
        if (validated.apartment !== undefined) customerData.apartment = validated.apartment;
        if (validated.address !== undefined) customerData.address = validated.address;

        if (Object.keys(customerData).length > 0) {
            await db
                .update(customers)
                .set(customerData)
                .where(eq(customers.id, customerId));
        }

        if (Object.keys(userData).length === 0 && customer.user) {
            const { password, ...u } = customer.user;
            userWithoutPassword = u;
        }

        return c.json({
            message: 'Customer updated successfully',
            user: userWithoutPassword,
        });
    } catch (error: any) {
        console.error('Update customer error:', error);
        throw error;
    }
});

/**
 * POST /api/customers/:id/clear-dues
 * Clear customer dues (partial or full)
 */
customerRoutes.post('/:id/clear-dues', async (c) => {
    try {
        const currentUser = getCurrentUser(c);

        if (currentUser.role !== 'ADMIN' && currentUser.role !== 'STORE_MANAGER') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const customerId = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const validated = clearDuesSchema.parse(body);

        const customer = await db.query.customers.findFirst({
            where: eq(customers.id, customerId),
        });

        if (!customer) {
            return c.json({ error: 'Customer not found' }, 404);
        }

        // Check access
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId !== customer.storeId) {
            return c.json({ error: 'Access denied to this customer' }, 403);
        }

        // Validate amount (cannot clear more than dues)
        // Note: Allowing overpayment is a business decision, but for now let's simple check
        // Actually, let's just allow recording the payment.

        // Transaction
        await db.transaction(async (tx) => {
            // 1. Create clearance record
            await tx.insert(dueClearances).values({
                customerId,
                amount: String(validated.amount),
                paymentMethod: validated.paymentMethod,
                clearedDate: new Date(validated.clearedDate),
                notes: validated.notes,
                createdBy: currentUser.userId,
            });

            // 2. Update customer dues
            // Note: Parsing as float for calculation, then back to string
            const currentDues = parseFloat(customer.totalDues || '0');
            const newDues = Math.max(0, currentDues - validated.amount); // Prevent negative dues

            await tx.update(customers)
                .set({ totalDues: String(newDues) })
                .where(eq(customers.id, customerId));
        });

        return c.json({
            message: 'Dues cleared successfully',
            clearedAmount: validated.amount,
        });
    } catch (error: any) {
        console.error('Clear dues error:', error);
        throw error;
    }
});


/**
 * DELETE /api/customers/:id
 * Delete customer (Admin only)
 */
customerRoutes.delete('/:id', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const customerId = parseInt(c.req.param('id'));

        if (currentUser.role !== 'ADMIN') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const customer = await db.query.customers.findFirst({
            where: eq(customers.id, customerId),
        });

        if (!customer) {
            return c.json({ error: 'Customer not found' }, 404);
        }

        const force = c.req.query('force') === 'true';

        // Check if customer has orders
        const customerOrders = await db.query.orders.findMany({
            where: eq(orders.customerId, customerId),
        });

        if (customerOrders.length > 0 && !force) {
            return c.json({
                error: 'Customer has associated orders',
                code: 'HAS_ORDERS',
                orderCount: customerOrders.length
            }, 409);
        }

        // Transaction to delete customer profile, user and potentially orders
        await db.transaction(async (tx) => {
            if (force && customerOrders.length > 0) {
                // Delete all deliveries associated with these orders
                for (const order of customerOrders) {
                    await tx.delete(deliveries).where(eq(deliveries.orderId, order.id));
                }

                // Delete all returns associated with these orders
                for (const order of customerOrders) {
                    await tx.delete(returns).where(eq(returns.orderId, order.id));
                }

                // Delete all order items associated with these orders
                for (const order of customerOrders) {
                    await tx.delete(orderItems).where(eq(orderItems.orderId, order.id));
                }

                // Delete all orders
                await tx.delete(orders).where(eq(orders.customerId, customerId));

                // Also delete due clearances
                await tx.delete(dueClearances).where(eq(dueClearances.customerId, customerId));
            }

            await tx.delete(customers).where(eq(customers.id, customerId));
            if (customer.userId) {
                await tx.delete(users).where(eq(users.id, customer.userId));
            }
        });

        return c.json({ message: 'Customer deleted successfully' });
    } catch (error: any) {
        console.error('Delete customer error:', error);
        throw error;
    }
});

export default customerRoutes;
