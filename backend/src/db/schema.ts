import { pgTable, serial, text, varchar, integer, boolean, timestamp, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

// -----------------------------------------------------------------------------
// 1. ENUMS
// -----------------------------------------------------------------------------
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'STORE_MANAGER', 'DELIVERY_BOY', 'CUSTOMER']);
export const orderSourceEnum = pgEnum('order_source', ['ONLINE', 'WALK_IN', 'CALL_WHATSAPP']);
export const orderStatusEnum = pgEnum('order_status', ['CREATED', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'PARTIAL_RETURNED']);
export const paymentMethodEnum = pgEnum('payment_method', ['CASH', 'CARD', 'UPI', 'CUSTOMER_CREDIT']);
export const paymentStatusEnum = pgEnum('payment_status', ['PENDING', 'PAID', 'REFUNDED']);
export const returnTypeEnum = pgEnum('return_type', ['FULL', 'PARTIAL']);

// -----------------------------------------------------------------------------
// 2. TABLES
// -----------------------------------------------------------------------------

/**
 * STORES
 * Manage multiple store locations
 */
export const stores = pgTable('stores', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    address: text('address').notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    isActive: boolean('isActive').default(true),
    createdAt: timestamp('createdAt').defaultNow(),
});

/**
 * USERS
 * System users including admins, managers, and delivery partners
 */
export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    role: userRoleEnum('role'),
    phone: varchar('phone', { length: 20 }).notNull(),
    storeId: integer('storeId').references(() => stores.id),
    isActive: boolean('isActive').default(true),
    createdAt: timestamp('createdAt').defaultNow(),
    updatedAt: timestamp('updatedAt').defaultNow(),
});

/**
 * CUSTOMERS
 * Customer profiles linked to users and stores
 */
export const customers = pgTable('customers', {
    id: serial('id').primaryKey(),
    userId: integer('userId').references(() => users.id),
    storeId: integer('storeId').references(() => stores.id),
    totalDues: decimal('totalDues', { precision: 10, scale: 2 }).default('0'),
    totalOrders: integer('totalOrders').default(0),
    totalSales: decimal('totalSales', { precision: 10, scale: 2 }).default('0'),
    apartment: varchar('apartment', { length: 50 }),
    address: text('address'),
    createdAt: timestamp('createdAt').defaultNow(),
});

/**
 * ORDERS
 * Core order management
 */
export const orders = pgTable('orders', {
    id: serial('id').primaryKey(),
    orderNumber: varchar('orderNumber', { length: 50 }).notNull().unique(),
    customerId: integer('customerId').references(() => customers.id),
    storeId: integer('storeId').references(() => stores.id),
    source: orderSourceEnum('source'),
    status: orderStatusEnum('status').default('CREATED'),
    invoiceNumber: varchar('invoiceNumber', { length: 100 }),
    invoiceAmount: decimal('invoiceAmount', { precision: 10, scale: 2 }).notNull(),
    totalItems: integer('totalItems').notNull(),
    paymentMethod: paymentMethodEnum('paymentMethod'),
    paymentStatus: paymentStatusEnum('paymentStatus').default('PENDING'),
    deliveryPartnerId: integer('deliveryPartnerId').references(() => users.id),
    assignedAt: timestamp('assignedAt'),
    outForDeliveryAt: timestamp('outForDeliveryAt'),
    deliveredAt: timestamp('deliveredAt'),
    notes: text('notes'),
    createdAt: timestamp('createdAt').defaultNow(),
    updatedAt: timestamp('updatedAt').defaultNow(),
});

/**
 * ORDER ITEMS
 * Individual items within an order
 */
export const orderItems = pgTable('order_items', {
    id: serial('id').primaryKey(),
    orderId: integer('orderId').references(() => orders.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('createdAt').defaultNow(),
});

/**
 * DELIVERIES
 * Tracking delivery attempts and details
 */
export const deliveries = pgTable('deliveries', {
    id: serial('id').primaryKey(),
    orderId: integer('orderId').references(() => orders.id),
    deliveryPartnerId: integer('deliveryPartnerId').references(() => users.id),
    assignedAt: timestamp('assignedAt').defaultNow(),
    outForDeliveryAt: timestamp('outForDeliveryAt'),
    deliveredAt: timestamp('deliveredAt'),
    deliveryTimeMinutes: integer('deliveryTimeMinutes'),
});

/**
 * DUE CLEARANCES
 * Records of customer credit clearances
 */
export const dueClearances = pgTable('due_clearances', {
    id: serial('id').primaryKey(),
    customerId: integer('customerId').references(() => customers.id),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('paymentMethod'),
    clearedDate: timestamp('clearedDate').notNull(),
    notes: text('notes'),
    createdBy: integer('createdBy').references(() => users.id),
    createdAt: timestamp('createdAt').defaultNow(),
});

/**
 * RETURNS
 * Handling order returns and refunds
 */
export const returns = pgTable('returns', {
    id: serial('id').primaryKey(),
    orderId: integer('orderId').references(() => orders.id),
    returnType: returnTypeEnum('returnType'),
    refundAmount: decimal('refundAmount', { precision: 10, scale: 2 }).notNull(),
    refundMethod: paymentMethodEnum('refundMethod'),
    reason: text('reason'),
    processedBy: integer('processedBy').references(() => users.id),
    processedAt: timestamp('processedAt').defaultNow(),
    createdAt: timestamp('createdAt').defaultNow(),
});


// -----------------------------------------------------------------------------
// 3. RELATIONS
// -----------------------------------------------------------------------------

export const storesRelations = relations(stores, ({ many }) => ({
    users: many(users),
    customers: many(customers),
    orders: many(orders),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
    store: one(stores, {
        fields: [users.storeId],
        references: [stores.id],
    }),
    // A user can be associated with many customer profiles (though usually 1:1 in context, DB allows many)
    customerProfiles: many(customers),
    // Deliveries assigned to this user (as delivery partner)
    deliveries: many(deliveries),
    // Orders assigned to this user (as delivery partner)
    assignedOrders: many(orders),
    // Clearances created by this user
    createdClearances: many(dueClearances),
    // Returns processed by this user
    processedReturns: many(returns),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
    user: one(users, {
        fields: [customers.userId],
        references: [users.id],
    }),
    store: one(stores, {
        fields: [customers.storeId],
        references: [stores.id],
    }),
    orders: many(orders),
    dueClearances: many(dueClearances),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
    customer: one(customers, {
        fields: [orders.customerId],
        references: [customers.id],
    }),
    store: one(stores, {
        fields: [orders.storeId],
        references: [stores.id],
    }),
    deliveryPartner: one(users, {
        fields: [orders.deliveryPartnerId],
        references: [users.id],
    }),
    items: many(orderItems),
    deliveries: many(deliveries),
    returns: many(returns),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, {
        fields: [orderItems.orderId],
        references: [orders.id],
    }),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
    order: one(orders, {
        fields: [deliveries.orderId],
        references: [orders.id],
    }),
    deliveryPartner: one(users, {
        fields: [deliveries.deliveryPartnerId],
        references: [users.id],
    }),
}));

export const dueClearancesRelations = relations(dueClearances, ({ one }) => ({
    customer: one(customers, {
        fields: [dueClearances.customerId],
        references: [customers.id],
    }),
    creator: one(users, {
        fields: [dueClearances.createdBy],
        references: [users.id],
    }),
}));

export const returnsRelations = relations(returns, ({ one }) => ({
    order: one(orders, {
        fields: [returns.orderId],
        references: [orders.id],
    }),
    processor: one(users, {
        fields: [returns.processedBy],
        references: [users.id],
    }),
}));


// -----------------------------------------------------------------------------
// 4. TYPES
// -----------------------------------------------------------------------------

export type Store = InferSelectModel<typeof stores>;
export type NewStore = InferInsertModel<typeof stores>;

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Customer = InferSelectModel<typeof customers>;
export type NewCustomer = InferInsertModel<typeof customers>;

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;

export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;

export type Delivery = InferSelectModel<typeof deliveries>;
export type NewDelivery = InferInsertModel<typeof deliveries>;

export type DueClearance = InferSelectModel<typeof dueClearances>;
export type NewDueClearance = InferInsertModel<typeof dueClearances>;

export type Return = InferSelectModel<typeof returns>;
export type NewReturn = InferInsertModel<typeof returns>;


// -----------------------------------------------------------------------------
// 5. EXPORT
// -----------------------------------------------------------------------------

export const schema = {
    // Enums
    userRoleEnum,
    orderSourceEnum,
    orderStatusEnum,
    paymentMethodEnum,
    paymentStatusEnum,
    returnTypeEnum,
    // Tables
    stores,
    users,
    customers,
    orders,
    orderItems,
    deliveries,
    dueClearances,
    returns,
    // Relations
    storesRelations,
    usersRelations,
    customersRelations,
    ordersRelations,
    orderItemsRelations,
    deliveriesRelations,
    dueClearancesRelations,
    returnsRelations,
};
