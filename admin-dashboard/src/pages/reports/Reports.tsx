import { useState } from 'react';
import { FileText, Download, Calendar, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import Button from '../../components/ui/Button';

interface ReportCard {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    supportsPDF: boolean;
    supportsExcel: boolean;
    endpoint: string;
}

export default function Reports() {
    const [loading, setLoading] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedStore, setSelectedStore] = useState('');

    const reports: ReportCard[] = [
        {
            id: 'sales',
            title: 'Sales Report',
            description: 'Revenue trends, sales breakdown by date and store',
            icon: <FileText size={32} className="text-green-600" />,
            supportsPDF: true,
            supportsExcel: true,
            endpoint: '/reports/sales'
        },
        {
            id: 'orders',
            title: 'Orders Report',
            description: 'Detailed order listing with filters by status, date, and store',
            icon: <FileText size={32} className="text-blue-600" />,
            supportsPDF: true,
            supportsExcel: true,
            endpoint: '/reports/orders'
        },
        {
            id: 'customers',
            title: 'Customers Report',
            description: 'Customer list with total orders, sales volume, and outstanding dues',
            icon: <FileText size={32} className="text-purple-600" />,
            supportsPDF: true,
            supportsExcel: true,
            endpoint: '/reports/customers'
        },
        {
            id: 'delivery',
            title: 'Delivery Performance',
            description: 'Delivery boy metrics, average delivery times, and on-time percentage',
            icon: <FileText size={32} className="text-yellow-600" />,
            supportsPDF: true,
            supportsExcel: false,
            endpoint: '/reports/delivery-performance'
        },
        {
            id: 'payments',
            title: 'Payment & Dues Report',
            description: 'Outstanding dues by customer and payment history',
            icon: <FileText size={32} className="text-red-600" />,
            supportsPDF: false,
            supportsExcel: true,
            endpoint: '/reports/payments'
        }
    ];

    const handleDownloadReport = async (report: ReportCard, format: 'pdf' | 'excel') => {
        const loadingKey = `${report.id}-${format}`;
        setLoading(loadingKey);

        try {
            // Build query parameters
            const params = new URLSearchParams();
            params.append('format', format);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (selectedStore) params.append('storeId', selectedStore);

            // Make API request
            const response = await api.get(`${report.endpoint}?${params.toString()}`, {
                responseType: 'blob'
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers['content-disposition'];
            let filename = `${report.id}_report_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
                if (filenameMatch) filename = filenameMatch[1];
            }

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success(`${report.title} downloaded successfully!`);
        } catch (error: any) {
            console.error('Download report error:', error);
            toast.error(error.response?.data?.error || 'Failed to download report');
        } finally {
            setLoading(null);
        }
    };

    const resetFilters = () => {
        setStartDate('');
        setEndDate('');
        setSelectedStore('');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
                <p className="text-gray-600 mt-1">Generate and download business reports</p>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="flex items-center mb-4">
                    <Filter className="mr-2 text-gray-600" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="label">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="input"
                        />
                    </div>
                    <div>
                        <label className="label">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="input"
                            min={startDate}
                        />
                    </div>
                    <div>
                        <label className="label">Store (Optional)</label>
                        <input
                            type="text"
                            value={selectedStore}
                            onChange={(e) => setSelectedStore(e.target.value)}
                            placeholder="Store ID"
                            className="input"
                        />
                    </div>
                </div>
                <div className="mt-4">
                    <Button variant="secondary" size="sm" onClick={resetFilters}>
                        Reset Filters
                    </Button>
                </div>
            </div>

            {/* Report Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report) => (
                    <div key={report.id} className="card hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div>{report.icon}</div>
                            <Calendar className="text-gray-400" size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{report.title}</h3>
                        <p className="text-sm text-gray-600 mb-4 h-12">{report.description}</p>

                        <div className="flex gap-2">
                            {report.supportsPDF && (
                                <Button
                                    className="flex-1"
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleDownloadReport(report, 'pdf')}
                                    loading={loading === `${report.id}-pdf`}
                                    disabled={loading !== null && loading !== `${report.id}-pdf`}
                                >
                                    <Download size={16} className="mr-1" />
                                    PDF
                                </Button>
                            )}
                            {report.supportsExcel && (
                                <Button
                                    className="flex-1"
                                    variant="success"
                                    size="sm"
                                    onClick={() => handleDownloadReport(report, 'excel')}
                                    loading={loading === `${report.id}-excel`}
                                    disabled={loading !== null && loading !== `${report.id}-excel`}
                                >
                                    <Download size={16} className="mr-1" />
                                    Excel
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                    <FileText className="text-blue-600 mr-3 mt-0.5" size={20} />
                    <div>
                        <h4 className="font-semibold text-blue-900 mb-1">Report Information</h4>
                        <p className="text-sm text-blue-800">
                            • Use the date filters to generate reports for specific periods<br />
                            • PDF reports are optimized for printing and sharing<br />
                            • Excel reports allow for further data analysis and manipulation<br />
                            • Large datasets may take a few moments to generate
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
