import { z } from 'zod';

// ============= AUTH SCHEMAS =============
export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    role: z.enum(['ADMIN', 'STORE_MANAGER', 'DELIVERY_BOY', 'CUSTOMER']),
    phone: z.string().min(10, 'Phone must be at least 10 characters'),
    storeId: z.number().optional(),
});

// ============= STORE SCHEMAS =============
export const createStoreSchema = z.object({
    name: z.string().min(2, 'Store name must be at least 2 characters'),
    address: z.string().min(5, 'Address must be at least 5 characters'),
    phone: z.string().min(10, 'Phone must be at least 10 characters'),
});

export const updateStoreSchema = z.object({
    name: z.string().min(2).optional(),
    address: z.string().min(5).optional(),
    phone: z.string().min(10).optional(),
    isActive: z.boolean().optional(),
});

// ============= ORDER SCHEMAS =============
export const createOrderSchema = z.object({
    customerId: z.number().int().positive('Customer ID is required'),
    storeId: z.number().int().positive('Store ID is required'),
    source: z.enum(['ONLINE', 'WALK_IN', 'CALL_WHATSAPP'], {
        errorMap: () => ({ message: 'Invalid order source' }),
    }),
    invoiceNumber: z.string().optional(),
    invoiceAmount: z.number().positive('Invoice amount must be positive'),
    totalItems: z.number().int().positive('Total items must be positive'),
    items: z.array(
        z.object({
            description: z.string().min(1, 'Item description is required'),
            quantity: z.number().int().positive('Quantity must be positive'),
        })
    ).min(1, 'At least one item is required'),
    notes: z.string().optional(),
});

export const updateOrderSchema = z.object({
    invoiceNumber: z.string().optional(),
    invoiceAmount: z.number().positive().optional(),
    totalItems: z.number().int().positive().optional(),
    items: z.array(
        z.object({
            description: z.string().min(1),
            quantity: z.number().int().positive(),
        })
    ).optional(),
    notes: z.string().optional(),
});

export const assignOrderSchema = z.object({
    deliveryPartnerId: z.number().int().positive('Delivery partner ID is required'),
});

export const deliverOrderSchema = z.object({
    paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'CUSTOMER_CREDIT'], {
        errorMap: () => ({ message: 'Invalid payment method' }),
    }),
});

export const cancelOrderSchema = z.object({
    reason: z.string().optional(),
});

// ============= CUSTOMER SCHEMAS =============
export const createCustomerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email format'),
    phone: z.string().min(10, 'Phone must be at least 10 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    storeId: z.number().int().positive('Store ID is required'),
    apartment: z.string().optional(),
    address: z.string().optional(),
});

export const updateCustomerSchema = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().min(10).optional(),
    apartment: z.string().optional(),
    address: z.string().optional(),
});

export const clearDuesSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    paymentMethod: z.enum(['CASH', 'CARD', 'UPI'], {
        errorMap: () => ({ message: 'Invalid payment method' }),
    }),
    clearedDate: z.string().datetime('Invalid date format'),
    notes: z.string().optional(),
});

// ============= RETURN SCHEMAS =============
export const createReturnSchema = z.object({
    returnType: z.enum(['FULL', 'PARTIAL'], {
        errorMap: () => ({ message: 'Invalid return type' }),
    }),
    refundAmount: z.number().positive('Refund amount must be positive'),
    refundMethod: z.enum(['CASH', 'CARD', 'UPI', 'CUSTOMER_CREDIT'], {
        errorMap: () => ({ message: 'Invalid refund method' }),
    }),
    reason: z.string().optional(),
});

// ============= STAFF SCHEMAS =============
export const updateStaffSchema = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().min(10).optional(),
    role: z.enum(['ADMIN', 'STORE_MANAGER', 'DELIVERY_BOY']).optional(),
    storeId: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});
