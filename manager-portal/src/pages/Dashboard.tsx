import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Users, DollarSign, Plus, Clock, BarChart3, Store } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, formatDateTime, getStatusColor } from '../lib/utils';
import { getSocket } from '../lib/socket';
import type { Order, DashboardStats } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentOrders, setRecentOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const storeQuery = user?.storeId ? `storeId=${user.storeId}&` : '';

            const [statsRes, ordersRes] = await Promise.all([
                api.get(`/analytics/dashboard?storeId=${user?.storeId}`),
                api.get(`/orders?${storeQuery}limit=5`)
            ]);

            setStats(statsRes.data.stats);
            setRecentOrders(ordersRes.data.orders);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();

        // Listen for real-time updates
        const socket = getSocket();

        const handleUpdate = (data: any) => {
            // Check if update is relevant to this store
            if (user?.storeId && (data.storeId === user.storeId || data.order?.storeId === user.storeId)) {
                console.log('🔄 Dashboard: Update received', data);
                // Accessing the latest fetchDashboardData function (it's stable, but good practice)
                api.get(`/analytics/dashboard?storeId=${user?.storeId}`).then(res => setStats(res.data.stats));
                const storeQuery = user?.storeId ? `storeId=${user.storeId}&` : '';
                api.get(`/orders?${storeQuery}limit=5`).then(res => setRecentOrders(res.data.orders));
            }
        };

        if (socket) {
            socket.on('order-created', handleUpdate);
            socket.on('order-updated', handleUpdate);
            socket.on('order-assigned', handleUpdate);
            socket.on('order-out-for-delivery', handleUpdate);
            socket.on('order-delivered', handleUpdate);
            socket.on('order-cancelled', handleUpdate);
            socket.on('order-returned', handleUpdate);
        }

        return () => {
            if (socket) {
                socket.off('order-created', handleUpdate);
                socket.off('order-updated', handleUpdate);
                socket.off('order-assigned', handleUpdate);
                socket.off('order-out-for-delivery', handleUpdate);
                socket.off('order-delivered', handleUpdate);
                socket.off('order-cancelled', handleUpdate);
                socket.off('order-returned', handleUpdate);
            }
        };
    }, [user?.storeId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    const statCards = [
        {
            title: "Today's Orders",
            value: stats?.todayOrders || 0,
            icon: Package,
            color: 'bg-blue-500',
            textColor: 'text-blue-600',
            bgColor: 'bg-blue-50'
        },
        {
            title: 'Active Orders',
            value: (stats?.activeOrders?.created || 0) + (stats?.activeOrders?.assigned || 0) + (stats?.activeOrders?.out_for_delivery || 0),
            icon: Package,
            color: 'bg-green-500',
            textColor: 'text-green-600',
            bgColor: 'bg-green-50'
        },
        {
            title: "Today's Sales",
            value: formatCurrency(stats?.todaySales || 0),
            icon: DollarSign,
            color: 'bg-yellow-500',
            textColor: 'text-yellow-600',
            bgColor: 'bg-yellow-50'
        },
        {
            title: 'Pending Orders',
            value: stats?.activeOrders?.created || 0,
            icon: Clock,
            color: 'bg-purple-500',
            textColor: 'text-purple-600',
            bgColor: 'bg-purple-50'
        },
    ];

    return (
        <div>
            {/* Welcome Header */}
            <div className="card bg-gradient-to-r from-primary-600 to-primary-700 text-white mb-4 sm:mb-6 lg:mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                    <div>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Welcome, {user?.name}!</h1>
                        <div className="flex items-center space-x-2 mt-2">
                            <Store size={16} className="text-primary-100 sm:w-5 sm:h-5" />
                            <p className="text-primary-100 text-sm sm:text-base lg:text-lg">Managing: {user?.storeName || 'Store'}</p>
                        </div>
                    </div>
                    <div className="text-left sm:text-right">
                        <p className="text-xs sm:text-sm text-primary-100">Store Manager</p>
                        <p className="text-xs text-primary-200">Store ID: #{user?.storeId}</p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="card">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-xs sm:text-sm text-gray-600 mb-1">{stat.title}</p>
                                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{stat.value}</p>
                                </div>
                                <div className={`${stat.bgColor} p-2 sm:p-3 rounded-lg flex-shrink-0`}>
                                    <Icon className={stat.textColor} size={20} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
                <button
                    onClick={() => navigate('/process-order')}
                    className="card hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200 active:scale-95 min-h-[120px] sm:min-h-[140px]"
                >
                    <div className="flex items-center justify-center mb-2 sm:mb-3">
                        <Plus size={28} className="text-primary-600 sm:w-8 sm:h-8" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 text-center">Create Order</h3>
                    <p className="text-xs sm:text-sm text-gray-600 text-center mt-1">Process new order</p>
                </button>

                <button
                    onClick={() => navigate('/customers')}
                    className="card hover:shadow-lg transition-shadow cursor-pointer active:scale-95 min-h-[120px] sm:min-h-[140px]"
                >
                    <div className="flex items-center justify-center mb-2 sm:mb-3">
                        <Users size={28} className="text-blue-600 sm:w-8 sm:h-8" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 text-center">Add Customer</h3>
                    <p className="text-xs sm:text-sm text-gray-600 text-center mt-1">Manage customers</p>
                </button>

                <button
                    onClick={() => navigate('/analytics')}
                    className="card hover:shadow-lg transition-shadow cursor-pointer active:scale-95 min-h-[120px] sm:min-h-[140px] sm:col-span-2 lg:col-span-1"
                >
                    <div className="flex items-center justify-center mb-2 sm:mb-3">
                        <BarChart3 size={28} className="text-green-600 sm:w-8 sm:h-8" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 text-center">View Analytics</h3>
                    <p className="text-xs sm:text-sm text-gray-600 text-center mt-1">Sales reports</p>
                </button>
            </div>

            {/* Recent Orders */}
            <div className="card">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Recent Orders</h2>
                {recentOrders.length > 0 ? (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {recentOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                #{order.orderNumber}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {order.customerName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {formatCurrency(order.invoiceAmount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDateTime(order.createdAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-3">
                            {recentOrders.map((order) => (
                                <div key={order.id} className="bg-gray-50 rounded-lg p-4 space-y-2 active:bg-gray-100 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs text-gray-500">Order Number</p>
                                            <p className="text-sm font-semibold text-gray-900">#{order.orderNumber}</p>
                                        </div>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs text-gray-500">Customer</p>
                                            <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Amount</p>
                                            <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.invoiceAmount)}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Date</p>
                                        <p className="text-sm text-gray-700">{formatDateTime(order.createdAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <Package size={40} className="mx-auto mb-2 text-gray-300 sm:w-12 sm:h-12" />
                        <p className="text-sm sm:text-base">No recent orders</p>
                    </div>
                )}
            </div>
        </div>
    );
}
