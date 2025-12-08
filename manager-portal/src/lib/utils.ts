import { format } from 'date-fns';

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

export const formatDate = (date: string | Date): string => {
    return format(new Date(date), 'MMM dd, yyyy');
};

export const formatDateTime = (date: string | Date): string => {
    return format(new Date(date), 'MMM dd, yyyy HH:mm');
};

export const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
        CREATED: 'bg-gray-100 text-gray-800',
        ASSIGNED: 'bg-blue-100 text-blue-800',
        OUT_FOR_DELIVERY: 'bg-yellow-100 text-yellow-800',
        DELIVERED: 'bg-green-100 text-green-800',
        CANCELLED: 'bg-red-100 text-red-800',
        RETURNED: 'bg-purple-100 text-purple-800',
        PARTIAL_RETURNED: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getSourceColor = (source: string): string => {
    const colors: Record<string, string> = {
        ONLINE: 'bg-blue-100 text-blue-800',
        WALK_IN: 'bg-green-100 text-green-800',
        CALL_WHATSAPP: 'bg-purple-100 text-purple-800',
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
};
