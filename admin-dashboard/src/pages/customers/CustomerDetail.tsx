import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Package, TrendingUp, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { formatCurrency, formatDate, getStatusColor } from '../../lib/utils';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import type { Customer, Order } from '../../types';

interface DueClearance {
    id: number;
    amount: number;
    paymentMethod: string;
    clearedDate: string;
    notes?: string;
    createdAt: string;
}

export default function CustomerDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [dueClearances, setDueClearances] = useState<DueClearance[]>([]);
    const [loading, setLoading] = useState(true);
    const [isClearDuesModalOpen, setIsClearDuesModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        amount: '',
        paymentMethod: 'CASH' as 'CASH' | 'CARD' | 'UPI',
        clearedDate: new Date().toISOString().split('T')[0],
        notes: '',
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchCustomerDetails();

        // Listen for real-time updates
        const socket = getSocket();
        const handleOrderUpdate = (data: any) => {
            // Only refresh if the update is related to this customer
            // Note: In a real app, we might check data.customerId === customer?.id
            // But since we might receive partial data, refreshing for any order event 
            // is a safer (though slightly less efficient) bet for now, or we rely on the backend filtering.
            // Be mindful: The 'admin' room receives ALL events.
            // Let's optimize: Check if the updated order belongs to this customer if possible.
            // However, 'data' might vary. For simplicity and robustness given current constraints:
            if (data && (data.customerId === parseInt(id || '0') || data.order?.customerId === parseInt(id || '0'))) {
                console.log('🔄 CustomerDetail: Order update received for this customer', data);
                fetchCustomerDetails();
            }
        };

        if (socket) {
            socket.on('order-created', handleOrderUpdate);
            socket.on('order-updated', handleOrderUpdate);
            socket.on('order-assigned', handleOrderUpdate);
            socket.on('order-out-for-delivery', handleOrderUpdate);
            socket.on('order-delivered', handleOrderUpdate);
            socket.on('order-cancelled', handleOrderUpdate);
            socket.on('order-returned', handleOrderUpdate);
        }

        return () => {
            if (socket) {
                socket.off('order-created', handleOrderUpdate);
                socket.off('order-updated', handleOrderUpdate);
                socket.off('order-assigned', handleOrderUpdate);
                socket.off('order-out-for-delivery', handleOrderUpdate);
                socket.off('order-delivered', handleOrderUpdate);
                socket.off('order-cancelled', handleOrderUpdate);
                socket.off('order-returned', handleOrderUpdate);
            }
        };
    }, [id]);

    const fetchCustomerDetails = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/customers/${id}`);
            setCustomer(response.data.customer);
            setOrders(response.data.orders || []);
            setDueClearances(response.data.dueClearances || []);
        } catch (error) {
            console.error('Failed to fetch customer details:', error);
            toast.error('Failed to load customer details');
            navigate('/customers');
        } finally {
            setLoading(false);
        }
    };

    const handleClearDues = async (e: FormEvent) => {
        e.preventDefault();
        if (!customer) return;

        setSubmitting(true);
        try {
            const payload = {
                amount: parseFloat(formData.amount),
                paymentMethod: formData.paymentMethod,
                clearedDate: new Date(formData.clearedDate).toISOString(),
                notes: formData.notes,
            };

            await api.post(`/customers/${customer.id}/clear-dues`, payload);
            toast.success('Dues cleared successfully!');
            setIsClearDuesModalOpen(false);
            setFormData({
                amount: '',
                paymentMethod: 'CASH',
                clearedDate: new Date().toISOString().split('T')[0],
                notes: '',
            });
            fetchCustomerDetails();
        } catch (error) {
            console.error('Failed to clear dues:', error);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">Customer not found</p>
            </div>
        );
    }

    const currentDues = parseFloat(customer.totalDues.toString());
    const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED').length;
    const returnedOrders = orders.filter((o) => o.status === 'RETURNED' || o.status === 'PARTIAL_RETURNED').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/customers')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
                        <p className="text-gray-600 mt-1">{customer.email}</p>
                    </div>
                </div>
                {currentDues > 0 && (
                    <Button onClick={() => setIsClearDuesModalOpen(true)} variant="success">
                        <DollarSign size={20} className="mr-2" />
                        Clear Dues
                    </Button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Orders</p>
                            <p className="text-2xl font-bold text-gray-900">{customer.totalOrders}</p>
                        </div>
                        <Package className="text-blue-600" size={32} />
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Sales</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {formatCurrency(parseFloat(customer.totalSales.toString()))}
                            </p>
                        </div>
                        <TrendingUp className="text-green-600" size={32} />
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Delivered</p>
                            <p className="text-2xl font-bold text-green-900">{deliveredOrders}</p>
                            <p className="text-xs text-gray-500 mt-1">Returns: {returnedOrders}</p>
                        </div>
                        <Package className="text-green-600" size={32} />
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-red-600">Current Dues</p>
                            <p className="text-2xl font-bold text-red-900">
                                {formatCurrency(currentDues)}
                            </p>
                        </div>
                        <CreditCard className="text-red-600" size={32} />
                    </div>
                </div>
            </div>

            {/* Customer Info */}
            <div className="card">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Customer Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <p className="text-gray-900 font-medium">{customer.phone}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Store</p>
                        <p className="text-gray-900 font-medium">{customer.storeName}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Customer Since</p>
                        <p className="text-gray-900 font-medium">{formatDate(customer.createdAt)}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div>
                        <p className="text-sm text-gray-600">Address/Apartment</p>
                        <p className="text-gray-900 font-medium">
                            {[customer.apartment, customer.address].filter(Boolean).join(', ') || 'No address provided'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Payment History */}
            {dueClearances.length > 0 && (
                <div className="card">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Payment History</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {dueClearances.map((clearance) => (
                                    <tr key={clearance.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {formatDate(clearance.clearedDate)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                            {formatCurrency(clearance.amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                                {clearance.paymentMethod}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {clearance.notes || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Order History */}
            <div className="card">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Order History</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {orders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">
                                        {order.orderNumber}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {formatDate(order.createdAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {formatCurrency(order.invoiceAmount)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {order.paymentMethod ? (
                                            <span className={`px-2 py-1 rounded-full text-xs ${order.paymentMethod === 'CUSTOMER_CREDIT'
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-green-100 text-green-800'
                                                }`}>
                                                {order.paymentMethod}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">Pending</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {orders.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-600">No orders found</p>
                    </div>
                )}
            </div>

            {/* Clear Dues Modal */}
            <Modal
                isOpen={isClearDuesModalOpen}
                onClose={() => setIsClearDuesModalOpen(false)}
                title="Clear Customer Dues"
            >
                <form onSubmit={handleClearDues} className="space-y-4">
                    <div className="p-4 bg-red-50 rounded-lg mb-4">
                        <p className="text-sm text-red-800">
                            Current Outstanding Dues: <strong>{formatCurrency(currentDues)}</strong>
                        </p>
                    </div>

                    <Input
                        label="Payment Amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={currentDues}
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                    />

                    <div>
                        <label className="label">Payment Method</label>
                        <select
                            value={formData.paymentMethod}
                            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                            className="input"
                            required
                        >
                            <option value="CASH">Cash</option>
                            <option value="CARD">Card</option>
                            <option value="UPI">UPI</option>
                        </select>
                    </div>

                    <Input
                        label="Payment Date"
                        type="date"
                        value={formData.clearedDate}
                        onChange={(e) => setFormData({ ...formData, clearedDate: e.target.value })}
                        required
                    />

                    <div>
                        <label className="label">Notes (Optional)</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="input"
                            rows={3}
                            placeholder="Add any notes about this payment..."
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsClearDuesModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="success" loading={submitting}>
                            Record Payment
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
