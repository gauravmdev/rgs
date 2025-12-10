import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Eye, UserPlus, Search, XCircle, RotateCcw, Truck, CheckCircle, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { getSocket, connectSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, formatDateTime, getStatusColor } from '../lib/utils';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Orders() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<any[]>([]);
    const [deliveryBoys, setDeliveryBoys] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        startDate: '',
        endDate: '',
    });

    // Assign modal
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Edit modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({
        invoiceNumber: '',
        invoiceAmount: '',
        notes: '',
        items: [] as any[],
    });

    // Deliver modal
    const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false);
    const [deliverFormData, setDeliverFormData] = useState({
        paymentMethod: 'CASH',
    });

    // Return modal
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [returnFormData, setReturnFormData] = useState({
        returnType: 'FULL' as 'FULL' | 'PARTIAL',
        refundAmount: '',
        refundMethod: '' as '' | 'CASH' | 'CARD' | 'UPI' | 'CUSTOMER_CREDIT',
        reason: '',
    });

    useEffect(() => {
        fetchOrders();
        fetchDeliveryBoys();

        // Get or create socket connection
        let socket = getSocket();
        if (!socket) {
            console.log('Creating socket connection for Orders page...');
            socket = connectSocket(user?.storeId, user?.role === 'ADMIN');
        }

        if (socket) {
            const handleRealtimeUpdate = () => {
                console.log('📦 Real-time order update received');
                fetchOrders();
            };

            socket.on('order-created', handleRealtimeUpdate);
            socket.on('order-updated', handleRealtimeUpdate);
            socket.on('order-assigned', handleRealtimeUpdate);
            socket.on('order-delivered', handleRealtimeUpdate);

            return () => {
                if (socket) {
                    socket.off('order-created', handleRealtimeUpdate);
                    socket.off('order-updated', handleRealtimeUpdate);
                    socket.off('order-assigned', handleRealtimeUpdate);
                    socket.off('order-delivered', handleRealtimeUpdate);
                }
            };
        }
    }, [filters]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                storeId: user?.storeId?.toString() || '',
                ...(filters.search && { search: filters.search }),
                ...(filters.status && { status: filters.status }),
                ...(filters.startDate && { startDate: filters.startDate }),
                ...(filters.endDate && { endDate: filters.endDate }),
                limit: '100',
            });

            const response = await api.get(`/orders?${params}`);
            setOrders(response.data.orders);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    const fetchDeliveryBoys = async () => {
        try {
            const response = await api.get(`/staff?role=DELIVERY_BOY&storeId=${user?.storeId}&isActive=true`);
            setDeliveryBoys(response.data.staff);
        } catch (error) {
            console.error('Failed to fetch delivery boys:', error);
        }
    };

    const handleEditOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder) return;

        setSubmitting(true);
        try {
            await api.put(`/orders/${selectedOrder.id}`, {
                ...editFormData,
                invoiceAmount: parseFloat(editFormData.invoiceAmount),
                totalItems: editFormData.items.reduce((sum, item) => sum + item.quantity, 0),
            });
            toast.success('Order updated successfully!');
            setIsEditModalOpen(false);
            setSelectedOrder(null);
            fetchOrders();
        } catch (error) {
            console.error('Failed to update order:', error);
            toast.error('Failed to update order');
        } finally {
            setSubmitting(false);
        }
    };

    const openEditModal = (order: any) => {
        setSelectedOrder(order);
        setEditFormData({
            invoiceNumber: order.invoiceNumber || '',
            invoiceAmount: order.invoiceAmount.toString(),
            notes: order.notes || '',
            items: order.items ? JSON.parse(JSON.stringify(order.items)).map((item: any) => ({
                description: item.description,
                quantity: item.quantity
            })) : [],
        });
        setIsEditModalOpen(true);
    };

    const addEditItem = () => {
        setEditFormData({
            ...editFormData,
            items: [...editFormData.items, { description: '', quantity: 1 }],
        });
    };

    const removeEditItem = (index: number) => {
        if (editFormData.items.length > 1) {
            const newItems = editFormData.items.filter((_, i) => i !== index);
            setEditFormData({ ...editFormData, items: newItems });
        }
    };

    const updateEditItem = (index: number, field: 'description' | 'quantity', value: any) => {
        const newItems = [...editFormData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setEditFormData({ ...editFormData, items: newItems });
    };

    const handleAssignOrder = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDeliveryBoy) {
            toast.error('Please select a delivery boy');
            return;
        }

        setSubmitting(true);
        try {
            // Correct endpoint: DOST /orders/:id/assign -> PUT
            await api.put(`/orders/${selectedOrder.id}/assign`, {
                deliveryPartnerId: parseInt(selectedDeliveryBoy),
            });

            toast.success('Order assigned successfully!');
            setIsAssignModalOpen(false);
            setSelectedOrder(null);
            setSelectedDeliveryBoy('');
            fetchOrders();
        } catch (error: any) {
            console.error('Failed to assign order:', error);
            console.error('Response:', error.response?.data);
            toast.error(error.response?.data?.error || 'Failed to assign order');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOutForDelivery = async (order: any) => {
        if (!confirm(`Mark order ${order.orderNumber} as out for delivery?`)) return;

        try {
            await api.put(`/orders/${order.id}/out-for-delivery`);
            toast.success('Order marked as out for delivery!');
            fetchOrders();
        } catch (error: any) {
            console.error('Failed to mark out for delivery:', error);
            toast.error(error.response?.data?.error || 'Failed to update order');
        }
    };

    const openDeliverModal = (order: any) => {
        setSelectedOrder(order);
        setDeliverFormData({ paymentMethod: 'CASH' });
        setIsDeliverModalOpen(true);
    };

    const handleDeliverOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.put(`/orders/${selectedOrder.id}/deliver`, {
                paymentMethod: deliverFormData.paymentMethod,
            });

            toast.success('Order marked as delivered!');
            setIsDeliverModalOpen(false);
            setSelectedOrder(null);
            fetchOrders();
        } catch (error: any) {
            console.error('Failed to deliver order:', error);
            toast.error(error.response?.data?.error || 'Failed to deliver order');
        } finally {
            setSubmitting(false);
        }
    };

    const openAssignModal = (order: any) => {
        setSelectedOrder(order);
        setSelectedDeliveryBoy('');
        setIsAssignModalOpen(true);
    };

    const handleCancelOrder = async (order: any) => {
        if (!confirm(`Cancel order ${order.orderNumber}? This action cannot be undone.`)) {
            return;
        }

        try {
            // Correct method: POST not PUT
            await api.post(`/orders/${order.id}/cancel`);
            toast.success('Order cancelled successfully!');
            fetchOrders();
        } catch (error: any) {
            console.error('Failed to cancel order:', error);
            console.error('Response:', error.response?.data);
            toast.error(error.response?.data?.error || 'Failed to cancel order');
        }
    };

    const openReturnModal = (order: any) => {
        setSelectedOrder(order);
        setReturnFormData({
            returnType: 'FULL',
            refundAmount: order.invoiceAmount.toString(),
            refundMethod: order.paymentMethod || '',
            reason: '',
        });
        setIsReturnModalOpen(true);
    };

    const handleReturnOrder = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!returnFormData.refundAmount || parseFloat(returnFormData.refundAmount) <= 0) {
            toast.error('Please enter a valid refund amount');
            return;
        }

        if (!returnFormData.refundMethod) {
            toast.error('Please select a refund method');
            return;
        }

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
            fetchOrders();
        } catch (error: any) {
            console.error('Failed to process return:', error);
            toast.error(error.response?.data?.error || 'Failed to process return');
        } finally {
            setSubmitting(false);
        }
    };

    const resetReturnForm = () => {
        setReturnFormData({
            returnType: 'FULL',
            refundAmount: '',
            refundMethod: '',
            reason: '',
        });
    };

    const filteredOrders = orders.filter((order) => {
        const matchesSearch = !filters.search ||
            order.orderNumber.toLowerCase().includes(filters.search.toLowerCase()) ||
            order.customerName.toLowerCase().includes(filters.search.toLowerCase());

        const matchesStatus = !filters.status || order.status === filters.status;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
                    <p className="text-gray-600 mt-1">Manage and track all orders</p>
                </div>
                <Button onClick={() => navigate('/process-order')}>
                    <Package size={20} className="mr-2" />
                    Create Order
                </Button>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search orders..."
                            value={filters.search}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, search: e.target.value })}
                            className="input pl-10"
                        />
                    </div>

                    <select
                        value={filters.status}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, status: e.target.value })}
                        className="input"
                    >
                        <option value="">All Status</option>
                        <option value="CREATED">Created</option>
                        <option value="ASSIGNED">Assigned</option>
                        <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>

                    <Input
                        type="date"
                        placeholder="Start Date"
                        value={filters.startDate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, startDate: e.target.value })}
                    />

                    <Input
                        type="date"
                        placeholder="End Date"
                        value={filters.endDate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, endDate: e.target.value })}
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="card text-center">
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-gray-900">{filteredOrders.length}</p>
                </div>
                <div className="card text-center">
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="text-2xl font-bold text-gray-900">
                        {filteredOrders.filter(o => o.status === 'CREATED').length}
                    </p>
                </div>
                <div className="card text-center">
                    <p className="text-sm text-blue-600">Assigned</p>
                    <p className="text-2xl font-bold text-blue-900">
                        {filteredOrders.filter(o => o.status === 'ASSIGNED').length}
                    </p>
                </div>
                <div className="card text-center">
                    <p className="text-sm text-yellow-600">Out for Delivery</p>
                    <p className="text-2xl font-bold text-yellow-900">
                        {filteredOrders.filter(o => o.status === 'OUT_FOR_DELIVERY').length}
                    </p>
                </div>
                <div className="card text-center">
                    <p className="text-sm text-green-600">Delivered</p>
                    <p className="text-2xl font-bold text-green-900">
                        {filteredOrders.filter(o => o.status === 'DELIVERED').length}
                    </p>
                </div>
            </div>

            {/* Orders Table */}
            <div className="card">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-12">
                        <Package size={64} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-600">No orders found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivery Boy</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Package size={16} className="text-gray-400 mr-2" />
                                                <span className="text-sm font-medium text-gray-900">{order.orderNumber}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {order.customerName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {formatCurrency(order.invoiceAmount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                                                {order.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {order.deliveryPartnerName || (
                                                <span className="text-gray-400">Not assigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {formatDateTime(order.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/orders/${order.id}`);
                                                    }}
                                                    className="text-primary-600 hover:text-primary-900"
                                                    title="View Details"
                                                >
                                                    <Eye size={18} />
                                                </button>

                                                {(order.status === 'CREATED' || order.status === 'ASSIGNED' || order.status === 'OUT_FOR_DELIVERY') && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openEditModal(order);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-900"
                                                        title="Edit Order"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                )}

                                                {order.status === 'CREATED' && (
                                                    <>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openAssignModal(order);
                                                            }}
                                                            className="text-blue-600 hover:text-blue-900"
                                                            title="Assign Delivery Boy"
                                                        >
                                                            <UserPlus size={18} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCancelOrder(order);
                                                            }}
                                                            className="text-red-600 hover:text-red-900"
                                                            title="Cancel Order"
                                                        >
                                                            <XCircle size={18} />
                                                        </button>
                                                    </>
                                                )}

                                                {order.status === 'ASSIGNED' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOutForDelivery(order);
                                                        }}
                                                        className="text-yellow-600 hover:text-yellow-900"
                                                        title="Mark Out for Delivery"
                                                    >
                                                        <Truck size={18} />
                                                    </button>
                                                )}

                                                {order.status === 'OUT_FOR_DELIVERY' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openDeliverModal(order);
                                                        }}
                                                        className="text-green-600 hover:text-green-900"
                                                        title="Mark Delivered"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                )}

                                                {order.status === 'DELIVERED' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openReturnModal(order);
                                                        }}
                                                        className="text-orange-600 hover:text-orange-900"
                                                        title="Process Return"
                                                    >
                                                        <RotateCcw size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

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
                            onChange={(e) => setDeliverFormData({ paymentMethod: e.target.value })}
                            className="input"
                            required
                        >
                            <option value="CASH">Cash</option>
                            <option value="CARD">Card</option>
                            <option value="UPI">UPI</option>
                            <option value="CUSTOMER_CREDIT">Customer Credit</option>
                        </select>
                    </div>

                    <div className="flex gap-2 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setIsDeliverModalOpen(false);
                                setSelectedOrder(null);
                            }}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button type="submit" loading={submitting} className="flex-1 bg-green-600 hover:bg-green-700">
                            Confirm Delivery
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Assign Delivery Boy Modal */}
            <Modal
                isOpen={isAssignModalOpen}
                onClose={() => {
                    setIsAssignModalOpen(false);
                    setSelectedOrder(null);
                    setSelectedDeliveryBoy('');
                }}
                title="Assign Delivery Boy"
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
                        <label className="label">Select Delivery Boy *</label>
                        <select
                            value={selectedDeliveryBoy}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDeliveryBoy(e.target.value)}
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
                                No delivery boys available. Please add delivery boys first.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setIsAssignModalOpen(false);
                                setSelectedOrder(null);
                                setSelectedDeliveryBoy('');
                            }}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            loading={submitting}
                            disabled={deliveryBoys.length === 0}
                            className="flex-1"
                        >
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
            >
                <form onSubmit={handleReturnOrder} className="space-y-4">
                    {selectedOrder && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
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
                                    refundAmount: type === 'FULL' ? selectedOrder?.invoiceAmount.toString() : '',
                                });
                            }}
                            className="input"
                            required
                        >
                            <option value="FULL">Full Return</option>
                            <option value="PARTIAL">Partial Return</option>
                        </select>
                    </div>

                    <div>
                        <label className="label">Refund Amount *</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={selectedOrder?.invoiceAmount}
                            value={returnFormData.refundAmount}
                            onChange={(e) => setReturnFormData({ ...returnFormData, refundAmount: e.target.value })}
                            className="input"
                            placeholder="0.00"
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Refund Method *</label>
                        <select
                            value={returnFormData.refundMethod}
                            onChange={(e) => setReturnFormData({ ...returnFormData, refundMethod: e.target.value as any })}
                            className="input"
                            required
                        >
                            <option value="">Select Method</option>
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

                    <div className="flex gap-2 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setIsReturnModalOpen(false);
                                setSelectedOrder(null);
                                resetReturnForm();
                            }}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button type="submit" loading={submitting} className="flex-1 bg-red-600 hover:bg-red-700">
                            Process Return
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Order"
                size="lg"
            >
                <form onSubmit={handleEditOrder} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Invoice Number"
                            value={editFormData.invoiceNumber}
                            onChange={(e) => setEditFormData({ ...editFormData, invoiceNumber: e.target.value })}
                        />
                        <Input
                            label="Invoice Amount *"
                            type="number"
                            step="0.01"
                            value={editFormData.invoiceAmount}
                            onChange={(e) => setEditFormData({ ...editFormData, invoiceAmount: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="label">Order Items</label>
                            <Button type="button" size="sm" onClick={addEditItem}>Add Item</Button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {editFormData.items.map((item, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        className="input flex-1"
                                        placeholder="Description"
                                        value={item.description}
                                        onChange={(e) => updateEditItem(index, 'description', e.target.value)}
                                        required
                                    />
                                    <input
                                        className="input w-24"
                                        type="number"
                                        placeholder="Qty"
                                        value={item.quantity}
                                        onChange={(e) => updateEditItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                        min="1"
                                        required
                                    />
                                    {editFormData.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeEditItem(index)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded"
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
                            className="input"
                            rows={3}
                            value={editFormData.notes}
                            onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={submitting}>
                            Save Changes
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
