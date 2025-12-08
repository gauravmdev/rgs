import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, CheckCircle, Clock, LogOut, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '../lib/utils';
import { connectSocket, getSocket } from '../lib/socket';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Order } from '../types';

interface DeliveryStats {
    assigned: number;
    outForDelivery: number;
    delivered: number;
}

export default function Dashboard() {
    console.log('Dashboard component loaded');
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DeliveryStats>({
        assigned: 0,
        outForDelivery: 0,
        delivered: 0,
    });
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        fetchOrders();

        // Connect socket for real-time updates
        let socket = getSocket();
        if (!socket) {
            console.log('📱 Creating socket connection for Delivery Boy...');
            socket = connectSocket(user?.storeId, false);
        }

        if (socket) {
            const handleUpdate = () => {
                console.log('📦 Real-time update received');
                fetchOrders();
            };

            socket.on('order-assigned', handleUpdate);
            socket.on('order-updated', handleUpdate);
            socket.on('order-out-for-delivery', handleUpdate);
            socket.on('order-delivered', handleUpdate);

            return () => {
                if (socket) {
                    socket.off('order-assigned', handleUpdate);
                    socket.off('order-updated', handleUpdate);
                    socket.off('order-out-for-delivery', handleUpdate);
                    socket.off('order-delivered', handleUpdate);
                }
            };
        }
    }, [user?.id, user?.storeId]);

    const fetchOrders = async () => {
        try {
            // Fetch orders assigned to this delivery boy using correct endpoint
            const response = await api.get(`/orders?deliveryPartnerId=${user?.id}&status=ASSIGNED,OUT_FOR_DELIVERY&limit=50`);
            const fetchedOrders = response.data.orders || [];
            setOrders(fetchedOrders);

            // Calculate stats
            const assigned = fetchedOrders.filter((o: any) => o.status === 'ASSIGNED').length;
            const outForDelivery = fetchedOrders.filter((o: any) => o.status === 'OUT_FOR_DELIVERY').length;

            setStats({
                assigned,
                outForDelivery,
                delivered: 0, // Can fetch today's delivered count separately if needed
            });
        } catch (error: any) {
            console.error('Failed to fetch orders:', error);

            // Don't show error if there are simply no orders (though usually it returns empty array)
            if (error.response?.status !== 404) {
                // only show error for actual server errors
            }

            // Set empty state
            setOrders([]);
            setStats({ assigned: 0, outForDelivery: 0, delivered: 0 });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-primary-600 text-white p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold">Dashboard</h1>
                        <p className="text-primary-100">Welcome, {user?.name}</p>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => navigate('/history')}
                            className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
                            title="View History"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
                        >
                            <LogOut size={24} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="p-4 grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between mb-2">
                        <Clock size={24} className="text-orange-600" />
                    </div>
                    <p className="text-2xl font-bold">{stats.assigned}</p>
                    <p className="text-xs text-gray-600">Assigned</p>
                </div>

                <div className="bg-white rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between mb-2">
                        <Truck size={24} className="text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold">{stats.outForDelivery}</p>
                    <p className="text-xs text-gray-600">On Way</p>
                </div>

                <div className="bg-white rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between mb-2">
                        <CheckCircle size={24} className="text-green-600" />
                    </div>
                    <p className="text-2xl font-bold">{stats.delivered}</p>
                    <p className="text-xs text-gray-600">Done</p>
                </div>
            </div>

            {/* Active Deliveries */}
            <div className="p-4">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Active Deliveries</h2>

                {orders.length === 0 ? (
                    <div className="bg-white rounded-lg p-8 text-center">
                        <Package size={48} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-600">No active deliveries</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                onClick={() => navigate(`/order/${order.id}`)}
                                className="bg-white rounded-lg p-4 shadow active:bg-gray-50"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="font-bold text-gray-900">#{order.orderNumber}</p>
                                        <p className="text-sm text-gray-600">{order.customer?.name}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{order.customer?.address}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-primary-600">
                                        {formatCurrency(order.invoiceAmount)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {formatDateTime(order.createdAt)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
