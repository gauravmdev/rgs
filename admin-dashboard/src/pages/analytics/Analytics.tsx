import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Package, Users, Clock, RotateCcw } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';

interface DailySalesData {
    date: string;
    totalOrders: number;
    grossSales: number;
    totalRefunds: number;
    netSales: number;
    totalSales: number; // For backward compatibility, equals netSales
    deliveredOrders: number;
    cancelledOrders: number;
    returnedOrders: number;
}

interface WeeklySalesData {
    week: string;
    totalOrders: number;
    grossSales: number;
    totalRefunds: number;
    netSales: number;
    totalSales: number;
    averageOrderValue: number;
}

interface PaymentBreakdown {
    paymentMethod: string;
    count: number;
    totalAmount: number;
    percentage: number;
}

interface SourceBreakdown {
    source: string;
    count: number;
    totalSales: number;
    percentage: number;
}

interface DeliveryPerformance {
    deliveryPartnerId: number;
    name: string;
    totalDeliveries: number;
    averageDeliveryTime: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Analytics() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [dailySales, setDailySales] = useState<DailySalesData[]>([]);
    const [weeklySales, setWeeklySales] = useState<WeeklySalesData[]>([]);
    const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown[]>([]);
    const [sourceBreakdown, setSourceBreakdown] = useState<SourceBreakdown[]>([]);
    const [deliveryPerformance, setDeliveryPerformance] = useState<DeliveryPerformance[]>([]);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const storeId = user?.storeId;
            const storeParam = storeId ? `?storeId=${storeId}` : '';

            const [dailyRes, weeklyRes, paymentRes, sourceRes, deliveryRes] = await Promise.all([
                api.get(`/analytics/daily-sales${storeParam}`),
                api.get(`/analytics/weekly-sales${storeParam}`),
                api.get(`/analytics/payment-methods${storeParam}`),
                api.get(`/analytics/order-sources${storeParam}`),
                api.get(`/analytics/delivery-performance${storeParam}`),
            ]);

            setDailySales(dailyRes.data.salesData || []);
            setWeeklySales(weeklyRes.data.weeklySales || []);
            setPaymentBreakdown(paymentRes.data.paymentBreakdown || []);
            setSourceBreakdown(sourceRes.data.sourceBreakdown || []);
            setDeliveryPerformance(deliveryRes.data.deliveryPerformance || []);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // Calculate totals
    const totalGrossSales = dailySales.reduce((sum, day) => sum + day.grossSales, 0);
    const totalRefunds = dailySales.reduce((sum, day) => sum + day.totalRefunds, 0);
    const totalNetSales = dailySales.reduce((sum, day) => sum + day.netSales, 0);
    const totalOrders = dailySales.reduce((sum, day) => sum + day.totalOrders, 0);
    const avgOrderValue = totalOrders > 0 ? totalNetSales / totalOrders : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
                <p className="text-gray-600 mt-1">Insights and performance metrics</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Gross Sales (30d)</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalGrossSales)}</p>
                        </div>
                        <DollarSign className="text-blue-600" size={32} />
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Refunds</p>
                            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalRefunds)}</p>
                        </div>
                        <RotateCcw className="text-red-500" size={32} />
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Sales (Net)</p>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalNetSales)}</p>
                        </div>
                        <DollarSign className="text-green-500" size={32} />
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Orders (30d)</p>
                            <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                        </div>
                        <Package className="text-purple-600" size={32} />
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Avg Order Value</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(avgOrderValue)}</p>
                        </div>
                        <TrendingUp className="text-orange-600" size={32} />
                    </div>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Sales Chart */}
                <div className="card">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Daily Sales (Last 30 Days)</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={dailySales}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="totalSales" stroke="#3b82f6" strokeWidth={2} name="Sales" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Weekly Sales Chart */}
                <div className="card">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Weekly Sales</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={weeklySales}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                            <Bar dataKey="totalSales" fill="#10b981" name="Total Sales" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Methods */}
                <div className="card">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Methods Distribution</h2>
                    {paymentBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={paymentBreakdown}
                                    dataKey="totalAmount"
                                    nameKey="paymentMethod"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label={(entry) => `${entry.paymentMethod}: ${entry.percentage}%`}
                                >
                                    {paymentBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center py-12 text-gray-500">No payment data available</div>
                    )}
                    <div className="mt-4 space-y-2">
                        {paymentBreakdown.map((method, index) => (
                            <div key={method.paymentMethod} className="flex items-center justify-between text-sm">
                                <div className="flex items-center space-x-2">
                                    <div
                                        className="w-4 h-4 rounded"
                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                    ></div>
                                    <span className="text-gray-900">{method.paymentMethod}</span>
                                </div>
                                <span className="font-medium text-gray-900">{formatCurrency(method.totalAmount)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Order Sources */}
                <div className="card">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Order Sources</h2>
                    {sourceBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={sourceBreakdown}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="source" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="count" fill="#8b5cf6" name="Orders" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center py-12 text-gray-500">No source data available</div>
                    )}
                    <div className="mt-4 space-y-2">
                        {sourceBreakdown.map((source) => (
                            <div key={source.source} className="flex items-center justify-between text-sm">
                                <span className="text-gray-900">{source.source}</span>
                                <div className="text-right">
                                    <p className="font-medium text-gray-900">{source.count} orders</p>
                                    <p className="text-gray-600">{formatCurrency(source.totalSales)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Delivery Performance */}
            <div className="card">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Delivery Partner Performance</h2>
                {deliveryPerformance.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Deliveries</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Delivery Time</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {deliveryPerformance.map((partner) => (
                                    <tr key={partner.deliveryPartnerId}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {partner.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {partner.totalDeliveries}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <div className="flex items-center space-x-2">
                                                <Clock size={16} className="text-gray-400" />
                                                <span>{partner.averageDeliveryTime} min</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center">
                                                <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                                    <div
                                                        className={`h-2 rounded-full ${partner.averageDeliveryTime < 30 ? 'bg-green-500' :
                                                            partner.averageDeliveryTime < 45 ? 'bg-yellow-500' :
                                                                'bg-red-500'
                                                            }`}
                                                        style={{ width: `${Math.min((60 - partner.averageDeliveryTime) / 60 * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                                <span className={`text-xs font-medium ${partner.averageDeliveryTime < 30 ? 'text-green-600' :
                                                    partner.averageDeliveryTime < 45 ? 'text-yellow-600' :
                                                        'text-red-600'
                                                    }`}>
                                                    {partner.averageDeliveryTime < 30 ? 'Excellent' :
                                                        partner.averageDeliveryTime < 45 ? 'Good' : 'Needs Improvement'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500">No delivery performance data available</div>
                )}
            </div>
        </div>
    );
}
