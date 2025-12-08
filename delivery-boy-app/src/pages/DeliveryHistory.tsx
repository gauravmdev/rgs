import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Calendar, Package, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '../lib/utils';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Order } from '../types';

export default function DeliveryHistory() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [stats, setStats] = useState({
        totalDeliveries: 0,
        totalEarnings: 0,
        avgDeliveryTime: 0,
    });

    useEffect(() => {
        fetchHistory();
    }, []);

    useEffect(() => {
        filterOrders();
    }, [searchTerm, selectedDate, orders]);

    const fetchHistory = async () => {
        try {
            // Fetch all delivered orders for this delivery boy
            const response = await api.get(`/orders?deliveryPartnerId=${user?.id}&status=DELIVERED&limit=100`);
            const deliveredOrders = response.data.orders || [];
            setOrders(deliveredOrders);

            // Calculate stats
            const total = deliveredOrders.length;
            const totalAmount = deliveredOrders.reduce((sum: number, order: Order) => {
                return sum + (parseFloat(order.invoiceAmount?.toString() || '0'));
            }, 0);

            setStats({
                totalDeliveries: total,
                totalEarnings: totalAmount,
                avgDeliveryTime: 0, // Can calculate if we have delivery time data
            });
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterOrders = () => {
        let filtered = [...orders];

        // Filter by search term (order number or customer name)
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (order) =>
                    order.orderNumber.toLowerCase().includes(search) ||
                    order.customerName.toLowerCase().includes(search)
            );
        }

        // Filter by date
        if (selectedDate) {
            const targetDate = new Date(selectedDate).toDateString();
            filtered = filtered.filter(
                (order) => new Date(order.deliveredAt || order.createdAt).toDateString() === targetDate
            );
        }

        setFilteredOrders(filtered);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedDate('');
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-primary-600 text-white p-6 shadow-lg">
                <div className="flex items-center mb-4">
                    <button onClick={() => navigate('/')} className="mr-4 p-2 hover:bg-primary-700 rounded-full">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold">Delivery History</h1>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-primary-500 rounded-lg p-3">
                        <div className="flex items-center mb-1">
                            <Package size={18} className="mr-2" />
                            <span className="text-xs opacity-90">Total</span>
                        </div>
                        <p className="text-2xl font-bold">{stats.totalDeliveries}</p>
                    </div>
                    <div className="bg-primary-500 rounded-lg p-3">
                        <div className="flex items-center mb-1">
                            <TrendingUp size={18} className="mr-2" />
                            <span className="text-xs opacity-90">Earnings</span>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(stats.totalEarnings)}</p>
                    </div>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by order # or customer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    {/* Date Filter */}
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    {/* Clear Filters */}
                    {(searchTerm || selectedDate) && (
                        <button
                            onClick={clearFilters}
                            className="w-full py-2 text-sm text-primary-600 font-medium hover:bg-primary-50 rounded-lg transition-colors"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                {/* Results Count */}
                <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{filteredOrders.length} deliveries found</span>
                </div>

                {/* Order List */}
                {filteredOrders.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center">
                        <Package size={48} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-600">No deliveries found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredOrders.map((order) => (
                            <div
                                key={order.id}
                                onClick={() => navigate(`/order/${order.id}`)}
                                className="bg-white rounded-lg p-4 shadow-sm active:bg-gray-50"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="font-bold text-gray-900">#{order.orderNumber}</p>
                                        <p className="text-sm text-gray-600">{order.customerName}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div>
                                        <span className="text-gray-500">Delivered:</span>
                                        <span className="ml-2 text-gray-700">
                                            {formatDateTime(order.deliveredAt || order.createdAt)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                    <span className="text-sm text-gray-500">Amount</span>
                                    <span className="font-bold text-primary-600">
                                        {formatCurrency(order.invoiceAmount)}
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
