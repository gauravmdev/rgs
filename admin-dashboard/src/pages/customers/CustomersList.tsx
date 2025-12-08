import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Search, Eye, DollarSign, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import type { Customer, Store } from '../../types';

export default function CustomersList() {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStore, setFilterStore] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        storeId: '',
        apartment: '',
        address: '',
    });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchStores();
        fetchCustomers();
    }, [filterStore]);

    const fetchStores = async () => {
        try {
            const response = await api.get('/stores');
            setStores(response.data.stores);
        } catch (error) {
            console.error('Failed to fetch stores:', error);
        }
    };

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            let url = '/customers?limit=100';
            if (filterStore) url += `&storeId=${filterStore}`;

            const response = await api.get(url);
            setCustomers(response.data.customers);
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = () => {
        setFormData({
            name: '',
            email: '',
            password: '',
            phone: '',
            storeId: '',
            apartment: '',
            address: '',
        });
        setEditingId(null);
        setErrors({});
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFormData({
            name: '',
            email: '',
            password: '',
            phone: '',
            storeId: '',
            apartment: '',
            address: '',
        });
        setEditingId(null);
        setErrors({});
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrors({});

        try {
            const payload: any = {
                name: formData.name,
                phone: formData.phone,
                storeId: parseInt(formData.storeId),
                apartment: formData.apartment,
                address: formData.address,
            };

            // Only send email/password if creating or if provided during edit
            if (!editingId) {
                payload.email = formData.email;
                payload.password = formData.password;
            } else {
                if (formData.name) payload.name = formData.name;
                // Don't send email involved in simple edit to avoid unique constraint if not changed, 
                // but actually API might ignore or check. 
                // Let's rely on API. The PUT endpoint updates user based on name/phone.
            }

            if (editingId) {
                await api.put(`/customers/${editingId}`, payload);
                toast.success('Customer updated successfully!');
            } else {
                await api.post('/customers', payload);
                toast.success('Customer created successfully!');
            }

            handleCloseModal();
            fetchCustomers();
        } catch (error: any) {
            console.error('Failed to save customer:', error);
            if (error.response?.data?.details) {
                const validationErrors: Record<string, string> = {};
                error.response.data.details.forEach((detail: any) => {
                    validationErrors[detail.field] = detail.message;
                });
                setErrors(validationErrors);
                toast.error('Please fix the validation errors');
            } else {
                toast.error(error.response?.data?.error || 'Failed to save customer');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditCustomer = (customer: Customer) => {
        setFormData({
            name: customer.name,
            email: customer.email, // Read only in UI usually for customers to not break login? Or allowed.
            password: '', // Leave blank to keep unchanged
            phone: customer.phone,
            storeId: customer.storeId.toString(),
            apartment: customer.apartment || '',
            address: customer.address || '',
        });
        setEditingId(customer.id);
        setErrors({});
        setIsModalOpen(true);
    };

    const handleDeleteCustomer = async (id: number) => {
        if (!confirm('Are you sure you want to delete this customer? This action cannot be undone.')) return;

        try {
            await api.delete(`/customers/${id}`);
            toast.success('Customer deleted successfully');
            fetchCustomers();
        } catch (error: any) {
            console.error('Failed to delete customer:', error);
            toast.error(error.response?.data?.error || 'Failed to delete customer');
        }
    };

    const filteredCustomers = customers.filter((customer) => {
        const matchesSearch =
            customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.phone.includes(searchQuery);
        return matchesSearch;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
                    <p className="text-gray-600 mt-1">Manage customer accounts and track dues</p>
                </div>
                <Button onClick={handleOpenModal}>
                    <Plus size={20} className="mr-2" />
                    Add Customer
                </Button>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name, email, or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    <div>
                        <select
                            value={filterStore}
                            onChange={(e) => setFilterStore(e.target.value)}
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
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card">
                    <p className="text-sm text-gray-600">Total Customers</p>
                    <p className="text-2xl font-bold text-gray-900">{filteredCustomers.length}</p>
                </div>
                <div className="card">
                    <p className="text-sm text-gray-600">Total Sales</p>
                    <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(
                            filteredCustomers.reduce((sum, c) => sum + parseFloat(c.totalSales.toString()), 0)
                        )}
                    </p>
                </div>
                <div className="card">
                    <p className="text-sm text-gray-600">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900">
                        {filteredCustomers.reduce((sum, c) => sum + c.totalOrders, 0)}
                    </p>
                </div>
                <div className="card">
                    <p className="text-sm text-red-600">Total Dues</p>
                    <p className="text-2xl font-bold text-red-900">
                        {formatCurrency(
                            filteredCustomers.reduce((sum, c) => sum + parseFloat(c.totalDues.toString()), 0)
                        )}
                    </p>
                </div>
            </div>

            {/* Customers Table */}
            <div className="card">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Orders</th>
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
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                                            <div className="text-sm text-gray-500">{customer.email}</div>
                                            <div className="text-sm text-gray-500">{customer.phone}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {customer.storeName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {customer.totalOrders}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {formatCurrency(parseFloat(customer.totalSales.toString()))}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {parseFloat(customer.totalDues.toString()) > 0 ? (
                                            <span className="flex items-center text-red-600 font-medium">
                                                <DollarSign size={16} className="mr-1" />
                                                {formatCurrency(parseFloat(customer.totalDues.toString()))}
                                            </span>
                                        ) : (
                                            <span className="text-green-600">₹0</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDate(customer.createdAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => navigate(`/customers/${customer.id}`)}
                                            className="inline-flex items-center px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleEditCustomer(customer)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors ml-2"
                                            title="Edit Customer"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCustomer(customer.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors ml-2"
                                            title="Delete Customer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredCustomers.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-600">No customers found</p>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingId ? "Edit Customer" : "Add Customer"}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        error={errors.name}
                        required
                    />

                    <Input
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        error={errors.email}
                        required
                        disabled={!!editingId}
                        className={editingId ? "bg-gray-100" : ""}
                    />

                    <Input
                        label={editingId ? "Password (leave blank to keep unchanged)" : "Password"}
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        error={errors.password}
                        minLength={6}
                        required={!editingId}
                    />

                    <Input
                        label="Phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        error={errors.phone}
                        required
                    />

                    <div>
                        <label className="label">Assign to Store</label>
                        <select
                            value={formData.storeId}
                            onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                            required
                            disabled={!!editingId}
                            className={editingId ? "input bg-gray-100 text-gray-500" : "input"}
                        >
                            <option value="">Select Store</option>
                            {stores.map((store) => (
                                <option key={store.id} value={store.id}>
                                    {store.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Apartment"
                            value={formData.apartment}
                            onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                        />
                        <Input
                            label="Address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={submitting}>
                            {editingId ? 'Update Customer' : 'Create Customer'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
