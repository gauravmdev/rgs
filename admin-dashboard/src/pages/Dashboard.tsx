import { useEffect, useState, type ElementType } from 'react';
import { ShoppingCart, Package, DollarSign, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { formatCurrency } from '../lib/utils';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { DashboardStats, Order } from '../types';

interface StatCard {
    title: string;
    value: string | number;
    icon: ElementType;
    color: string;
    bgColor: string;
}

export default function Dashboard() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentOrders, setRecentOrders] = useState<Order[]>([]);

    useEffect(() => {
        fetchDashboardData();

        // Listen for real-time updates
        const socket = getSocket();
        if (socket) {
            socket.on('order-created', handleOrderUpdate);
            socket.on('order-updated', handleOrderUpdate);
            socket.on('order-delivered', handleOrderUpdate);
            socket.on('order-cancelled', handleOrderUpdate);
        }

        return () => {
            if (socket) {
                socket.off('order-created', handleOrderUpdate);
                socket.off('order-updated', handleOrderUpdate);
                socket.off('order-delivered', handleOrderUpdate);
                socket.off('order-cancelled', handleOrderUpdate);
            }
        };
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const storeId = user?.storeId;
            const url = storeId ? `/analytics/dashboard?storeId=${storeId}` : '/analytics/dashboard';

            const response = await api.get(url);
            setStats(response.data.stats);
            setRecentOrders(response.data.recentOrders || []);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOrderUpdate = () => {
        // Refresh dashboard data when orders update
        fetchDashboardData();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    const statCards: StatCard[] = [
        {
            title: "Today's Sales",
            value: formatCurrency(stats?.todaySales || 0),
            icon: DollarSign,
            color: 'text-green-600',
            bgColor: 'bg-green-100',
        },
        {
            title: "Today's Orders",
            value: stats?.todayOrders || 0,
            icon: ShoppingCart,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
        },
        {
            title: 'Active Orders',
            value: (stats?.activeOrders.created || 0) +
                (stats?.activeOrders.assigned || 0) +
                (stats?.activeOrders.out_for_delivery || 0),
            icon: Package,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
        },
        {
            title: 'Total Dues',
            value: formatCurrency(stats?.totalDues || 0),
            icon: AlertCircle,
            color: 'text-red-600',
            bgColor: 'bg-red-100',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">Welcome back, {user?.name}!</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="card">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                                </div>
                                <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                                    <Icon size={24} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Active Orders Breakdown */}
            <div className="card">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Active Orders</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Created</p>
                        <p className="text-2xl font-bold text-gray-900">{stats?.activeOrders.created || 0}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-600">Assigned</p>
                        <p className="text-2xl font-bold text-blue-900">{stats?.activeOrders.assigned || 0}</p>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-600">Out for Delivery</p>
                        <p className="text-2xl font-bold text-yellow-900">{stats?.activeOrders.out_for_delivery || 0}</p>
                    </div>
                </div>
            </div>

            {/* Recent Orders */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Recent Orders</h2>
                    <a href="/orders" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                        View All →
                    </a>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Package size={48} className="mx-auto mb-2 opacity-50" />
                        <p>No recent orders</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {recentOrders.slice(0, 10).map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {order.orderNumber}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {order.customerName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${order.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                                                order.status === 'OUT_FOR_DELIVERY' ? 'bg-yellow-100 text-yellow-800' :
                                                    order.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-800' :
                                                        order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                                }`}>
                                                {order.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {formatCurrency(order.invoiceAmount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
