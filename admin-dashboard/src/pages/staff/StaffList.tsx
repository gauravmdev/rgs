import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Edit, Trash2, Ban, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import type { User, Store } from '../../types';

export default function StaffList() {
    const [staff, setStaff] = useState<User[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<User | null>(null);
    const [filterRole, setFilterRole] = useState<string>('');
    const [filterStore, setFilterStore] = useState<string>('');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'STORE_MANAGER' as 'ADMIN' | 'STORE_MANAGER' | 'DELIVERY_BOY',
        storeId: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchStores();
        fetchStaff();
    }, [filterRole, filterStore]);

    const fetchStores = async () => {
        try {
            const response = await api.get('/stores');
            setStores(response.data.stores);
        } catch (error) {
            console.error('Failed to fetch stores:', error);
        }
    };

    const fetchStaff = async () => {
        try {
            setLoading(true);
            let url = '/staff?limit=100';
            if (filterRole) url += `&role=${filterRole}`;
            if (filterStore) url += `&storeId=${filterStore}`;

            const response = await api.get(url);
            setStaff(response.data.staff);
        } catch (error) {
            console.error('Failed to fetch staff:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (staffMember?: User) => {
        if (staffMember) {
            setEditingStaff(staffMember);
            setFormData({
                name: staffMember.name,
                email: staffMember.email,
                password: '',
                phone: staffMember.phone,
                role: staffMember.role as 'ADMIN' | 'STORE_MANAGER' | 'DELIVERY_BOY',
                storeId: staffMember.storeId?.toString() || '',
            });
        } else {
            setEditingStaff(null);
            setFormData({
                name: '',
                email: '',
                password: '',
                phone: '',
                role: 'STORE_MANAGER',
                storeId: '',
            });
        }
        setErrors({});
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingStaff(null);
        setFormData({
            name: '',
            email: '',
            password: '',
            phone: '',
            role: 'STORE_MANAGER',
            storeId: '',
        });
        setErrors({});
    };



    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrors({});

        const validationErrors: any = {};
        if (!formData.name.trim()) {
            validationErrors.name = 'Name is required';
        }

        if (!formData.email.trim()) {
            validationErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            validationErrors.email = 'Invalid email format';
        }

        if (!editingStaff && !formData.password) {
            validationErrors.password = 'Password is required';
        } else if (!editingStaff && formData.password.length < 6) {
            validationErrors.password = 'Password must be at least 6 characters';
        }

        if (!formData.phone.trim()) {
            validationErrors.phone = 'Phone is required';
        } else if (formData.phone.trim().length < 10) {
            validationErrors.phone = 'Phone must be at least 10 digits';
        }

        if (!formData.role) validationErrors.role = 'Role is required';

        if (formData.role !== 'ADMIN' && !formData.storeId) {
            validationErrors.storeId = 'Store is required for this role';
        }

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);



            setSubmitting(false);
            return;
        }

        try {
            if (editingStaff) {
                // Build payload matching backend expectations
                const payload: any = {
                    name: formData.name.trim(),
                    email: formData.email.trim().toLowerCase(),
                    phone: formData.phone.trim(),
                    role: formData.role,
                    isActive: true, // or existing isActive if we had it in form
                };

                // Only add storeId if not Admin, and convert to number
                if (formData.role !== 'ADMIN' && formData.storeId) {
                    payload.storeId = parseInt(formData.storeId, 10);
                } else {
                    payload.storeId = null;
                }

                console.log('Updating staff with payload:', payload);

                await api.put(`/staff/${editingStaff.id}`, payload);

                // Check if we changed the store for a manager
                const storeChanged = editingStaff.storeId !== payload.storeId &&
                    payload.role === 'STORE_MANAGER';

                toast.success('Staff member updated successfully!');

                if (storeChanged) {
                    toast(
                        'Store assignment changed! The manager must logout and login again to see their new store.',
                        {
                            duration: 8000,
                            icon: '⚠️',
                            style: {
                                background: '#fef3c7',
                                color: '#92400e',
                                fontWeight: 'bold',
                            },
                        }
                    );
                }
            } else {
                // Build payload matching backend expectations
                const payload: any = {
                    name: formData.name.trim(),
                    email: formData.email.trim().toLowerCase(),
                    phone: formData.phone.trim(),
                    password: formData.password,
                    role: formData.role,
                };

                // Only add storeId if not Admin, and convert to number
                if (formData.role !== 'ADMIN' && formData.storeId) {
                    payload.storeId = parseInt(formData.storeId, 10);
                }

                console.log('Creating staff with payload:', payload);

                await api.post('/staff', payload);
                toast.success('Staff created successfully!');
            }
            handleCloseModal();
            fetchStaff();
        } catch (error: any) {
            console.error('Failed to save staff:', error);
            console.error('Error response:', error.response?.data);

            if (error.response?.data?.details) {
                const validationErrors: Record<string, string> = {};
                error.response.data.details.forEach((detail: any) => {
                    validationErrors[detail.field] = detail.message;
                });
                setErrors(validationErrors);
                toast.error('Please fix the validation errors');
            } else {
                const errorMessage = error.response?.data?.error ||
                    error.response?.data?.message ||
                    'Failed to save staff';
                toast.error(errorMessage);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this staff member?')) return;

        try {
            await api.delete(`/staff/${id}`);
            toast.success('Staff deleted successfully!');
            fetchStaff();
        } catch (error: any) {
            console.error('Failed to delete staff:', error);
            if (error.response?.data?.pendingDeliveriesCount) {
                toast.error(`Cannot delete delivery boy with ${error.response.data.pendingDeliveriesCount} pending deliveries`);
            } else {
                toast.error('Failed to delete staff');
            }
        }
    };

    const handleToggleStatus = async (id: number, isActive: boolean) => {
        try {
            await api.patch(`/staff/${id}/status`, { isActive });
            toast.success(`Staff member ${isActive ? 'activated' : 'deactivated'} successfully`);
            fetchStaff();
        } catch (error: any) {
            console.error('Failed to update staff status:', error);
            toast.error('Failed to update staff status');
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
                    <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
                    <p className="text-gray-600 mt-1">Manage store managers and delivery personnel</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={20} className="mr-2" />
                    Add Staff
                </Button>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Filter by Role</label>
                        <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                            className="input"
                        >
                            <option value="">All Roles</option>
                            <option value="STORE_MANAGER">Store Manager</option>
                            <option value="DELIVERY_BOY">Delivery Boy</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">Filter by Store</label>
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

            {/* Staff Table */}
            <div className="card">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Phone
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Store
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {staff.map((staffMember) => (
                                <tr key={staffMember.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <span className="text-sm font-medium text-gray-900">{staffMember.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {staffMember.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {staffMember.phone}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${staffMember.role === 'ADMIN'
                                            ? 'bg-purple-100 text-purple-800'
                                            : staffMember.role === 'STORE_MANAGER'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-green-100 text-green-800'
                                            }`}>
                                            {staffMember.role === 'STORE_MANAGER' ? 'Manager' :
                                                staffMember.role === 'DELIVERY_BOY' ? 'Delivery Boy' : 'Admin'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {staffMember.role === 'ADMIN' ? (
                                            <span className="px-2 py-1 text-xs font-medium bg-purple-50 text-purple-700 rounded">
                                                All Stores
                                            </span>
                                        ) : staffMember.store?.name ? (
                                            <span className="font-medium text-gray-900">{staffMember.store.name}</span>
                                        ) : (
                                            <span className="text-gray-400">Not Assigned</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${staffMember.isActive
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {staffMember.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => handleToggleStatus(staffMember.id, !staffMember.isActive)}
                                                className={`${staffMember.isActive ? 'text-amber-600 hover:text-amber-900' : 'text-green-600 hover:text-green-900'}`}
                                                title={staffMember.isActive ? 'Deactivate' : 'Activate'}
                                            >
                                                {staffMember.isActive ? <Ban size={18} /> : <CheckCircle size={18} />}
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal(staffMember)}
                                                className="text-primary-600 hover:text-primary-900"
                                                title="Edit"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(staffMember.id)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                    {staff.map((staffMember) => (
                        <div key={staffMember.id} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <span className="font-bold text-gray-900">{staffMember.name}</span>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${staffMember.role === 'ADMIN'
                                            ? 'bg-purple-100 text-purple-800'
                                            : staffMember.role === 'STORE_MANAGER'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-green-100 text-green-800'
                                            }`}>
                                            {staffMember.role === 'STORE_MANAGER' ? 'Manager' :
                                                staffMember.role === 'DELIVERY_BOY' ? 'Delivery Boy' : 'Admin'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{staffMember.email}</p>
                                    <p className="text-xs text-gray-500">{staffMember.phone}</p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${staffMember.isActive
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                    }`}>
                                    {staffMember.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                <div className="text-xs text-gray-500">
                                    {staffMember.role === 'ADMIN' ? (
                                        <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded">All Stores</span>
                                    ) : (
                                        staffMember.store?.name || 'Not Assigned'
                                    )}
                                </div>
                                <div className="flex space-x-3">
                                    <button
                                        onClick={() => handleToggleStatus(staffMember.id, !staffMember.isActive)}
                                        className={`${staffMember.isActive ? 'text-amber-600' : 'text-green-600'}`}
                                    >
                                        {staffMember.isActive ? <Ban size={18} /> : <CheckCircle size={18} />}
                                    </button>
                                    <button
                                        onClick={() => handleOpenModal(staffMember)}
                                        className="text-primary-600"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(staffMember.id)}
                                        className="text-red-600"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {staff.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-600">No staff members found</p>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingStaff ? 'Edit Staff' : 'Add Staff'}
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

                    {!editingStaff && (
                        <>
                            <Input
                                label="Email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                error={errors.email}
                                required
                            />

                            <Input
                                label="Password"
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                error={errors.password}
                                minLength={6}
                                required
                            />
                        </>
                    )}

                    <Input
                        label="Phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        error={errors.phone}
                        required
                    />

                    <div>
                        <label className="label">Role *</label>
                        <select
                            value={formData.role}
                            onChange={(e) => {
                                const role = e.target.value as any;
                                setFormData({
                                    ...formData,
                                    role,
                                    storeId: role === 'ADMIN' ? '' : formData.storeId
                                });
                            }}
                            className="input"
                            required
                        >
                            <option value="ADMIN">Admin (Manages All Stores)</option>
                            <option value="STORE_MANAGER">Store Manager</option>
                            <option value="DELIVERY_BOY">Delivery Boy</option>
                        </select>
                    </div>

                    {formData.role !== 'ADMIN' ? (
                        <div>
                            <label className="label">Assign to Store *</label>
                            <select
                                value={formData.storeId}
                                onChange={(e) => {
                                    setFormData({ ...formData, storeId: e.target.value });
                                    if (errors.storeId) {
                                        setErrors({ ...errors, storeId: '' });
                                    }
                                }}
                                className={`input ${errors.storeId ? 'border-red-500' : ''}`}
                                required
                            >
                                <option value="">Select Store</option>
                                {stores.map((store) => (
                                    <option key={store.id} value={store.id}>
                                        {store.name}
                                    </option>
                                ))}
                            </select>
                            {errors.storeId && (
                                <p className="text-red-600 text-sm mt-1">{errors.storeId}</p>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-sm text-purple-800">
                                ✨ <strong>Admin users</strong> have access to all stores and can manage the entire system.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={submitting}>
                            {editingStaff ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </Modal>


        </div>
    );
}
