export interface User {
    id: number;
    name: string;
    email: string;
    role: 'ADMIN' | 'STORE_MANAGER' | 'DELIVERY_BOY' | 'CUSTOMER';
    storeId?: number;
    storeName?: string;
    store?: {
        id: number;
        name: string;
    };
    phone: string;
    isActive: boolean;
}

export interface Store {
    id: number;
    name: string;
    address: string;
    phone: string;
    isActive: boolean;
    managersCount?: number;
    deliveryBoysCount?: number;
    totalOrders?: number;
    totalSales?: number;
}

export interface Customer {
    id: number;
    userId: number;
    name: string;
    email: string;
    phone: string;
    storeId: number;
    storeName?: string;
    totalDues: number;
    totalOrders: number;
    totalSales: number;
    apartment?: string;
    address?: string;
    createdAt: string;
}

export interface Order {
    id: number;
    orderNumber: string;
    customerId: number;
    customerName: string;
    storeId: number;
    storeName: string;
    // source removed
    status: 'CREATED' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'PARTIAL_RETURNED';
    invoiceNumber?: string;
    invoiceAmount: number;
    totalItems: number;
    paymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'CUSTOMER_CREDIT';
    paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED';
    deliveryPartnerId?: number;
    deliveryPartnerName?: string;
    assignedAt?: string;
    outForDeliveryAt?: string;
    deliveredAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    items?: OrderItem[];
    returns?: Return[];
    customer?: Customer;
}

export interface OrderItem {
    id: number;
    orderId: number;
    description: string;
    quantity: number;
    createdAt?: string;
}

export interface DashboardStats {
    todaySales: number;
    todayOrders: number;
    activeOrders: {
        created: number;
        assigned: number;
        out_for_delivery: number;
    };
    totalDues: number;
}

export interface Return {
    id: number;
    orderId: number;
    returnType: 'FULL' | 'PARTIAL';
    refundAmount: number;
    refundMethod: 'CASH' | 'CARD' | 'UPI' | 'CUSTOMER_CREDIT';
    reason?: string;
    processedAt: string;
}
