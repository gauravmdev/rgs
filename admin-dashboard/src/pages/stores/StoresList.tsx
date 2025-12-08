import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Edit, Trash2, MapPin, Phone, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import type { Store } from '../../types';

export default function StoresList() {
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<Store | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchStores();
    }, []);

    const fetchStores = async () => {
        try {
            setLoading(true);
            const response = await api.get('/stores');
            setStores(response.data.stores);
        } catch (error) {
            console.error('Failed to fetch stores:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (store?: Store) => {
        if (store) {
            setEditingStore(store);
            setFormData({
                name: store.name,
                address: store.address,
                phone: store.phone,
            });
        } else {
            setEditingStore(null);
            setFormData({ name: '', address: '', phone: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingStore(null);
        setFormData({ name: '', address: '', phone: '' });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrors({});

        try {
            if (editingStore) {
                await api.put(`/stores/${editingStore.id}`, formData);
                toast.success('Store updated successfully!');
            } else {
                await api.post('/stores', formData);
                toast.success('Store created successfully!');
            }
            handleCloseModal();
            fetchStores();
        } catch (error: any) {
            console.error('Failed to save store:', error);

            // Handle validation errors
            if (error.response?.data?.details) {
                const validationErrors: Record<string, string> = {};
                error.response.data.details.forEach((detail: any) => {
                    validationErrors[detail.field] = detail.message;
                });
                setErrors(validationErrors);
                toast.error('Please fix the validation errors');
            } else if (error.response?.data?.error) {
                toast.error(error.response.data.error);
            } else {
                toast.error('Failed to save store');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this store?')) return;

        try {
            await api.delete(`/stores/${id}`);
            toast.success('Store deleted successfully!');
            fetchStores();
        } catch (error: any) {
            console.error('Failed to delete store:', error);
            if (error.response?.data?.activeOrdersCount) {
                toast.error(`Cannot delete store with ${error.response.data.activeOrdersCount} active orders`);
            }
        }
    };

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
                    <h1 className="text-3xl font-bold text-gray-900">Stores</h1>
                    <p className="text-gray-600 mt-1">Manage your store locations</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={20} className="mr-2" />
                    Add Store
                </Button>
            </div>

            {/* Stores Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stores.map((store) => (
                    <div key={store.id} className="card hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{store.name}</h3>
                                <span
                                    className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${store.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}
                                >
                                    {store.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => handleOpenModal(store)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Edit size={18} />
                                </button>
                                <button
                                    onClick={() => handleDelete(store.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-start text-sm text-gray-600">
                                <MapPin size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                                <span>{store.address}</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <Phone size={16} className="mr-2 flex-shrink-0" />
                                <span>{store.phone}</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-600">Managers</p>
                                    <p className="font-semibold text-gray-900">{store.managersCount || 0}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Delivery Boys</p>
                                    <p className="font-semibold text-gray-900">{store.deliveryBoysCount || 0}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Total Orders</p>
                                    <p className="font-semibold text-gray-900">{store.totalOrders || 0}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Total Sales</p>
                                    <p className="font-semibold text-gray-900">
                                        {formatCurrency(store.totalSales || 0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {stores.length === 0 && (
                <div className="text-center py-12">
                    <Users size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No stores found. Create your first store!</p>
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingStore ? 'Edit Store' : 'Create Store'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Store Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Downtown Store"
                        minLength={2}
                        error={errors.name}
                        required
                    />

                    <Input
                        label="Address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="123 Main St, City"
                        minLength={5}
                        error={errors.address}
                        required
                    />

                    <Input
                        label="Phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+919999999999"
                        minLength={10}
                        error={errors.phone}
                        required
                    />

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={submitting}>
                            {editingStore ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
