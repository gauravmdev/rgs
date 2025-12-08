import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Phone, MapPin,
    Navigation, CheckCircle, Truck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '../lib/utils';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Button from '../components/ui/Button';
import type { Order } from '../types';

export default function OrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');

    useEffect(() => {
        fetchOrderDetails();
    }, [id]);

    const fetchOrderDetails = async () => {
        try {
            const response = await api.get(`/orders/${id}`);
            setOrder(response.data.order);
        } catch (error) {
            console.error('Failed to fetch order:', error);
            toast.error('Failed to load order details');
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const handleCallCustomer = () => {
        if (order?.customer?.phone) {
            window.location.href = `tel:${order.customer.phone}`;
        } else {
            toast.error('Customer phone number not available');
        }
    };

    const handleNavigate = () => {
        if (order?.customer?.address) {
            const address = encodeURIComponent(order.customer.address);
            window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
        } else {
            toast.error('Customer address not available');
        }
    };

    const handleStartDelivery = async () => {
        if (!window.confirm('Are you ready to start delivery?')) return;

        setActionLoading(true);
        try {
            await api.put(`/orders/${id}/out-for-delivery`);
            toast.success('Order marked Out For Delivery');
            fetchOrderDetails();
        } catch (error: any) {
            console.error('Failed to start delivery:', error);
            toast.error(error.response?.data?.error || 'Failed to update status');
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkDelivered = async () => {
        setActionLoading(true);
        try {
            await api.put(`/orders/${id}/deliver`, {
                paymentMethod: paymentMethod,
                paymentStatus: 'PAID'
            });
            toast.success('Order delivered successfully!');
            setShowPaymentModal(false);
            navigate('/');
        } catch (error: any) {
            console.error('Failed to complete delivery:', error);
            toast.error(error.response?.data?.error || 'Failed to complete delivery');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <LoadingSpinner />;
    if (!order) return <div className="p-4 text-center">Order not found</div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="flex items-center p-4">
                    <button onClick={() => navigate('/')} className="mr-4 p-2 hover:bg-gray-100 rounded-full">
                        <ArrowLeft size={24} className="text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Order #{order.orderNumber}</h1>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                        </span>
                    </div>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* Customer Details Card */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Customer Details</h2>
                    <div className="flex items-start mb-4">
                        <div className="bg-blue-50 p-3 rounded-full mr-3">
                            <MapPin className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-lg">{order.customerName}</p>
                            <p className="text-gray-600 mt-1">{order.customer?.address || 'No address provided'}</p>
                            {order.customer?.apartment && (
                                <p className="text-gray-500 text-sm mt-1">Apt/Suite: {order.customer.apartment}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <Button
                            variant="secondary"
                            className="flex items-center justify-center py-3"
                            onClick={handleCallCustomer}
                        >
                            <Phone size={18} className="mr-2" />
                            Call
                        </Button>
                        <Button
                            variant="primary"
                            className="flex items-center justify-center py-3"
                            onClick={handleNavigate}
                        >
                            <Navigation size={18} className="mr-2" />
                            Navigate
                        </Button>
                    </div>
                </div>

                {/* Order Items */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Order Items</h2>
                    <div className="divide-y divide-gray-100">
                        {order.items?.map((item) => (
                            <div key={item.id} className="py-3 flex justify-between items-center">
                                <div className="flex items-center">
                                    <div className="bg-gray-100 w-8 h-8 rounded flex items-center justify-center mr-3 text-sm font-bold text-gray-600">
                                        {item.quantity}x
                                    </div>
                                    <span className="text-gray-800 font-medium">{item.description}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between items-center text-lg font-bold">
                        <span>Total Amount</span>
                        <span>{formatCurrency(order.invoiceAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 text-sm">
                        <span className="text-gray-600">Payment Status</span>
                        <span className={`font-bold ${order.paymentStatus === 'PAID' ? 'text-green-600' : 'text-orange-600'}`}>
                            {order.paymentStatus}
                        </span>
                    </div>
                </div>

                {/* Order Info */}
                <div className="bg-white rounded-xl shadow-sm p-4 text-sm text-gray-600 space-y-2">
                    <div className="flex justify-between">
                        <span>Order Date</span>
                        <span>{formatDateTime(order.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Payment Method</span>
                        <span>{order.paymentMethod || 'Not specified'}</span>
                    </div>
                    {order.notes && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                            <span className="block font-medium mb-1">Notes:</span>
                            <p className="bg-yellow-50 p-2 rounded text-yellow-800">{order.notes}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                {order.status === 'ASSIGNED' && (
                    <Button
                        fullWidth
                        size="lg"
                        onClick={handleStartDelivery}
                        loading={actionLoading}
                        className="flex items-center justify-center"
                    >
                        <Truck className="mr-2" />
                        Start Delivery
                    </Button>
                )}

                {order.status === 'OUT_FOR_DELIVERY' && (
                    <Button
                        fullWidth
                        size="lg"
                        variant="success"
                        onClick={() => setShowPaymentModal(true)}
                        loading={actionLoading}
                        className="flex items-center justify-center"
                    >
                        <CheckCircle className="mr-2" />
                        Mark Delivered
                    </Button>
                )}

                {order.status === 'DELIVERED' && (
                    <div className="text-center text-green-600 font-bold flex items-center justify-center py-2">
                        <CheckCircle className="mr-2" /> Order Completed
                    </div>
                )}
            </div>

            {/* Payment Confirmation Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl w-full max-w-sm p-6">
                        <h3 className="text-xl font-bold mb-4">Complete Delivery</h3>

                        {order.paymentStatus !== 'PAID' && (
                            <div className="mb-6">
                                <p className="text-sm text-gray-600 mb-2">Collect Payment:</p>
                                <div className="text-3xl font-bold text-center text-primary-600 mb-4">
                                    {formatCurrency(order.invoiceAmount)}
                                </div>

                                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Collected By</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['CASH', 'UPI', 'CARD'].map((method) => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method as any)}
                                            className={`py-2 rounded-lg text-sm font-medium border ${paymentMethod === method
                                                    ? 'bg-primary-50 border-primary-600 text-primary-700'
                                                    : 'border-gray-300 text-gray-700'
                                                }`}
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {order.paymentStatus === 'PAID' && (
                            <div className="mb-6 bg-green-50 p-4 rounded-lg flex items-center text-green-800">
                                <CheckCircle className="mr-2" size={20} />
                                <span>Payment already received</span>
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <Button
                                variant="secondary"
                                fullWidth
                                onClick={() => setShowPaymentModal(false)}
                                disabled={actionLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="success"
                                fullWidth
                                onClick={handleMarkDelivered}
                                loading={actionLoading}
                            >
                                Confirm
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
