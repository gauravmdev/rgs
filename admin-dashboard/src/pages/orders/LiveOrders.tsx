import { useEffect, useState } from 'react';
import { ArrowLeft, Package, User, DollarSign, Clock, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSocket, connectSocket } from '../../lib/socket';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import type { Order } from '../../types';
import { useAuthStore } from '../../store/authStore';

export default function LiveOrders() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    useEffect(() => {
        fetchOrders();

        // Get or create socket connection
        let socket = getSocket();

        if (!socket) {
            console.log('🔴 LiveOrders: Socket not found, creating connection...');
            socket = connectSocket(user?.storeId, user?.role === 'ADMIN');
        }

        if (!socket) {
            console.error('❌ Failed to create socket connection');
            return;
        }

        console.log('🔴 LiveOrders: Setting up socket listeners', {
            connected: socket.connected,
            socketId: socket.id,
            storeId: user?.storeId
        });

        const handleRealtimeUpdate = (data: any) => {
            console.log('📦 Real-time order update received:', {
                event: data,
                timestamp: new Date().toLocaleTimeString()
            });
            fetchOrders();
            setLastUpdate(new Date());
        };

        // Register all event listeners
        socket.on('order-created', handleRealtimeUpdate);
        socket.on('order-updated', handleRealtimeUpdate);
        socket.on('order-assigned', handleRealtimeUpdate);
        socket.on('order-out-for-delivery', handleRealtimeUpdate);
        socket.on('order-delivered', handleRealtimeUpdate);
        socket.on('order-cancelled', handleRealtimeUpdate);
        socket.on('order-returned', handleRealtimeUpdate);

        // Ensure socket is connected
        if (!socket.connected) {
            console.warn('⚠️ Socket not connected, attempting to connect...');
            socket.connect();

            // Wait for connection
            socket.once('connect', () => {
                console.log('✅ Socket connected in LiveOrders');
                if (user?.storeId) {
                    socket.emit('join-store', user.storeId);
                    console.log('📍 Joined store room:', user.storeId);
                }
            });
        } else {
            console.log('✅ Socket already connected:', socket.id);
            // Make sure we're in the store room
            if (user?.storeId) {
                socket.emit('join-store', user.storeId);
                console.log('📍 Re-joined store room:', user.storeId);
            }
        }

        // Backup refresh every 30 seconds
        const interval = setInterval(() => {
            console.log('🔄 Backup refresh (30s)');
            fetchOrders();
        }, 30000);

        // Cleanup
        return () => {
            console.log('🔴 LiveOrders: Cleaning up socket listeners');
            if (socket) {
                socket.off('order-created', handleRealtimeUpdate);
                socket.off('order-updated', handleRealtimeUpdate);
                socket.off('order-assigned', handleRealtimeUpdate);
                socket.off('order-out-for-delivery', handleRealtimeUpdate);
                socket.off('order-delivered', handleRealtimeUpdate);
                socket.off('order-cancelled', handleRealtimeUpdate);
                socket.off('order-returned', handleRealtimeUpdate);
            }
            clearInterval(interval);
        };
    }, [user?.storeId]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const storeId = user?.storeId;
            const storeParam = storeId ? `&storeId=${storeId}` : '';

            // Fetch only active orders (not delivered, cancelled, or returned)
            const response = await api.get(`/orders?status=CREATED,ASSIGNED,OUT_FOR_DELIVERY${storeParam}&limit=100`);
            setOrders(response.data.orders);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
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

    const OrderCard = ({ order }: { order: Order }) => (
        <div
            onClick={() => navigate(`/orders/${order.id}`, { state: { from: 'live' } })}
            className="bg-white rounded-lg shadow-md p-4 mb-3 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-primary-500"
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


        </div>
    );

    const Column = ({ title, orders, color, icon: Icon }: {
        title: string;
        orders: Order[];
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
                            Real-time order tracking • Last updated: {lastUpdate.toLocaleTimeString()}
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
                            <p className="text-sm text-gray-600">Assigned</p>
                            <p className="text-2xl font-bold text-blue-900">{assignedOrders.length}</p>
                        </div>
                        <User className="text-blue-600" size={32} />
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Out for Delivery</p>
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
                    <Button onClick={() => navigate('/orders')}>
                        View All Orders
                    </Button>
                </div>
            )}
        </div>
    );
}
