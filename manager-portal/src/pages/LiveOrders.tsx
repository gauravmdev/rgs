import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, User, DollarSign, Clock, RefreshCw, UserPlus } from 'lucide-react';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/utils';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function LiveOrders() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [deliveryBoys, setDeliveryBoys] = useState<any[]>([]);

    // Assign modal
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchOrders();
        fetchDeliveryBoys();

        // Real-time updates
        const socket = getSocket();
        if (socket) {
            const handleRealtimeUpdate = (data: any) => {
                console.log('📦 Real-time order update received:', data);
                fetchOrders();
                setLastUpdate(new Date());
            };

            socket.on('order-created', handleRealtimeUpdate);
            socket.on('order-updated', handleRealtimeUpdate);
            socket.on('order-assigned', handleRealtimeUpdate);
            socket.on('order-out-for-delivery', handleRealtimeUpdate);
            socket.on('order-delivered', handleRealtimeUpdate);
            socket.on('order-cancelled', handleRealtimeUpdate);

            return () => {
                socket.off('order-created', handleRealtimeUpdate);
                socket.off('order-updated', handleRealtimeUpdate);
                socket.off('order-assigned', handleRealtimeUpdate);
                socket.off('order-out-for-delivery', handleRealtimeUpdate);
                socket.off('order-delivered', handleRealtimeUpdate);
                socket.off('order-cancelled', handleRealtimeUpdate);
            };
        }

        // Backup refresh every 30 seconds
        const interval = setInterval(() => {
            console.log('🔄 Backup refresh (30s)');
            fetchOrders();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            // IMPORTANT: Only fetch active orders from manager's store
            const response = await api.get(`/orders?status=CREATED,ASSIGNED,OUT_FOR_DELIVERY&storeId=${user?.storeId}&limit=100`);
            setOrders(response.data.orders);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
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

    const handleAssignOrder = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDeliveryBoy) {
            toast.error('Please select a delivery boy');
            return;
        }

        setSubmitting(true);
        try {
            await api.post(`/orders/${selectedOrder.id}/assign`, {
                deliveryPartnerId: parseInt(selectedDeliveryBoy),
            });

            toast.success('Order assigned successfully!');
            setIsAssignModalOpen(false);
            setSelectedOrder(null);
            setSelectedDeliveryBoy('');
            fetchOrders();
        } catch (error: any) {
            console.error('Failed to assign order:', error);
            toast.error(error.response?.data?.error || 'Failed to assign order');
        } finally {
            setSubmitting(false);
        }
    };

    const openAssignModal = (order: any) => {
        setSelectedOrder(order);
        setSelectedDeliveryBoy('');
        setIsAssignModalOpen(true);
    };

    const getOrdersByStatus = (status: string) => {
        return orders.filter((order) => order.status === status);
    };

    const createdOrders = getOrdersByStatus('CREATED');
    const assignedOrders = getOrdersByStatus('ASSIGNED');
    const outForDeliveryOrders = getOrdersByStatus('OUT_FOR_DELIVERY');

    if (loading && orders.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    const OrderCard = ({ order }: { order: any }) => (
        <div
            className="bg-white rounded-lg shadow-md p-4 mb-3 hover:shadow-lg transition-shadow border-l-4 border-primary-500 cursor-pointer"
            onClick={() => navigate(`/order/${order.id}`)}
        >
            <div className="flex items-start justify-between mb-2">
                <div>
                    <p className="font-bold text-gray-900">{order.orderNumber}</p>
                    <p className="text-sm text-gray-600">{order.customerName}</p>
                </div>
                <span className="text-lg font-bold text-primary-600">
                    {formatCurrency(order.invoiceAmount)}
                </span>
            </div>

            <div className="space-y-2 mt-3">
                <div className="flex items-center text-sm text-gray-600">
                    <Package size={14} className="mr-2" />
                    <span>{order.totalItems} items</span>
                </div>

                {order.deliveryPartnerName && (
                    <div className="flex items-center text-sm text-gray-600">
                        <User size={14} className="mr-2" />
                        <span>{order.deliveryPartnerName}</span>
                    </div>
                )}

                <div className="flex items-center text-sm text-gray-600">
                    <Clock size={14} className="mr-2" />
                    <span>{formatDateTime(order.createdAt)}</span>
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                    {order.source}
                </span>

                {order.status === 'CREATED' && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openAssignModal(order);
                        }}
                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
                    >
                        <UserPlus size={12} className="mr-1" />
                        Assign
                    </button>
                )}
            </div>
        </div>
    );

    const Column = ({ title, orders, color, icon: Icon }: {
        title: string;
        orders: any[];
        color: string;
        icon: React.ElementType;
    }) => (
        <div className="flex-1 min-w-[300px]">
            <div className={`${color} rounded-t-lg p-4`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Icon size={20} className="text-white" />
                        <h3 className="text-lg font-bold text-white">{title}</h3>
                    </div>
                    <span className="bg-white text-gray-900 font-bold px-3 py-1 rounded-full text-sm">
                        {orders.length}
                    </span>
                </div>
            </div>
            <div className="bg-gray-50 rounded-b-lg p-4 min-h-[600px]">
                {orders.length === 0 ? (
                    <div className="text-center py-12">
                        <Package size={48} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500 text-sm">No orders</p>
                    </div>
                ) : (
                    orders.map((order) => <OrderCard key={order.id} order={order} />)
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/orders')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Live Orders Dashboard</h1>
                        <p className="text-gray-600 mt-1">
                            {user?.storeName} • Last updated: {lastUpdate.toLocaleTimeString()}
                        </p>
                    </div>
                </div>
                <Button onClick={fetchOrders} variant="secondary">
                    <RefreshCw size={20} className="mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Active</p>
                            <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                        </div>
                        <Package className="text-primary-600" size={32} />
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">New Orders</p>
                            <p className="text-2xl font-bold text-gray-900">{createdOrders.length}</p>
                        </div>
                        <Package className="text-gray-600" size={32} />
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-blue-600">Assigned</p>
                            <p className="text-2xl font-bold text-blue-900">{assignedOrders.length}</p>
                        </div>
                        <User className="text-blue-600" size={32} />
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-yellow-600">Out for Delivery</p>
                            <p className="text-2xl font-bold text-yellow-900">{outForDeliveryOrders.length}</p>
                        </div>
                        <DollarSign className="text-yellow-600" size={32} />
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex gap-6 overflow-x-auto pb-4">
                <Column
                    title="New Orders"
                    orders={createdOrders}
                    color="bg-gray-700"
                    icon={Package}
                />
                <Column
                    title="Assigned"
                    orders={assignedOrders}
                    color="bg-blue-600"
                    icon={User}
                />
                <Column
                    title="Out for Delivery"
                    orders={outForDeliveryOrders}
                    color="bg-yellow-500"
                    icon={DollarSign}
                />
            </div>

            {/* Empty State */}
            {orders.length === 0 && !loading && (
                <div className="card text-center py-12">
                    <Package size={64} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Orders</h3>
                    <p className="text-gray-600 mb-6">All orders are completed. New orders will appear here in real-time.</p>
                    <Button onClick={() => navigate('/process-order')}>
                        <Package size={20} className="mr-2" />
                        Create Order
                    </Button>
                </div>
            )}

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
                            onChange={(e) => setSelectedDeliveryBoy(e.target.value)}
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
                                No delivery boys available for your store.
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
        </div>
    );
}
