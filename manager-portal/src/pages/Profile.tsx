import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { User, Lock, Save } from 'lucide-react';

export default function Profile() {
    const { user } = useAuthStore();
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (passwords.newPassword !== passwords.confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (passwords.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/auth/change-password', {
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword,
            });
            toast.success('Password changed successfully');
            setPasswords({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        } catch (error: any) {
            console.error('Failed to change password:', error);
            const message = error.response?.data?.error || 'Failed to change password';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

            {/* Profile Info */}
            <div className="card">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="bg-primary-100 p-3 rounded-full">
                        <User size={32} className="text-primary-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">{user?.name}</h2>
                        <p className="text-gray-600">{user?.email}</p>
                        <span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {user?.role === 'STORE_MANAGER' ? 'Store Manager' : user?.role}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500 block">Phone</span>
                        <span className="font-medium">{user?.phone}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block">Assigned Store</span>
                        <span className="font-medium">{user?.storeName || 'N/A'}</span>
                    </div>
                </div>
            </div>

            {/* Change Password */}
            <div className="card">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <Lock size={20} className="mr-2" />
                    Change Password
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Current Password
                        </label>
                        <input
                            type="password"
                            value={passwords.currentPassword}
                            onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                            className="input"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={passwords.newPassword}
                            onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                            className="input"
                            minLength={6}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Confirm New Password
                        </label>
                        <input
                            type="password"
                            value={passwords.confirmPassword}
                            onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                            className="input"
                            minLength={6}
                            required
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="btn btn-primary flex items-center"
                        >
                            {submitting ? (
                                <span className="animate-spin mr-2">⏳</span>
                            ) : (
                                <Save size={18} className="mr-2" />
                            )}
                            Update Password
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
