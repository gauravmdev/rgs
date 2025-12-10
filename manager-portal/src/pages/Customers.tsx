import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Plus, Eye, DollarSign, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, formatDateTime } from '../lib/utils';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Customers() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        apartment: '',
    });

    useEffect(() => {
        fetchCustomers();
    }, [searchTerm]);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            // IMPORTANT: Only fetch customers from manager's store
            const params = new URLSearchParams({
                storeId: user?.storeId?.toString() || '',
                ...(searchTerm && { search: searchTerm }),
            });

            const response = await api.get(`/customers?${params}`);
            setCustomers(response.data.customers);
        } catch (error) {
            console.error('Failed to fetch customers:', error);
            toast.error('Failed to load customers');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCustomer = async (e: React.FormEvent) => {
        e.preventDefault();

        setSubmitting(true);
        try {
            if (editingId) {
                // Update existing customer
                await api.put(`/customers/${editingId}`, {
                    name: formData.name,
                    phone: formData.phone,
                    address: formData.address,
                    apartment: formData.apartment,
                });
                toast.success('Customer updated successfully!');
            } else {
                // Create new customer
                await api.post('/customers', {
                    ...formData,
                    storeId: user?.storeId, // IMPORTANT: Always assign to manager's store
                });
                toast.success('Customer created successfully!');
            }

            setIsCreateModalOpen(false);
            resetForm();
            fetchCustomers();
        } catch (error: any) {
            console.error('Failed to save customer:', error);
            toast.error(error.response?.data?.error || 'Failed to save customer');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditClick = (customer: any) => {
        setFormData({
            name: customer.name,
            phone: customer.phone,
            email: customer.email || '',
            address: customer.address || '',
            apartment: customer.apartment || '',
        });
        setEditingId(customer.id);
        setIsCreateModalOpen(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            phone: '',
            email: '',
            address: '',
            apartment: '',
        });
        setEditingId(null);
    };

    const filteredCustomers = customers.filter((customer) =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm) ||
        customer.apartment?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
                    <p className="text-gray-600 mt-1">Manage customers for {user?.storeName}</p>
                </div>
                <Button onClick={() => {
                    resetForm();
                    setIsCreateModalOpen(true);
                }}>
                    <Plus size={20} className="mr-2" />
                    Add Customer
                </Button>
            </div>

            {/* Search */}
            <div className="card">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name, phone, or apartment..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input pl-10"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Customers</p>
                            <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
                        </div>
                        <Users className="text-primary-600" size={32} />
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">With Orders</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {customers.filter(c => c.totalOrders > 0).length}
                            </p>
                        </div>
                        <Eye className="text-blue-600" size={32} />
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-red-600">Total Dues</p>
                            <p className="text-2xl font-bold text-red-900">
                                {formatCurrency(
                                    customers.reduce((sum, c) => sum + parseFloat(c.totalDues || '0'), 0)
                                )}
                            </p>
                        </div>
                        <DollarSign className="text-red-600" size={32} />
                    </div>
                </div>
            </div>

            {/* Customers Table */}
            <div className="card">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="text-center py-12">
                        <Users size={64} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-600">No customers found</p>
                        <Button onClick={() => setIsCreateModalOpen(true)} className="mt-4">
                            Add Your First Customer
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dues</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Users size={16} className="text-gray-400 mr-2" />
                                                <span className="text-sm font-medium text-gray-900">{customer.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            <div>{customer.phone}</div>
                                            {customer.email && <div className="text-xs text-gray-500">{customer.email}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            <div>{customer.address}</div>
                                            {customer.apartment && (
                                                <div className="text-xs text-gray-500">Apt: {customer.apartment}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {customer.totalOrders || 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {formatCurrency(parseFloat(customer.totalSales || '0'))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {parseFloat(customer.totalDues || '0') > 0 ? (
                                                <span className="text-red-600 font-medium">
                                                    {formatCurrency(parseFloat(customer.totalDues))}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {formatDateTime(customer.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                            <button
                                                onClick={() => handleEditClick(customer)}
                                                className="inline-flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                                            >
                                                <Pencil size={16} className="mr-1" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => navigate(`/customers/${customer.id}`)}
                                                className="inline-flex items-center px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                                            >
                                                <Eye size={16} className="mr-1" />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Customer Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    resetForm();
                }}
                title={editingId ? "Edit Customer" : "Add New Customer"}
            >
                <form onSubmit={handleSaveCustomer} className="space-y-4">
                    <Input
                        label="Customer Name *"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                    <Input
                        label="Phone Number *"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={!!editingId}
                        placeholder={editingId ? "Email cannot be changed" : ""}
                    />
                    <Input
                        label="Address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        required
                    />
                    <Input
                        label="Apartment/Building"
                        value={formData.apartment}
                        onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                        placeholder="Apt 5B, Tower A"
                    />

                    {!editingId && (
                        <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                            Customer will be added to <strong>{user?.storeName}</strong>
                        </div>
                    )}

                    <div className="flex gap-2 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setIsCreateModalOpen(false);
                                resetForm();
                            }}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button type="submit" loading={submitting} className="flex-1">
                            {editingId ? "Update Customer" : "Create Customer"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
