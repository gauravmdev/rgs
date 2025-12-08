import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Eye, UserPlus, XCircle, RotateCcw, Trash2, Truck, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { formatCurrency, formatDate, getStatusColor, getSourceColor } from '../../lib/utils';
import { getSocket } from '../../lib/socket';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import type { Order, Customer, Store, User } from '../../types';

export default function OrdersList() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [deliveryBoys, setDeliveryBoys] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Filters
    const [filterStatus, setFilterStatus] = useState('');
    const [filterStore, setFilterStore] = useState('');
    const [filterSource, setFilterSource] = useState('');

    // Create form
    const [createFormData, setCreateFormData] = useState({
        customerId: '',
        storeId: '',
        source: 'WALK_IN' as 'ONLINE' | 'WALK_IN' | 'CALL_WHATSAPP',
        invoiceNumber: '',
        invoiceAmount: '',
        totalItems: '',
        items: [{ description: '', quantity: 1 }],
        notes: '',
    });

    // Assign form
    const [assignFormData, setAssignFormData] = useState({ deliveryPartnerId: '' });

    // Return form
    const [returnFormData, setReturnFormData] = useState({
        returnType: 'FULL' as 'FULL' | 'PARTIAL',
        refundAmount: '',
        refundMethod: 'CASH' as 'CASH' | 'CARD' | 'UPI' | 'CUSTOMER_CREDIT',
        reason: '',
    });

    // Deliver form
    const [deliverFormData, setDeliverFormData] = useState({
        paymentMethod: 'CASH' as 'CASH' | 'CARD' | 'UPI' | 'CUSTOMER_CREDIT',
    });

    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Customer search & creation state
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [newCustomerData, setNewCustomerData] = useState({
        name: '',
        phone: '',
        email: '',
        apartment: '',
        address: '',
        storeId: '',
    });

    useEffect(() => {
        fetchStores();
        fetchCustomers();
        fetchOrders();

        // Listen for real-time updates
        const socket = getSocket();
        if (socket) {
            socket.on('order-created', handleOrderUpdate);
            socket.on('order-updated', handleOrderUpdate);
            socket.on('order-assigned', handleOrderUpdate);
            socket.on('order-delivered', handleOrderUpdate);
            socket.on('order-cancelled', handleOrderUpdate);
            socket.on('order-returned', handleOrderUpdate);
        }

        return () => {
            if (socket) {
                socket.off('order-created');
                socket.off('order-updated');
                socket.off('order-assigned');
                socket.off('order-delivered');
                socket.off('order-cancelled');
                socket.off('order-returned');
            }
        };
    }, [filterStatus, filterStore, filterSource]);

    const handleOrderUpdate = () => {
        fetchOrders();
    };

    const fetchStores = async () => {
        try {
            const response = await api.get('/stores');
            setStores(response.data.stores);
        } catch (error) {
            console.error('Failed to fetch stores:', error);
        }
    };

    const fetchCustomers = async () => {
        try {
            const response = await api.get('/customers?limit=200');
            setCustomers(response.data.customers);
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        }
    };

    const fetchOrders = async () => {
        try {
            setLoading(true);
            let url = '/orders?limit=100';
            if (filterStatus) url += `&status=${filterStatus}`;
            if (filterStore) url += `&storeId=${filterStore}`;
            if (filterSource) url += `&source=${filterSource}`;

            const response = await api.get(url);
            setOrders(response.data.orders);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDeliveryBoys = async (storeId: number) => {
        try {
            const response = await api.get(`/staff/delivery-boys/${storeId}`);
            setDeliveryBoys(response.data.deliveryBoys);
        } catch (error) {
            console.error('Failed to fetch delivery boys:', error);
        }
    };

    const handleCreateOrder = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrors({});

        try {
            const payload = {
                customerId: parseInt(createFormData.customerId),
                storeId: parseInt(createFormData.storeId),
                source: createFormData.source,
                invoiceNumber: createFormData.invoiceNumber,
                invoiceAmount: parseFloat(createFormData.invoiceAmount),
                totalItems: parseInt(createFormData.totalItems),
                items: createFormData.items.filter(item => item.description),
                notes: createFormData.notes,
            };

            await api.post('/orders', payload);
            toast.success('Order created successfully!');
            setIsCreateModalOpen(false);
            resetCreateForm();
            fetchOrders();
        } catch (error: any) {
            console.error('Failed to create order:', error);
            if (error.response?.data?.details) {
                const validationErrors: Record<string, string> = {};
                error.response.data.details.forEach((detail: any) => {
                    validationErrors[detail.field] = detail.message;
                });
                setErrors(validationErrors);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateCustomer = async () => {
        if (!newCustomerData.name || !newCustomerData.phone || !newCustomerData.storeId) {
            toast.error('Please fill in all required customer fields');
            return;
        }

        setSubmitting(true);
        try {
            // Auto-generate email if not provided (optional hack for speed if allowed, but schema requires email)
            // User didn't specify optional email. Schema says email is required. 
            // I'll require email in the form.
            const payload = {
                ...newCustomerData,
                password: 'password123', // Default password for walk-in/created customers
                storeId: parseInt(newCustomerData.storeId),
            };

            const response = await api.post('/customers', payload);
            const newCustomer = response.data.customer;

            setCustomers([newCustomer, ...customers]);
            setCreateFormData({
                ...createFormData,
                customerId: newCustomer.id.toString(),
                storeId: newCustomer.storeId.toString(),
            });
            setCustomerSearch(newCustomer.name);
            setIsCreatingCustomer(false);
            toast.success('Customer created and selected!');
        } catch (error: any) {
            console.error('Failed to create customer:', error);
            toast.error(error.response?.data?.error || 'Failed to create customer');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAssignOrder = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedOrder) return;

        setSubmitting(true);
        try {
            await api.put(`/orders/${selectedOrder.id}/assign`, {
                deliveryPartnerId: parseInt(assignFormData.deliveryPartnerId),
            });
            toast.success('Order assigned successfully!');
            setIsAssignModalOpen(false);
            setSelectedOrder(null);
            setAssignFormData({ deliveryPartnerId: '' });
            fetchOrders();
        } catch (error) {
            console.error('Failed to assign order:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelOrder = async (orderId: number) => {
        if (!confirm('Are you sure you want to cancel this order?')) return;

        try {
            await api.put(`/orders/${orderId}/cancel`, {});
            toast.success('Order cancelled successfully!');
            fetchOrders();
        } catch (error) {
            console.error('Failed to cancel order:', error);
        }
    };

    const handleReturnOrder = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedOrder) return;

        setSubmitting(true);
        try {
            await api.post(`/orders/${selectedOrder.id}/return`, {
                returnType: returnFormData.returnType,
                refundAmount: parseFloat(returnFormData.refundAmount),
                refundMethod: returnFormData.refundMethod,
                reason: returnFormData.reason,
            });
            toast.success('Return processed successfully!');
            setIsReturnModalOpen(false);
            setSelectedOrder(null);
            resetReturnForm();
            fetchOrders();
        } catch (error) {
            console.error('Failed to process return:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteOrder = async (orderId: number) => {
        if (!confirm('Are you sure you want to delete this order? Only cancelled orders can be deleted.')) return;

        try {
            await api.delete(`/orders/${orderId}`);
            toast.success('Order deleted successfully!');
            fetchOrders();
        } catch (error) {
            console.error('Failed to delete order:', error);
        }
    };

    const handleOutForDelivery = async (orderId: number) => {
        if (!confirm('Mark this order as Out for Delivery?')) return;

        try {
            await api.put(`/orders/${orderId}/out-for-delivery`, {});
            toast.success('Order marked as Out for Delivery!');
            fetchOrders();
        } catch (error) {
            console.error('Failed to update order status:', error);
            toast.error('Failed to update status');
        }
    };

    const handleDeliverOrder = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedOrder) return;

        setSubmitting(true);
        try {
            await api.put(`/orders/${selectedOrder.id}/deliver`, {
                paymentMethod: deliverFormData.paymentMethod,
            });
            toast.success('Order marked as Delivered!');
            setIsDeliverModalOpen(false);
            setSelectedOrder(null);
            fetchOrders();
        } catch (error) {
            console.error('Failed to deliver order:', error);
            toast.error('Failed to mark as delivered');
        } finally {
            setSubmitting(false);
        }
    };

    const openAssignModal = (order: Order) => {
        setSelectedOrder(order);
        fetchDeliveryBoys(order.storeId);
        setIsAssignModalOpen(true);
    };

    const openReturnModal = (order: Order) => {
        setSelectedOrder(order);
        setReturnFormData({
            returnType: 'FULL',
            refundAmount: order.invoiceAmount.toString(),
            refundMethod: order.paymentMethod || 'CASH',
            reason: '',
        });
        setIsReturnModalOpen(true);
    };

    const openDeliverModal = (order: Order) => {
        setSelectedOrder(order);
        setDeliverFormData({
            paymentMethod: order.paymentMethod || 'CASH',
        });
        setIsDeliverModalOpen(true);
    };

    const resetCreateForm = () => {
        setCreateFormData({
            customerId: '',
            storeId: '',
            source: 'WALK_IN',
            invoiceNumber: '',
            invoiceAmount: '',
            totalItems: '',
            items: [{ description: '', quantity: 1 }],
            notes: '',
        });
        setCustomerSearch('');
        setIsCreatingCustomer(false);
        setNewCustomerData({
            name: '',
            phone: '',
            email: '',
            apartment: '',
            address: '',
            storeId: '',
        });
    };

    const resetReturnForm = () => {
        setReturnFormData({
            returnType: 'FULL',
            refundAmount: '',
            refundMethod: 'CASH',
            reason: '',
        });
    };

    const addItem = () => {
        setCreateFormData({
            ...createFormData,
            items: [...createFormData.items, { description: '', quantity: 1 }],
        });
    };

    const removeItem = (index: number) => {
        setCreateFormData({
            ...createFormData,
            items: createFormData.items.filter((_, i) => i !== index),
        });
    };

    const updateItem = (index: number, field: 'description' | 'quantity', value: string | number) => {
        const newItems = [...createFormData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setCreateFormData({ ...createFormData, items: newItems });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
                    <p className="text-gray-600 mt-1">Manage and track all orders</p>
                </div>
                <div className="flex space-x-3">
                    <Button variant="secondary" onClick={() => navigate('/orders/live')}>
                        <Truck size={20} className="mr-2" />
                        Live Orders
                    </Button>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus size={20} className="mr-2" />
                        Create Order
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="label">Status</label>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input">
                            <option value="">All Statuses</option>
                            <option value="CREATED">Created</option>
                            <option value="ASSIGNED">Assigned</option>
                            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="RETURNED">Returned</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">Store</label>
                        <select value={filterStore} onChange={(e) => setFilterStore(e.target.value)} className="input">
                            <option value="">All Stores</option>
                            {stores.map((store) => (
                                <option key={store.id} value={store.id}>{store.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Source</label>
                        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="input">
                            <option value="">All Sources</option>
                            <option value="ONLINE">Online</option>
                            <option value="WALK_IN">Walk-in</option>
                            <option value="CALL_WHATSAPP">Call/WhatsApp</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Orders Table */}
            <div className="card">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {orders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button
                                            onClick={() => navigate(`/orders/${order.id}`)}
                                            className="text-sm font-medium text-primary-600 hover:text-primary-800"
                                        >
                                            {order.orderNumber}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {order.customerName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {order.storeName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {formatCurrency(order.invoiceAmount)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(order.source)}`}>
                                            {order.source}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDate(order.createdAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                onClick={() => navigate(`/orders/${order.id}`)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="View Details"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {order.status === 'CREATED' && (
                                                <>
                                                    <button
                                                        onClick={() => openAssignModal(order)}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                        title="Assign Delivery Boy"
                                                    >
                                                        <UserPlus size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelOrder(order.id)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Cancel Order"
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                </>
                                            )}
                                            {order.status === 'ASSIGNED' && (
                                                <button
                                                    onClick={() => handleOutForDelivery(order.id)}
                                                    className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                                                    title="Mark Out for Delivery"
                                                >
                                                    <Truck size={16} />
                                                </button>
                                            )}
                                            {order.status === 'OUT_FOR_DELIVERY' && (
                                                <button
                                                    onClick={() => openDeliverModal(order)}
                                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                    title="Mark Delivered"
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                            )}
                                            {order.status === 'DELIVERED' && (
                                                <button
                                                    onClick={() => openReturnModal(order)}
                                                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                                    title="Process Return"
                                                >
                                                    <RotateCcw size={16} />
                                                </button>
                                            )}
                                            {order.status === 'CANCELLED' && (
                                                <button
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete Order"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
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

            {/* Create Order Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    resetCreateForm();
                    setErrors({});
                }}
                title={isCreatingCustomer ? "Create New Customer" : "Create New Order"}
                size="xl"
            >
                {isCreatingCustomer ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Name *"
                                value={newCustomerData.name}
                                onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                                placeholder="Customer Name"
                            />
                            <Input
                                label="Phone *"
                                value={newCustomerData.phone}
                                onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                                placeholder="Phone Number"
                            />
                            <Input
                                label="Email *"
                                type="email"
                                value={newCustomerData.email}
                                onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                                placeholder="Email Address"
                            />
                            <div>
                                <label className="label">Store *</label>
                                <select
                                    value={newCustomerData.storeId}
                                    onChange={(e) => setNewCustomerData({ ...newCustomerData, storeId: e.target.value })}
                                    className="input"
                                >
                                    <option value="">Select Store</option>
                                    {stores.map((store) => (
                                        <option key={store.id} value={store.id}>{store.name}</option>
                                    ))}
                                </select>
                            </div>
                            <Input
                                label="Apartment/Unit"
                                value={newCustomerData.apartment}
                                onChange={(e) => setNewCustomerData({ ...newCustomerData, apartment: e.target.value })}
                                placeholder="Apt 101"
                            />
                            <Input
                                label="Address"
                                value={newCustomerData.address}
                                onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                                placeholder="Using Store Address if empty"
                            />
                        </div>
                        <div className="flex justify-end space-x-3 pt-4">
                            <Button variant="secondary" onClick={() => setIsCreatingCustomer(false)}>
                                Back to Order
                            </Button>
                            <Button onClick={handleCreateCustomer} loading={submitting}>
                                Create & Select Customer
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleCreateOrder} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="label">Customer *</label>
                                {!createFormData.customerId ? (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                            placeholder="Search by Name, Phone, or Apartment..."
                                            className="input"
                                        />
                                        {customerSearch && (
                                            <div className="max-h-48 overflow-y-auto border rounded-lg bg-white shadow-sm">
                                                {customers
                                                    .filter(c =>
                                                        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                                        c.phone.includes(customerSearch) ||
                                                        (c.apartment && c.apartment.toLowerCase().includes(customerSearch.toLowerCase()))
                                                    )
                                                    .map(customer => (
                                                        <div
                                                            key={customer.id}
                                                            className="p-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center border-b last:border-b-0"
                                                            onClick={() => {
                                                                setCreateFormData({
                                                                    ...createFormData,
                                                                    customerId: customer.id.toString(),
                                                                    storeId: customer.storeId.toString(),
                                                                });
                                                                setCustomerSearch(customer.name);
                                                            }}
                                                        >
                                                            <div>
                                                                <p className="font-medium text-gray-900">{customer.name}</p>
                                                                <p className="text-sm text-gray-500">{customer.phone} {customer.apartment ? `• ${customer.apartment}` : ''}</p>
                                                            </div>
                                                            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">{customer.storeName}</span>
                                                        </div>
                                                    ))}
                                                {customers.filter(c =>
                                                    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                                    c.phone.includes(customerSearch)
                                                ).length === 0 && (
                                                        <div className="p-3 text-center">
                                                            <p className="text-sm text-gray-500 mb-2">No customer found</p>
                                                            <Button size="sm" onClick={() => setIsCreatingCustomer(true)}>
                                                                <UserPlus size={16} className="mr-1" />
                                                                Create New Customer
                                                            </Button>
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                        {!customerSearch && (
                                            <div className="mt-2 text-right">
                                                <Button size="sm" variant="secondary" onClick={() => setIsCreatingCustomer(true)}>
                                                    <UserPlus size={16} className="mr-1" />
                                                    Or Create New Customer
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                {customers.find(c => c.id.toString() === createFormData.customerId)?.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-blue-900">
                                                    {customers.find(c => c.id.toString() === createFormData.customerId)?.name}
                                                </p>
                                                <p className="text-sm text-blue-700">
                                                    {customers.find(c => c.id.toString() === createFormData.customerId)?.phone}
                                                </p>
                                                {(customers.find(c => c.id.toString() === createFormData.customerId)?.apartment ||
                                                    customers.find(c => c.id.toString() === createFormData.customerId)?.address) && (
                                                        <p className="text-sm text-blue-700 mt-1">
                                                            {[
                                                                customers.find(c => c.id.toString() === createFormData.customerId)?.apartment,
                                                                customers.find(c => c.id.toString() === createFormData.customerId)?.address
                                                            ].filter(Boolean).join(', ')}
                                                        </p>
                                                    )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCreateFormData({ ...createFormData, customerId: '', storeId: '' });
                                                setCustomerSearch('');
                                            }}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            Change
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Store field hidden if customer selected (auto-filled), otherwise shown but disabled? 
                                User said: "when we select the customer store information doesnt have to be selected as it should already be there"
                                So I will hide it or show it as read-only info.
                            */}
                            {createFormData.customerId && (
                                <div>
                                    <label className="label">Store</label>
                                    <input
                                        type="text"
                                        value={stores.find(s => s.id.toString() === createFormData.storeId)?.name || ''}
                                        disabled
                                        className="input bg-gray-50"
                                    />
                                </div>
                            )}

                            {/* If no customer selected, user can't select store manually because store depends on customer in the new flow?
                                 Actually, user might want to pick store first? The prompt implies customer drives store.
                                 "if customer is not there... it can be created... when we select the customer store information doesnt have to be selected"
                                 So I'll just hide the store select if customer is selected. If not, maybe show it? 
                                 But I already removed the manual store select in favor of auto-fill.
                                 Wait, if I create a new customer, I pick the store THEN.
                                 So mainly, store is derived.
                            */}

                            <div>
                                <label className="label">Order Source *</label>
                                <select
                                    value={createFormData.source}
                                    onChange={(e) => setCreateFormData({ ...createFormData, source: e.target.value as any })}
                                    className="input"
                                    required
                                >
                                    <option value="ONLINE">Online</option>
                                    <option value="WALK_IN">Walk-in</option>
                                    <option value="CALL_WHATSAPP">Call/WhatsApp</option>
                                </select>
                            </div>

                            {/* ... Rest of the form inputs same as before ... */}
                            <Input
                                label="Invoice Number"
                                value={createFormData.invoiceNumber}
                                onChange={(e) => setCreateFormData({ ...createFormData, invoiceNumber: e.target.value })}
                                placeholder="INV-001"
                            />

                            <Input
                                label="Invoice Amount *"
                                type="number"
                                step="0.01"
                                value={createFormData.invoiceAmount}
                                onChange={(e) => setCreateFormData({ ...createFormData, invoiceAmount: e.target.value })}
                                placeholder="0.00"
                                error={errors.invoiceAmount}
                                required
                            />

                            <Input
                                label="Total Items *"
                                type="number"
                                value={createFormData.totalItems}
                                onChange={(e) => setCreateFormData({ ...createFormData, totalItems: e.target.value })}
                                placeholder="5"
                                error={errors.totalItems}
                                required
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="label">Order Items *</label>
                                <Button type="button" size="sm" onClick={addItem}>
                                    <Plus size={16} className="mr-1" />
                                    Add Item
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {createFormData.items.map((item, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Item description"
                                            value={item.description}
                                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                                            className="input flex-1"
                                            required
                                        />
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                            className="input w-24"
                                            min="1"
                                            required
                                        />
                                        {createFormData.items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="label">Notes</label>
                            <textarea
                                value={createFormData.notes}
                                onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                                className="input"
                                rows={3}
                                placeholder="Any special instructions..."
                            />
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                    setIsCreateModalOpen(false);
                                    resetCreateForm();
                                    setErrors({});
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" loading={submitting}>
                                Create Order
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Assign Delivery Partner Modal */}
            <Modal
                isOpen={isAssignModalOpen}
                onClose={() => {
                    setIsAssignModalOpen(false);
                    setSelectedOrder(null);
                    setAssignFormData({ deliveryPartnerId: '' });
                }}
                title="Assign Delivery Partner"
            >
                <form onSubmit={handleAssignOrder} className="space-y-4">
                    {selectedOrder && (
                        <div className="p-4 bg-blue-50 rounded-lg mb-4">
                            <p className="text-sm text-blue-800">
                                Order: <strong>{selectedOrder.orderNumber}</strong>
                            </p>
                            <p className="text-sm text-blue-800">
                                Customer: <strong>{selectedOrder.customerName}</strong>
                            </p>
                            <p className="text-sm text-blue-800">
                                Amount: <strong>{formatCurrency(selectedOrder.invoiceAmount)}</strong>
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="label">Select Delivery Partner *</label>
                        <select
                            value={assignFormData.deliveryPartnerId}
                            onChange={(e) => setAssignFormData({ deliveryPartnerId: e.target.value })}
                            className="input"
                            required
                        >
                            <option value="">Choose a delivery boy</option>
                            {deliveryBoys.map((boy) => (
                                <option key={boy.id} value={boy.id}>
                                    {boy.name} - {boy.phone}
                                </option>
                            ))}
                        </select>
                    </div>

                    {deliveryBoys.length === 0 && (
                        <div className="p-4 bg-yellow-50 rounded-lg">
                            <p className="text-sm text-yellow-800">
                                No delivery boys available for this store. Please add delivery boys first.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setIsAssignModalOpen(false);
                                setSelectedOrder(null);
                                setAssignFormData({ deliveryPartnerId: '' });
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" loading={submitting} disabled={deliveryBoys.length === 0}>
                            Assign Order
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Process Return Modal */}
            <Modal
                isOpen={isReturnModalOpen}
                onClose={() => {
                    setIsReturnModalOpen(false);
                    setSelectedOrder(null);
                    resetReturnForm();
                }}
                title="Process Return/Refund"
                size="lg"
            >
                <form onSubmit={handleReturnOrder} className="space-y-4">
                    {selectedOrder && (
                        <div className="p-4 bg-red-50 rounded-lg mb-4">
                            <p className="text-sm text-red-800">
                                Order: <strong>{selectedOrder.orderNumber}</strong>
                            </p>
                            <p className="text-sm text-red-800">
                                Original Amount: <strong>{formatCurrency(selectedOrder.invoiceAmount)}</strong>
                            </p>
                            <p className="text-sm text-red-800">
                                Payment Method: <strong>{selectedOrder.paymentMethod}</strong>
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="label">Return Type *</label>
                        <select
                            value={returnFormData.returnType}
                            onChange={(e) => {
                                const type = e.target.value as 'FULL' | 'PARTIAL';
                                setReturnFormData({
                                    ...returnFormData,
                                    returnType: type,
                                    refundAmount: type === 'FULL' ? selectedOrder?.invoiceAmount.toString() || '' : '',
                                });
                            }}
                            className="input"
                            required
                        >
                            <option value="FULL">Full Return</option>
                            <option value="PARTIAL">Partial Return</option>
                        </select>
                    </div>

                    <Input
                        label="Refund Amount *"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={selectedOrder?.invoiceAmount}
                        value={returnFormData.refundAmount}
                        onChange={(e) => setReturnFormData({ ...returnFormData, refundAmount: e.target.value })}
                        placeholder="0.00"
                        required
                    />

                    <div>
                        <label className="label">Refund Method *</label>
                        <select
                            value={returnFormData.refundMethod}
                            onChange={(e) => setReturnFormData({ ...returnFormData, refundMethod: e.target.value as any })}
                            className="input"
                            required
                        >
                            <option value="CASH">Cash</option>
                            <option value="CARD">Card</option>
                            <option value="UPI">UPI</option>
                            <option value="CUSTOMER_CREDIT">Customer Credit (Adjust Dues)</option>
                        </select>
                    </div>

                    <div>
                        <label className="label">Reason for Return</label>
                        <textarea
                            value={returnFormData.reason}
                            onChange={(e) => setReturnFormData({ ...returnFormData, reason: e.target.value })}
                            className="input"
                            rows={3}
                            placeholder="Explain the reason for return..."
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setIsReturnModalOpen(false);
                                setSelectedOrder(null);
                                resetReturnForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" variant="danger" loading={submitting}>
                            Process Return
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Deliver Order Modal */}
            <Modal
                isOpen={isDeliverModalOpen}
                onClose={() => {
                    setIsDeliverModalOpen(false);
                    setSelectedOrder(null);
                }}
                title="Mark Order as Delivered"
            >
                <form onSubmit={handleDeliverOrder} className="space-y-4">
                    {selectedOrder && (
                        <div className="p-4 bg-green-50 rounded-lg mb-4">
                            <p className="text-sm text-green-800">
                                Order: <strong>{selectedOrder.orderNumber}</strong>
                            </p>
                            <p className="text-sm text-green-800">
                                Amount to Collect: <strong>{formatCurrency(selectedOrder.invoiceAmount)}</strong>
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="label">Payment Method *</label>
                        <select
                            value={deliverFormData.paymentMethod}
                            onChange={(e) => setDeliverFormData({ paymentMethod: e.target.value as any })}
                            className="input"
                            required
                        >
                            <option value="CASH">Cash</option>
                            <option value="CARD">Card</option>
                            <option value="UPI">UPI</option>
                            <option value="CUSTOMER_CREDIT">Customer Credit</option>
                        </select>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setIsDeliverModalOpen(false);
                                setSelectedOrder(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" loading={submitting}>
                            Confirm Delivery
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
