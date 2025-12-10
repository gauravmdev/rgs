import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Search, User, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';

interface OrderItem {
    description: string;
    quantity: number;
}

interface CustomerFormData {
    name: string;
    phone: string;
    email: string;
    address: string;
    apartment: string;
}

export default function ProcessOrder() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [submitting, setSubmitting] = useState(false);

    // Order form
    const [formData, setFormData] = useState({
        customerId: '',
        customerPhone: '',
        storeId: user?.storeId?.toString() || '',
        // source removed
        invoiceNumber: '',
        invoiceAmount: '',
        items: [{ description: '', quantity: 1 }] as OrderItem[],
        notes: '',
    });

    // Customer search & creation
    const [searchPhone, setSearchPhone] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [showCreateCustomer, setShowCreateCustomer] = useState(false);
    const [customerFormData, setCustomerFormData] = useState<CustomerFormData>({
        name: '',
        phone: '',
        email: '',
        address: '',
        apartment: '',
    });
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

    // Automatic search with debouncing
    useEffect(() => {
        const delayTimer = setTimeout(() => {
            if (searchPhone && searchPhone.trim().length >= 2) {
                handleSearchCustomer();
            } else if (searchPhone.trim().length === 0) {
                setSearchResults([]);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(delayTimer);
    }, [searchPhone]);

    // Search customer by name, phone, or apartment
    const handleSearchCustomer = async () => {
        if (!searchPhone || searchPhone.trim().length < 2) {
            return;
        }

        setSearching(true);
        setSearchResults([]);

        try {
            // Search with the query parameter - backend will handle multi-field search
            const response = await api.get(`/customers?search=${encodeURIComponent(searchPhone.trim())}&storeId=${user?.storeId}`);

            if (response.data.customers.length > 0) {
                setSearchResults(response.data.customers);
            } else {
                setSearchResults([]);
            }
        } catch (error) {
            console.error('Search failed:', error);
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    // Create new customer inline
    const handleCreateCustomer = async (e: FormEvent) => {
        e.preventDefault();

        try {
            const payload: any = {
                ...customerFormData,
                storeId: user?.storeId,
            };

            // Clean up empty email to avoid unique constraint issues if backend doesn't handle '' well
            if (!payload.email) delete payload.email;

            const response = await api.post('/customers', payload);

            const newCustomer = response.data.customer;
            setSelectedCustomer(newCustomer);
            setFormData({ ...formData, customerId: newCustomer.id.toString() });
            setShowCreateCustomer(false);
            toast.success('Customer created successfully!');
        } catch (error: any) {
            console.error('Failed to create customer:', error);
            toast.error(error.response?.data?.error || 'Failed to create customer');
        }
    };

    // Add/Remove items
    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { description: '', quantity: 1 }],
        });
    };

    const removeItem = (index: number) => {
        if (formData.items.length > 1) {
            const newItems = formData.items.filter((_, i) => i !== index);
            setFormData({ ...formData, items: newItems });
        }
    };

    const updateItem = (index: number, field: keyof OrderItem, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData({ ...formData, items: newItems });
    };

    // Submit order
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!formData.customerId) {
            toast.error('Please select or create a customer');
            return;
        }

        if (formData.items.some(item => !item.description || item.quantity < 1)) {
            toast.error('Please fill in all item details');
            return;
        }

        const amount = parseFloat(formData.invoiceAmount);
        if (!amount || amount <= 0) {
            toast.error('Invoice amount must be greater than 0');
            return;
        }

        // Validate storeId exists
        if (!user?.storeId) {
            toast.error('Store information missing. Please try logging in again.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                customerId: parseInt(formData.customerId, 10),
                storeId: parseInt(user.storeId.toString(), 10),
                // source removed
                // Send undefined if empty string to match optional() better
                invoiceNumber: formData.invoiceNumber || undefined,
                invoiceAmount: parseFloat(formData.invoiceAmount) || 0,
                totalItems: formData.items.reduce((sum, item) => sum + item.quantity, 0),
                items: formData.items,
                // Zod optional() expects undefined, NOT null
                notes: formData.notes || undefined,
            };

            await api.post('/orders', payload);

            toast.success('Order created successfully!');
            navigate('/orders');
        } catch (error: any) {
            console.error('Failed to create order:', error);
            // Handle array of validation errors from backend if present
            if (error.response?.data?.details) {
                const messages = error.response.data.details.map((d: any) => `${d.field}: ${d.message}`).join(', ');
                toast.error(messages || 'Validation failed');
            } else {
                toast.error(error.response?.data?.error || 'Failed to create order');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 p-6">
            {/* Header */}
            <div className="card bg-gradient-to-r from-primary-600 to-primary-700 text-white">
                <h1 className="text-3xl font-bold">Process New Order</h1>
                <p className="text-primary-100 mt-2">Create order from POS invoice</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Search */}
                <div className="card">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                        <User size={24} className="mr-2 text-primary-600" />
                        Customer Information
                    </h2>

                    {!selectedCustomer ? (
                        <div className="space-y-4">
                            <div>
                                <label className="label">Search Customer</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder="Search by name, phone, email, or apartment..."
                                            value={searchPhone}
                                            onChange={(e) => setSearchPhone(e.target.value)}
                                            className="input pr-10"
                                        />
                                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            setCustomerFormData({ ...customerFormData, phone: searchPhone });
                                            setShowCreateCustomer(true);
                                        }}
                                    >
                                        <Plus size={20} className="mr-2" />
                                        Create Customer
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Type at least 2 characters to search automatically
                                </p>
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                                    {searchResults.map((customer) => (
                                        <button
                                            key={customer.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedCustomer(customer);
                                                setFormData({ ...formData, customerId: customer.id.toString() });
                                                setSearchResults([]);
                                                setSearchPhone('');
                                                toast.success(`Selected: ${customer.name}`);
                                            }}
                                            className="w-full text-left p-4 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="font-medium text-gray-900">{customer.name}</p>
                                                    <p className="text-sm text-gray-600">{customer.phone}</p>
                                                    <p className="text-sm text-gray-600">{customer.address}</p>
                                                    {customer.apartment && (
                                                        <p className="text-sm text-gray-500">Apt: {customer.apartment}</p>
                                                    )}
                                                </div>
                                                {parseFloat(customer.totalDues || '0') > 0 && (
                                                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                                                        Dues: ₹{parseFloat(customer.totalDues).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* No Results Message */}
                            {searching === false && searchPhone && searchResults.length === 0 && (
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm text-yellow-800">
                                        No customer found. Would you like to create a new customer?
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <User size={20} className="text-green-600" />
                                        <p className="font-bold text-green-900 text-lg">{selectedCustomer.name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-green-700 flex items-center">
                                            <span className="font-medium mr-2">Phone:</span>
                                            {selectedCustomer.phone}
                                        </p>
                                        <p className="text-sm text-green-700 flex items-center">
                                            <span className="font-medium mr-2">Address:</span>
                                            {selectedCustomer.address}
                                        </p>
                                        {selectedCustomer.apartment && (
                                            <p className="text-sm text-green-700 flex items-center">
                                                <span className="font-medium mr-2">Apartment:</span>
                                                {selectedCustomer.apartment}
                                            </p>
                                        )}
                                        {selectedCustomer.email && (
                                            <p className="text-sm text-green-700 flex items-center">
                                                <span className="font-medium mr-2">Email:</span>
                                                {selectedCustomer.email}
                                            </p>
                                        )}
                                    </div>
                                    {parseFloat(selectedCustomer.totalDues || '0') > 0 && (
                                        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                                            <p className="text-sm text-red-600 font-medium">
                                                ⚠️ Pending Dues: ₹{parseFloat(selectedCustomer.totalDues).toFixed(2)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedCustomer(null);
                                        setFormData({ ...formData, customerId: '' });
                                        setSearchPhone('');
                                        setSearchResults([]);
                                    }}
                                >
                                    Change
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Order Details */}
                <div className="card">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                        <Package size={24} className="mr-2 text-primary-600" />
                        Order Details
                    </h2>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Source select removed */}
                            <Input
                                label="Invoice Number"
                                value={formData.invoiceNumber}
                                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                placeholder="Enter invoice # (optional)"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="label">Order Items *</label>
                                <Button type="button" size="sm" onClick={addItem}>
                                    <Plus size={16} className="mr-1" />
                                    Add Item
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {formData.items.map((item, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Item description"
                                            value={item.description}
                                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                                            className="input flex-1"
                                            required
                                        />
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                            className="input w-24"
                                            min="1"
                                            required
                                        />
                                        {formData.items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Input
                            label="Invoice Amount *"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.invoiceAmount}
                            onChange={(e) => setFormData({ ...formData, invoiceAmount: e.target.value })}
                            placeholder="0.00"
                            required
                        />

                        <div>
                            <label className="label">Notes</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="input"
                                rows={3}
                                placeholder="Any special instructions..."
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => navigate('/orders')}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        loading={submitting}
                        disabled={!selectedCustomer}
                        className="flex-1"
                    >
                        Create Order
                    </Button>
                </div>
            </form>

            {/* Create Customer Modal */}
            <Modal
                isOpen={showCreateCustomer}
                onClose={() => setShowCreateCustomer(false)}
                title="Create New Customer"
            >
                <form onSubmit={handleCreateCustomer} className="space-y-4">
                    <Input
                        label="Customer Name *"
                        value={customerFormData.name}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                        required
                    />
                    <Input
                        label="Phone Number *"
                        type="tel"
                        value={customerFormData.phone}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                        required
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={customerFormData.email}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                    />
                    <Input
                        label="Address *"
                        value={customerFormData.address}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                        required
                    />
                    <Input
                        label="Apartment/Building"
                        value={customerFormData.apartment}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, apartment: e.target.value })}
                        placeholder="Apt 5B, Tower A"
                    />

                    <div className="flex gap-2 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setShowCreateCustomer(false)}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1">
                            Create Customer
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
