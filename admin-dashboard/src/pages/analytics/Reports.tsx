import { useState, useEffect } from 'react';
import { Download, TrendingUp, Users, DollarSign, Package, FileText, Filter } from 'lucide-react';
import { api } from '../../lib/api';
import { exportToExcel, exportToCSV } from '../../lib/export';
import { formatCurrency, formatDate } from '../../lib/utils';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';

interface ReportFilters {
    startDate: string;
    endDate: string;
    storeId: string;
    reportType: string;
}

export default function Reports() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any[]>([]);
    const [reportType, setReportType] = useState('sales');
    const [filters, setFilters] = useState<ReportFilters>({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        storeId: user?.storeId?.toString() || '',
        reportType: 'sales',
    });
    const [stores, setStores] = useState<any[]>([]);
    // const [summary, setSummary] = useState<any>(null);

    useEffect(() => {
        fetchStores();
    }, []);

    useEffect(() => {
        if (reportType) {
            generateReport();
        }
    }, [reportType, filters.startDate, filters.endDate, filters.storeId]);

    const fetchStores = async () => {
        try {
            const response = await api.get('/stores');
            setStores(response.data.stores);
        } catch (error) {
            console.error('Failed to fetch stores:', error);
        }
    };

    const generateReport = async () => {
        setLoading(true);
        try {
            let data: any[] = [];
            // let summaryData: any = {};

            switch (reportType) {
                case 'sales':
                    data = await generateSalesReport();
                    break;
                case 'customers':
                    data = await generateCustomerReport();
                    break;
                case 'delivery':
                    data = await generateDeliveryReport();
                    break;
                case 'items':
                    data = await generateItemsReport();
                    break;
                case 'payment':
                    data = await generatePaymentReport();
                    break;
                case 'store-comparison':
                    data = await generateStoreComparisonReport();
                    break;
                default:
                    data = [];
            }

            setReportData(data);
            setReportData(data);
        } catch (error) {
            console.error('Failed to generate report:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateSalesReport = async () => {
        const storeParam = filters.storeId ? `&storeId=${filters.storeId}` : '';
        const response = await api.get(`/analytics/daily-sales?startDate=${filters.startDate}&endDate=${filters.endDate}${storeParam}`);

        return response.data.salesData.map((item: any) => ({
            Date: formatDate(item.date),
            'Total Orders': item.totalOrders,
            'Total Sales': formatCurrency(item.totalSales),
            'Delivered Orders': item.deliveredOrders,
            'Cancelled Orders': item.cancelledOrders,
            'Success Rate': `${Math.round((item.deliveredOrders / item.totalOrders) * 100)}%`,
        }));
    };

    const generateCustomerReport = async () => {
        const storeParam = filters.storeId ? `?storeId=${filters.storeId}` : '';
        const response = await api.get(`/customers${storeParam}`);

        return response.data.customers
            .sort((a: any, b: any) => parseFloat(b.totalSales) - parseFloat(a.totalSales))
            .slice(0, 50)
            .map((customer: any) => ({
                'Customer Name': customer.name,
                'Email': customer.email,
                'Phone': customer.phone,
                'Store': customer.storeName,
                'Total Orders': customer.totalOrders,
                'Total Sales': formatCurrency(parseFloat(customer.totalSales)),
                'Current Dues': formatCurrency(parseFloat(customer.totalDues)),
                'Customer Since': formatDate(customer.createdAt),
            }));
    };

    const generateDeliveryReport = async () => {
        const storeParam = filters.storeId ? `?storeId=${filters.storeId}` : '';
        const response = await api.get(`/analytics/delivery-performance${storeParam}`);

        return response.data.deliveryPerformance.map((partner: any) => ({
            'Delivery Partner': partner.name,
            'Total Deliveries': partner.totalDeliveries,
            'Average Time (min)': partner.averageDeliveryTime,
            'Performance': partner.averageDeliveryTime < 30 ? 'Excellent' :
                partner.averageDeliveryTime < 45 ? 'Good' : 'Needs Improvement',
        }));
    };

    const generateItemsReport = async () => {
        const storeParam = filters.storeId ? `&storeId=${filters.storeId}` : '';
        const response = await api.get(`/orders?startDate=${filters.startDate}&endDate=${filters.endDate}${storeParam}&limit=1000`);

        // Aggregate items from all orders
        const itemsMap = new Map();

        response.data.orders.forEach((order: any) => {
            if (order.items) {
                order.items.forEach((item: any) => {
                    const current = itemsMap.get(item.description) || { quantity: 0, orders: 0 };
                    itemsMap.set(item.description, {
                        quantity: current.quantity + item.quantity,
                        orders: current.orders + 1,
                    });
                });
            }
        });

        return Array.from(itemsMap.entries())
            .sort((a, b) => b[1].orders - a[1].orders)
            .slice(0, 50)
            .map(([name, data]) => ({
                'Item Name': name,
                'Total Quantity Ordered': data.quantity,
                'Number of Orders': data.orders,
                'Average Quantity per Order': (data.quantity / data.orders).toFixed(1),
            }));
    };

    const generatePaymentReport = async () => {
        const storeParam = filters.storeId ? `?storeId=${filters.storeId}` : '';
        const response = await api.get(`/analytics/payment-methods${storeParam}`);

        return response.data.paymentBreakdown.map((method: any) => ({
            'Payment Method': method.paymentMethod,
            'Number of Transactions': method.count,
            'Total Amount': formatCurrency(method.totalAmount),
            'Percentage': `${method.percentage}%`,
        }));
    };

    const generateStoreComparisonReport = async () => {
        if (user?.role !== 'ADMIN') {
            return [];
        }

        const response = await api.get('/stores');
        const storesData = response.data.stores;

        return storesData.map((store: any) => ({
            'Store Name': store.name,
            'Total Orders': store.totalOrders || 0,
            'Total Sales': formatCurrency(store.totalSales || 0),
            'Managers': store.managersCount || 0,
            'Delivery Boys': store.deliveryBoysCount || 0,
            'Status': store.isActive ? 'Active' : 'Inactive',
        }));
    };

    const handleExportExcel = () => {
        const filename = `${reportType}_report_${filters.startDate}_to_${filters.endDate}`;
        exportToExcel(reportData, filename, reportType.toUpperCase());
    };

    const handleExportCSV = () => {
        const filename = `${reportType}_report_${filters.startDate}_to_${filters.endDate}`;
        exportToCSV(reportData, filename);
    };

    const reportTypes = [
        { value: 'sales', label: 'Sales Report', icon: DollarSign },
        { value: 'customers', label: 'Customer Analysis', icon: Users },
        { value: 'delivery', label: 'Delivery Performance', icon: Package },
        { value: 'items', label: 'Top Items Report', icon: FileText },
        { value: 'payment', label: 'Payment Methods', icon: TrendingUp },
        ...(user?.role === 'ADMIN' ? [{ value: 'store-comparison', label: 'Store Comparison', icon: TrendingUp }] : []),
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Advanced Reports</h1>
                <p className="text-gray-600 mt-1">Generate detailed reports and export data</p>
            </div>

            {/* Report Type Selection */}
            <div className="card">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Select Report Type</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {reportTypes.map((type) => {
                        const Icon = type.icon;
                        return (
                            <button
                                key={type.value}
                                onClick={() => setReportType(type.value)}
                                className={`p-4 rounded-lg border-2 transition-all ${reportType === type.value
                                    ? 'border-primary-600 bg-primary-50'
                                    : 'border-gray-200 hover:border-primary-300'
                                    }`}
                            >
                                <Icon className={`mx-auto mb-2 ${reportType === type.value ? 'text-primary-600' : 'text-gray-400'}`} size={24} />
                                <p className={`text-sm font-medium text-center ${reportType === type.value ? 'text-primary-600' : 'text-gray-600'}`}>
                                    {type.label}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                    <Button onClick={generateReport} size="sm">
                        <Filter size={16} className="mr-2" />
                        Apply Filters
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                        label="Start Date"
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    />
                    <Input
                        label="End Date"
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    />
                    {user?.role === 'ADMIN' && (
                        <div>
                            <label className="label">Store</label>
                            <select
                                value={filters.storeId}
                                onChange={(e) => setFilters({ ...filters, storeId: e.target.value })}
                                className="input"
                            >
                                <option value="">All Stores</option>
                                {stores.map((store) => (
                                    <option key={store.id} value={store.id}>
                                        {store.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Report Data */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">
                        {reportTypes.find(t => t.value === reportType)?.label || 'Report'} Results
                    </h2>
                    {reportData.length > 0 && (
                        <div className="flex space-x-2">
                            <Button onClick={handleExportCSV} variant="secondary" size="sm">
                                <Download size={16} className="mr-2" />
                                Export CSV
                            </Button>
                            <Button onClick={handleExportExcel} size="sm">
                                <Download size={16} className="mr-2" />
                                Export Excel
                            </Button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : reportData.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {Object.keys(reportData[0]).map((header) => (
                                        <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reportData.map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        {Object.values(row).map((value: any, cellIndex) => (
                                            <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {value}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-600">No data available for selected criteria</p>
                    </div>
                )}
            </div>
        </div>
    );
}
