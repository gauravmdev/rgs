import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, User, Store, Calendar, Truck, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime, getStatusColor } from '../lib/utils';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';

export default function OrderDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrderDetails();
    }, [id]);

    const fetchOrderDetails = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/orders/${id}`);
            setOrder(response.data.order);
            setItems(response.data.order.items || []);
        } catch (error) {
            console.error('Failed to fetch order details:', error);
            toast.error('Failed to load order details');
            navigate('/orders');
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

    if (!order) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">Order not found</p>
            </div>
        );
    }

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
                        <h1 className="text-3xl font-bold text-gray-900">{order.orderNumber}</h1>
                        <p className="text-gray-600 mt-1">Order Details</p>
                    </div>
                </div>
                <span className={`px-4 py-2 text-sm font-medium rounded-full ${getStatusColor(order.status)}`}>
                    {order.status.replace('_', ' ')}
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Order Information */}
                    <div className="card">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Order Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-start space-x-3">
                                <Package className="text-primary-600 mt-1" size={20} />
                                <div>
                                    <p className="text-sm text-gray-600">Order Number</p>
                                    <p className="text-gray-900 font-medium">{order.orderNumber}</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <User className="text-primary-600 mt-1" size={20} />
                                <div>
                                    <p className="text-sm text-gray-600">Customer</p>
                                    <p className="text-gray-900 font-medium">{order.customerName}</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <Store className="text-primary-600 mt-1" size={20} />
                                <div>
                                    <p className="text-sm text-gray-600">Store</p>
                                    <p className="text-gray-900 font-medium">{order.storeName}</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <Calendar className="text-primary-600 mt-1" size={20} />
                                <div>
                                    <p className="text-sm text-gray-600">Order Date</p>
                                    <p className="text-gray-900 font-medium">{formatDateTime(order.createdAt)}</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <Package className="text-primary-600 mt-1" size={20} />
                                <div>
                                    <p className="text-sm text-gray-600">Source</p>
                                    <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                        {order.source}
                                    </span>
                                </div>
                            </div>

                            {order.invoiceNumber && (
                                <div className="flex items-start space-x-3">
                                    <Package className="text-primary-600 mt-1" size={20} />
                                    <div>
                                        <p className="text-sm text-gray-600">Invoice Number</p>
                                        <p className="text-gray-900 font-medium">{order.invoiceNumber}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {order.notes && (
                            <div className="mt-4 pt-4 border-t">
                                <p className="text-sm text-gray-600 mb-1">Notes</p>
                                <p className="text-gray-900">{order.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Order Items */}
                    <div className="card">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Order Items ({order.totalItems})</h2>
                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-medium">
                                            {index + 1}
                                        </div>
                                        <p className="text-gray-900">{item.description}</p>
                                    </div>
                                    <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Delivery Information */}
                    {order.deliveryPartnerId && (
                        <div className="card">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Delivery Information</h2>
                            <div className="space-y-4">
                                {order.deliveryPartnerName && (
                                    <div className="flex items-start space-x-3">
                                        <Truck className="text-green-600 mt-1" size={20} />
                                        <div>
                                            <p className="text-sm text-gray-600">Delivery Partner</p>
                                            <p className="text-gray-900 font-medium">{order.deliveryPartnerName}</p>
                                        </div>
                                    </div>
                                )}

                                {order.assignedAt && (
                                    <div className="flex items-start space-x-3">
                                        <Clock className="text-blue-600 mt-1" size={20} />
                                        <div>
                                            <p className="text-sm text-gray-600">Assigned At</p>
                                            <p className="text-gray-900 font-medium">{formatDateTime(order.assignedAt)}</p>
                                        </div>
                                    </div>
                                )}

                                {order.outForDeliveryAt && (
                                    <div className="flex items-start space-x-3">
                                        <Truck className="text-yellow-600 mt-1" size={20} />
                                        <div>
                                            <p className="text-sm text-gray-600">Out for Delivery At</p>
                                            <p className="text-gray-900 font-medium">{formatDateTime(order.outForDeliveryAt)}</p>
                                        </div>
                                    </div>
                                )}

                                {order.deliveredAt && (
                                    <div className="flex items-start space-x-3">
                                        <Package className="text-green-600 mt-1" size={20} />
                                        <div>
                                            <p className="text-sm text-gray-600">Delivered At</p>
                                            <p className="text-gray-900 font-medium">{formatDateTime(order.deliveredAt)}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Return Information */}
                    {order.returns && order.returns.length > 0 && (
                        <div className="card">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Return Information</h2>
                            <div className="space-y-4">
                                {order.returns.map((ret: any) => (
                                    <div key={ret.id} className="bg-red-50 p-4 rounded-lg border border-red-100">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm text-gray-600">Return Type</p>
                                                <span className="font-medium text-gray-900">{ret.returnType}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">Refund Amount</p>
                                                <span className="font-bold text-red-600">{formatCurrency(ret.refundAmount)}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">Refund Method</p>
                                                <span className="font-medium text-gray-900">{ret.refundMethod}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">Processed At</p>
                                                <span className="font-medium text-gray-900">{formatDateTime(ret.processedAt)}</span>
                                            </div>
                                        </div>
                                        {ret.reason && (
                                            <div className="mt-3 pt-3 border-t border-red-200">
                                                <p className="text-sm text-gray-600 mb-1">Reason</p>
                                                <p className="text-gray-900">{ret.reason}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Payment Summary */}
                    <div className="card">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Summary</h2>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between pb-3 border-b">
                                <span className="text-gray-600">Invoice Amount</span>
                                <span className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(order.invoiceAmount)}
                                </span>
                            </div>

                            {order.returns && order.returns.length > 0 && (
                                <div className="flex items-center justify-between pb-3 border-b">
                                    <span className="text-gray-600">Refunded Amount</span>
                                    <span className="text-lg font-bold text-red-600">
                                        {formatCurrency(order.returns.reduce((sum: number, ret: any) => sum + Number(ret.refundAmount), 0))}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Payment Method</span>
                                {order.paymentMethod ? (
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${order.paymentMethod === 'CUSTOMER_CREDIT'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-green-100 text-green-800'
                                        }`}>
                                        {order.paymentMethod}
                                    </span>
                                ) : (
                                    <span className="text-gray-400">Not paid yet</span>
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Payment Status</span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${order.paymentStatus === 'PAID'
                                    ? 'bg-green-100 text-green-800'
                                    : order.paymentStatus === 'REFUNDED'
                                        ? 'bg-purple-100 text-purple-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                    {order.paymentStatus}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Order Timeline */}
                    <div className="card">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Order Timeline</h2>
                        <div className="space-y-4">
                            <div className="flex items-start space-x-3">
                                <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                                    ✓
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">Order Created</p>
                                    <p className="text-sm text-gray-500">{formatDateTime(order.createdAt)}</p>
                                </div>
                            </div>

                            {order.assignedAt && (
                                <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                        ✓
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">Assigned to Delivery</p>
                                        <p className="text-sm text-gray-500">{formatDateTime(order.assignedAt)}</p>
                                    </div>
                                </div>
                            )}

                            {order.outForDeliveryAt && (
                                <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center flex-shrink-0">
                                        ✓
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">Out for Delivery</p>
                                        <p className="text-sm text-gray-500">{formatDateTime(order.outForDeliveryAt)}</p>
                                    </div>
                                </div>
                            )}

                            {order.deliveredAt && (
                                <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                                        ✓
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">Delivered</p>
                                        <p className="text-sm text-gray-500">{formatDateTime(order.deliveredAt)}</p>
                                    </div>
                                </div>
                            )}

                            {order.status === 'CANCELLED' && (
                                <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                                        ✕
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">Cancelled</p>
                                        <p className="text-sm text-gray-500">{formatDateTime(order.updatedAt)}</p>
                                    </div>
                                </div>
                            )}

                            {(order.status === 'PARTIAL_RETURNED' || order.status === 'RETURNED') && order.returns && order.returns.length > 0 && (
                                <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                                        ↩
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">{order.status === 'PARTIAL_RETURNED' ? 'PARTIAL RETURNED' : 'RETURNED'}</p>
                                        <p className="text-sm text-gray-500">{formatDateTime(order.returns[order.returns.length - 1].processedAt)}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="card">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
                        <div className="space-y-2">
                            <Button
                                className="w-full"
                                variant="secondary"
                                onClick={() => navigate('/orders')}
                            >
                                Back to Orders
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
