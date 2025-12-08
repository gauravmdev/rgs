import { Hono } from 'hono';
import { eq, and, or, like, ilike, desc, sql, count } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '../config/database';
import { users, customers, orders, dueClearances } from '../db/schema';
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

        // Build where conditions
        const conditions = [eq(users.role, 'CUSTOMER')];

        // If Store Manager, limit to their store
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId) {
            conditions.push(eq(users.storeId, currentUser.storeId));
        }

        // Search by name, phone, or email (case-insensitive)
        if (search) {
            conditions.push(
                or(
                    ilike(users.name, `%${search}%`),
                    ilike(users.phone, `%${search}%`),
                    ilike(users.email, `%${search}%`)
                )!
            );
        }

        const customersList = await db.query.users.findMany({
            where: and(...conditions),
            with: {
                customerProfiles: {
                    with: {
                        store: true,
                    }
                },
            },
            columns: {
                password: false,
            },
            limit,
            offset,
            orderBy: desc(users.createdAt),
        });

        // Flatten the structure for the response
        const formattedCustomers = customersList.map(user => {
            const profile = user.customerProfiles[0];
            return {
                id: profile?.id,
                userId: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                storeId: user.storeId,
                storeName: profile?.store?.name,
                totalDues: parseFloat(profile?.totalDues || '0'),
                totalOrders: profile?.totalOrders || 0,
                totalSales: parseFloat(profile?.totalSales || '0'),
                apartment: profile?.apartment,
                address: profile?.address,
                isActive: user.isActive,
                createdAt: user.createdAt,
            };
        }).filter(c => c.id); // Ensure only users with customer profiles

        const [totalCount] = await db
            .select({ count: count() })
            .from(users)
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

        // Check if email already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, validated.email),
        });

        if (existingUser) {
            return c.json({ error: 'Email already registered' }, 409);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(validated.password, 10);

        // Transaction to create user and customer profile
        const result = await db.transaction(async (tx) => {
            // 1. Create User
            const [newUser] = await tx.insert(users).values({
                email: validated.email,
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

        // Check if customer has orders
        const customerOrders = await db.query.orders.findFirst({
            where: eq(orders.customerId, customerId),
        });

        if (customerOrders) {
            return c.json({ error: 'Cannot delete customer with existing orders' }, 400);
        }

        // Transaction to delete customer profile and user
        await db.transaction(async (tx) => {
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
