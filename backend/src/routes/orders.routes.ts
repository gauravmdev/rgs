import { Hono } from 'hono';
import { eq, and, or, sql, desc, count, inArray } from 'drizzle-orm';
import { db } from '../config/database';
import { orders, orderItems, customers, users, stores, deliveries, returns as returnsTable } from '../db/schema';
import { authMiddleware, getCurrentUser } from '../middleware/auth.middleware';
import { requireAdmin, requireStoreManager } from '../middleware/role.middleware';
import {
    createOrderSchema,
    updateOrderSchema,
    assignOrderSchema,
    deliverOrderSchema,
    cancelOrderSchema,
    createReturnSchema
} from '../utils/validators';
import { emitToStore } from '../config/socket';
import { cacheService } from '../config/redis';

const orderRoutes = new Hono();

// All routes require authentication
orderRoutes.use('*', authMiddleware);

/**
 * Generate unique order number
 */
function generateOrderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${date}-${random}`;
}

/**
 * GET /api/orders
 * Get all orders with filtering
 */
orderRoutes.get('/', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');
        const offset = (page - 1) * limit;

        console.log('GET /orders Debug:', {
            role: currentUser.role,
            storeId: currentUser.storeId,
            queryStoreId: c.req.query('storeId'),
            userId: currentUser.userId
        });

        // Query parameters
        const status = c.req.query('status')?.split(','); // Support multiple statuses
        const storeId = c.req.query('storeId');
        const customerId = c.req.query('customerId');
        const startDate = c.req.query('startDate');
        const endDate = c.req.query('endDate');
        // source removed

        // Build where conditions based on user role
        const conditions: any[] = [];

        // Role-based filtering
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId) {
            conditions.push(eq(orders.storeId, currentUser.storeId));
        } else if (currentUser.role === 'DELIVERY_BOY') {
            conditions.push(eq(orders.deliveryPartnerId, currentUser.userId));
        } else if (currentUser.role === 'CUSTOMER') {
            // Get customer record
            const customer = await db.query.customers.findFirst({
                where: eq(customers.userId, currentUser.userId),
            });
            if (customer) {
                conditions.push(eq(orders.customerId, customer.id));
            }
        }

        // Additional filters
        if (status && status.length > 0) {
            conditions.push(inArray(orders.status, status as any));
        }
        if (storeId && currentUser.role === 'ADMIN') {
            conditions.push(eq(orders.storeId, parseInt(storeId)));
        }
        if (customerId) {
            conditions.push(eq(orders.customerId, parseInt(customerId)));
        }
        // source filter removed
        if (startDate) {
            conditions.push(sql`${orders.createdAt} >= ${new Date(startDate)}`);
        }
        if (endDate) {
            conditions.push(sql`${orders.createdAt} <= ${new Date(endDate)}`);
        }

        // Fetch orders with related data
        const ordersList = await db.query.orders.findMany({
            where: conditions.length > 0 ? and(...conditions) : undefined,
            with: {
                customer: {
                    with: {
                        user: {
                            columns: { password: false },
                        },
                    },
                },
                store: true,
                deliveryPartner: {
                    columns: { password: false },
                },
                items: true,
            },
            orderBy: desc(orders.createdAt),
            limit,
            offset,
        });

        // Transform response
        const transformedOrders = ordersList.map(order => ({
            ...order,
            customerName: order.customer?.user?.name || 'Unknown',
            storeName: order.store?.name || 'Unknown',
            deliveryPartnerName: order.deliveryPartner?.name,
        }));

        const [totalCount] = await db
            .select({ count: count() })
            .from(orders)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        return c.json({
            orders: transformedOrders,
            pagination: {
                page,
                limit,
                total: totalCount.count,
                totalPages: Math.ceil(totalCount.count / limit),
            },
        });
    } catch (error: any) {
        console.error('Get orders error:', error);
        throw error;
    }
});

/**
 * GET /api/orders/:id
 * Get single order details
 */
orderRoutes.get('/:id', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const orderId = parseInt(c.req.param('id'));

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
            with: {
                customer: {
                    with: {
                        user: {
                            columns: { password: false },
                        },
                    },
                },
                store: true,
                deliveryPartner: {
                    columns: { password: false },
                },
                items: true,
                returns: true,
            },
        });

        if (!order) {
            return c.json({ error: 'Order not found' }, 404);
        }

        // Check access permissions
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId !== order.storeId) {
            return c.json({ error: 'Access denied' }, 403);
        }
        if (currentUser.role === 'DELIVERY_BOY' && order.deliveryPartnerId !== currentUser.userId) {
            return c.json({ error: 'Access denied' }, 403);
        }
        if (currentUser.role === 'CUSTOMER') {
            const customer = await db.query.customers.findFirst({
                where: eq(customers.userId, currentUser.userId),
            });
            if (!customer || order.customerId !== customer.id) {
                return c.json({ error: 'Access denied' }, 403);
            }
        }

        // Get delivery info if exists
        const delivery = await db.query.deliveries.findFirst({
            where: eq(deliveries.orderId, orderId),
        });

        return c.json({
            order: {
                ...order,
                customerName: order.customer?.user?.name || 'Unknown',
                storeName: order.store?.name || 'Unknown',
                deliveryPartnerName: order.deliveryPartner?.name,
            },
            delivery,
        });
    } catch (error: any) {
        console.error('Get order error:', error);
        throw error;
    }
});

/**
 * POST /api/orders
 * Create new order (Store Manager or Customer)
 */
orderRoutes.post('/', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const body = await c.req.json();
        const validated = createOrderSchema.parse(body);

        // Security: For Store Managers, FORCE their storeId regardless of request body
        let finalStoreId = validated.storeId;
        if (currentUser.role === 'STORE_MANAGER') {
            if (!currentUser.storeId) {
                return c.json({ error: 'Store manager not assigned to any store' }, 403);
            }
            finalStoreId = currentUser.storeId;
        }

        // If customer is creating order, validate it's their store
        if (currentUser.role === 'CUSTOMER') {
            const customer = await db.query.customers.findFirst({
                where: eq(customers.userId, currentUser.userId),
            });
            if (!customer || customer.storeId !== validated.storeId) {
                return c.json({ error: 'Invalid store for this customer' }, 400);
            }
        }

        // Validate customer exists
        const customer = await db.query.customers.findFirst({
            where: eq(customers.id, validated.customerId),
        });

        if (!customer) {
            return c.json({ error: 'Customer not found' }, 404);
        }

        // Generate order number
        const orderNumber = generateOrderNumber();

        // Create order
        const [newOrder] = await db.insert(orders).values({
            orderNumber,
            customerId: validated.customerId,
            storeId: finalStoreId, // Use forced storeId
            // source removed
            status: 'CREATED',
            invoiceNumber: validated.invoiceNumber || null,
            invoiceAmount: validated.invoiceAmount.toString(),
            totalItems: validated.totalItems,
            notes: validated.notes || null,
            paymentStatus: 'PENDING',
        }).returning();

        // Create order items
        await db.insert(orderItems).values(
            validated.items.map(item => ({
                orderId: newOrder.id,
                description: item.description,
                quantity: item.quantity,
            }))
        );

        // Increment customer's total orders
        await db
            .update(customers)
            .set({ totalOrders: sql`${customers.totalOrders} + 1` })
            .where(eq(customers.id, validated.customerId));

        // Invalidate cache
        await cacheService.invalidateOrderCache(newOrder.id, finalStoreId);

        // Emit real-time update
        emitToStore(finalStoreId, 'order-created', newOrder);

        return c.json({
            message: 'Order created successfully',
            order: newOrder,
        }, 201);
    } catch (error: any) {
        console.error('Create order error:', error);
        throw error;
    }
});

/**
 * PUT /api/orders/:id
 * Update order (only if not delivered)
 */
orderRoutes.put('/:id', requireStoreManager, async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const orderId = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const validated = updateOrderSchema.parse(body);

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
        });

        if (!order) {
            return c.json({ error: 'Order not found' }, 404);
        }

        // Check store access strictly
        if (currentUser.role === 'STORE_MANAGER') {
            if (!currentUser.storeId) {
                return c.json({ error: 'Store manager not assigned to any store' }, 403);
            }
            if (currentUser.storeId !== order.storeId) {
                return c.json({ error: 'Access denied: You can only update orders from your store' }, 403);
            }
        }

        // Can only edit if status is CREATED or ASSIGNED or OUT_FOR_DELIVERY
        if (!['CREATED', 'ASSIGNED', 'OUT_FOR_DELIVERY'].includes(order.status || '')) {
            return c.json({ error: 'Cannot edit order in current status' }, 400);
        }

        // Update order
        const [updatedOrder] = await db
            .update(orders)
            .set({
                invoiceNumber: validated.invoiceNumber,
                invoiceAmount: validated.invoiceAmount?.toString(),
                totalItems: validated.totalItems,
                notes: validated.notes,
                updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId))
            .returning();

        // Update items if provided
        if (validated.items) {
            // Delete old items
            await db.delete(orderItems).where(eq(orderItems.orderId, orderId));

            // Insert new items
            await db.insert(orderItems).values(
                validated.items.map(item => ({
                    orderId,
                    description: item.description,
                    quantity: item.quantity,
                }))
            );
        }

        // Invalidate cache
        if (order.storeId) {
            await cacheService.invalidateOrderCache(orderId, order.storeId);
            // Emit real-time update
            emitToStore(order.storeId, 'order-updated', updatedOrder);
        }

        return c.json({
            message: 'Order updated successfully',
            order: updatedOrder,
        });
    } catch (error: any) {
        console.error('Update order error:', error);
        throw error;
    }
});

/**
 * DELETE /api/orders/:id
 * Delete order (only cancelled orders, Admin only)
 */
orderRoutes.delete('/:id', requireAdmin, async (c) => {
    try {
        const orderId = parseInt(c.req.param('id'));

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
        });

        if (!order) {
            return c.json({ error: 'Order not found' }, 404);
        }

        if (order.status !== 'CANCELLED') {
            return c.json({ error: 'Can only delete cancelled orders' }, 400);
        }

        // Delete order items first
        await db.delete(orderItems).where(eq(orderItems.orderId, orderId));

        // Delete order
        await db.delete(orders).where(eq(orders.id, orderId));

        // Invalidate cache
        if (order.storeId) {
            await cacheService.invalidateOrderCache(orderId, order.storeId);
        }

        return c.json({ message: 'Order deleted successfully' });
    } catch (error: any) {
        console.error('Delete order error:', error);
        throw error;
    }
});

/**
 * PUT /api/orders/:id/assign
 * Assign delivery partner to order (Store Managers)
 */
orderRoutes.put('/:id/assign', requireStoreManager, async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const orderId = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const validated = assignOrderSchema.parse(body);

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
        });

        if (!order) {
            return c.json({ error: 'Order not found' }, 404);
        }

        // Check store access strictly
        if (currentUser.role === 'STORE_MANAGER') {
            if (!currentUser.storeId) {
                return c.json({ error: 'Store manager not assigned to any store' }, 403);
            }
            if (currentUser.storeId !== order.storeId) {
                return c.json({ error: 'Access denied: You can only assign orders from your store' }, 403);
            }
        }

        // Can only assign if status is CREATED
        if (order.status !== 'CREATED') {
            return c.json({ error: 'Order is already assigned or in progress' }, 400);
        }

        if (!order.storeId) {
            return c.json({ error: 'Order does not have a valid store' }, 400);
        }

        // Validate delivery partner exists and is from same store
        const deliveryPartner = await db.query.users.findFirst({
            where: and(
                eq(users.id, validated.deliveryPartnerId),
                eq(users.role, 'DELIVERY_BOY'),
                eq(users.storeId, order.storeId),
                eq(users.isActive, true)
            ),
        });

        if (!deliveryPartner) {
            return c.json({ error: 'Invalid delivery partner for this store' }, 400);
        }

        const assignedAt = new Date();

        // Update order
        const [updatedOrder] = await db
            .update(orders)
            .set({
                status: 'ASSIGNED',
                deliveryPartnerId: validated.deliveryPartnerId,
                assignedAt,
                updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId))
            .returning();

        // Create delivery record
        await db.insert(deliveries).values({
            orderId,
            deliveryPartnerId: validated.deliveryPartnerId,
            assignedAt,
        });

        // Invalidate cache
        await cacheService.invalidateOrderCache(orderId, order.storeId);

        // Emit real-time updates
        emitToStore(order.storeId, 'order-assigned', updatedOrder);

        return c.json({
            message: 'Order assigned successfully',
            order: updatedOrder,
        });
    } catch (error: any) {
        console.error('Assign order error:', error);
        throw error;
    }
});

/**
 * PUT /api/orders/:id/out-for-delivery
 * Mark order as out for delivery (Delivery Boys)
 */
orderRoutes.put('/:id/out-for-delivery', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const orderId = parseInt(c.req.param('id'));

        // Only delivery boys, admins, OR store managers can mark out for delivery
        if (currentUser.role !== 'DELIVERY_BOY' && currentUser.role !== 'ADMIN' && currentUser.role !== 'STORE_MANAGER') {
            return c.json({ error: 'Access denied' }, 403);
        }

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
        });

        if (!order) {
            return c.json({ error: 'Order not found' }, 404);
        }

        // Check permissions
        if (currentUser.role === 'STORE_MANAGER') {
            if (currentUser.storeId !== order.storeId) {
                return c.json({ error: 'Access denied' }, 403);
            }
        } else if (currentUser.role === 'DELIVERY_BOY') {
            if (order.deliveryPartnerId !== currentUser.userId) {
                return c.json({ error: 'This order is not assigned to you' }, 403);
            }
        }

        // Can only mark out for delivery if status is ASSIGNED
        if (order.status !== 'ASSIGNED') {
            return c.json({ error: 'Order must be in ASSIGNED status' }, 400);
        }

        const outForDeliveryAt = new Date();

        // Update order
        const [updatedOrder] = await db
            .update(orders)
            .set({
                status: 'OUT_FOR_DELIVERY',
                outForDeliveryAt,
                updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId))
            .returning();

        // Update delivery record
        await db
            .update(deliveries)
            .set({ outForDeliveryAt })
            .where(eq(deliveries.orderId, orderId));

        // Invalidate cache
        if (order.storeId) {
            await cacheService.invalidateOrderCache(orderId, order.storeId);
            // Emit real-time update
            emitToStore(order.storeId, 'order-out-for-delivery', updatedOrder);
        }

        return c.json({
            message: 'Order marked as out for delivery',
            order: updatedOrder,
        });
    } catch (error: any) {
        console.error('Out for delivery error:', error);
        throw error;
    }
});

/**
 * PUT /api/orders/:id/deliver
 * Mark order as delivered (Delivery Boys)
 */
orderRoutes.put('/:id/deliver', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const orderId = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const validated = deliverOrderSchema.parse(body);

        // Only delivery boys, admins, OR store managers can mark delivered
        if (currentUser.role !== 'DELIVERY_BOY' && currentUser.role !== 'ADMIN' && currentUser.role !== 'STORE_MANAGER') {
            return c.json({ error: 'Access denied' }, 403);
        }

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
            with: {
                customer: true,
            },
        });

        if (!order) {
            return c.json({ error: 'Order not found' }, 404);
        }

        // Check permissions
        if (currentUser.role === 'STORE_MANAGER') {
            if (currentUser.storeId !== order.storeId) {
                return c.json({ error: 'Access denied' }, 403);
            }
        } else if (currentUser.role === 'DELIVERY_BOY') {
            if (order.deliveryPartnerId !== currentUser.userId) {
                return c.json({ error: 'This order is not assigned to you' }, 403);
            }
        }

        // Can only deliver if status is OUT_FOR_DELIVERY
        if (order.status !== 'OUT_FOR_DELIVERY') {
            return c.json({ error: 'Order must be out for delivery' }, 400);
        }

        const deliveredAt = new Date();

        // Update order
        const [updatedOrder] = await db
            .update(orders)
            .set({
                status: 'DELIVERED',
                deliveredAt,
                paymentMethod: validated.paymentMethod,
                paymentStatus: 'PAID',
                updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId))
            .returning();

        // Calculate delivery time
        const delivery = await db.query.deliveries.findFirst({
            where: eq(deliveries.orderId, orderId),
        });

        if (delivery?.assignedAt) {
            const deliveryTimeMinutes = Math.floor(
                (deliveredAt.getTime() - delivery.assignedAt.getTime()) / 60000
            );

            await db
                .update(deliveries)
                .set({
                    deliveredAt,
                    deliveryTimeMinutes
                })
                .where(eq(deliveries.orderId, orderId));
        }

        // Update customer stats
        const invoiceAmount = order.invoiceAmount ? parseFloat(order.invoiceAmount) : 0;

        if (order.customerId) {
            const updateData: any = {
                totalSales: sql`${customers.totalSales} + ${invoiceAmount}`,
            };

            if (validated.paymentMethod === 'CUSTOMER_CREDIT') {
                updateData.totalDues = sql`${customers.totalDues} + ${invoiceAmount}`;
            }

            await db
                .update(customers)
                .set(updateData)
                .where(eq(customers.id, order.customerId));
        }

        // Invalidate cache
        if (order.storeId) {
            await cacheService.invalidateOrderCache(orderId, order.storeId);
            // Emit real-time update
            emitToStore(order.storeId, 'order-delivered', updatedOrder);
        }

        return c.json({
            message: 'Order delivered successfully',
            order: updatedOrder,
            customerCredit: validated.paymentMethod === 'CUSTOMER_CREDIT' ? invoiceAmount : 0,
        });
    } catch (error: any) {
        console.error('Deliver order error:', error);
        throw error;
    }
});

/**
 * POST /api/orders/:id/cancel
 * Cancel order (Admin and Store Managers)
 */
orderRoutes.post('/:id/cancel', requireStoreManager, async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const orderId = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const validated = cancelOrderSchema.parse(body);

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
        });

        if (!order) {
            return c.json({ error: 'Order not found' }, 404);
        }

        // Check store access
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId !== order.storeId) {
            return c.json({ error: 'Access denied' }, 403);
        }

        // Can only cancel if status is CREATED or ASSIGNED
        if (!['CREATED', 'ASSIGNED'].includes(order.status || '')) {
            return c.json({ error: 'Cannot cancel order in current status' }, 400);
        }

        // Update order
        const [updatedOrder] = await db
            .update(orders)
            .set({
                status: 'CANCELLED',
                notes: validated.reason
                    ? `${order.notes || ''}\nCancellation reason: ${validated.reason}`
                    : order.notes,
                updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId))
            .returning();

        // Invalidate cache
        if (order.storeId) {
            await cacheService.invalidateOrderCache(orderId, order.storeId);
            // Emit real-time update
            emitToStore(order.storeId, 'order-cancelled', updatedOrder);
        }

        return c.json({
            message: 'Order cancelled successfully',
            order: updatedOrder,
        });
    } catch (error: any) {
        console.error('Cancel order error:', error);
        throw error;
    }
});

/**
 * POST /api/orders/:id/return
 * Process order return (Admin and Store Managers)
 */
orderRoutes.post('/:id/return', requireStoreManager, async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const orderId = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const validated = createReturnSchema.parse(body);

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
            with: {
                customer: true,
            },
        });

        if (!order) {
            return c.json({ error: 'Order not found' }, 404);
        }

        // Check store access
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId !== order.storeId) {
            return c.json({ error: 'Access denied' }, 403);
        }

        // Can only return if status is DELIVERED
        if (order.status !== 'DELIVERED') {
            return c.json({ error: 'Can only return delivered orders' }, 400);
        }

        // Validate refund amount
        const invoiceAmount = order.invoiceAmount ? parseFloat(order.invoiceAmount) : 0;
        if (validated.refundAmount > invoiceAmount) {
            return c.json({ error: 'Refund amount cannot exceed order amount' }, 400);
        }

        // Create return record
        const [returnRecord] = await db.insert(returnsTable).values({
            orderId,
            returnType: validated.returnType,
            refundAmount: validated.refundAmount.toString(),
            refundMethod: validated.refundMethod,
            reason: validated.reason || null,
            processedBy: currentUser.userId,
            processedAt: new Date(),
        }).returning();

        // Update order status
        const newStatus = validated.returnType === 'FULL' ? 'RETURNED' : 'PARTIAL_RETURNED';

        const [updatedOrder] = await db
            .update(orders)
            .set({
                status: newStatus,
                paymentStatus: 'REFUNDED',
                updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId))
            .returning();

        // Update customer stats or dues
        if (order.customerId) {
            // Reduce total sales
            const updateData: any = {
                totalSales: sql`${customers.totalSales} - ${validated.refundAmount}`,
            };

            const shouldReduceDues = (order.paymentMethod === 'CUSTOMER_CREDIT' && validated.refundMethod !== 'CUSTOMER_CREDIT') ||
                (validated.refundMethod === 'CUSTOMER_CREDIT');

            if (shouldReduceDues) {
                updateData.totalDues = sql`${customers.totalDues} - ${validated.refundAmount}`;
            }

            await db
                .update(customers)
                .set(updateData)
                .where(eq(customers.id, order.customerId));
        }

        // Invalidate cache
        if (order.storeId) {
            await cacheService.invalidateOrderCache(orderId, order.storeId);
            // Emit real-time update
            emitToStore(order.storeId, 'order-returned', updatedOrder);
        }

        return c.json({
            message: `Order ${validated.returnType.toLowerCase()} return processed successfully`,
            order: updatedOrder,
            return: returnRecord,
        });
    } catch (error: any) {
        console.error('Return order error:', error);
        throw error;
    }
});

/**
 * GET /api/orders/:id/returns
 * Get return details for an order
 */
orderRoutes.get('/:id/returns', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const orderId = parseInt(c.req.param('id'));

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
        });

        if (!order) {
            return c.json({ error: 'Order not found' }, 404);
        }

        // Check access
        if (currentUser.role === 'STORE_MANAGER' && currentUser.storeId !== order.storeId) {
            return c.json({ error: 'Access denied' }, 403);
        }

        const returnRecords = await db.query.returns.findMany({
            where: eq(returnsTable.orderId, orderId),
            with: {
                processor: {
                    columns: { password: false },
                },
            },
        });

        return c.json({ returns: returnRecords });
    } catch (error: any) {
        console.error('Get returns error:', error);
        throw error;
    }
});

export default orderRoutes;
