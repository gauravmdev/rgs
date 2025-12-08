import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import Button from '../components/Button';
import Input from '../components/Input';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await api.post('/auth/login', formData);
            const { token, user } = response.data;

            // Only allow store managers
            if (user.role !== 'STORE_MANAGER') {
                toast.error('This portal is for Store Managers only');
                return;
            }

            // Login with token
            login(token, user);

            // Fetch fresh user data to get current store assignment
            try {
                const userResponse = await api.get('/auth/me');
                const freshUser = userResponse.data.user;

                // Update auth store with fresh data
                login(token, freshUser);

                toast.success(`Welcome to ${freshUser.storeName || 'your store'}!`);
            } catch (error) {
                console.error('Failed to fetch user details:', error);
                toast.success('Login successful!');
            }

            navigate('/');
        } catch (error: any) {
            console.error('Login error:', error);
            toast.error(error.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
                        <Store className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Store Manager</h1>
                    <p className="text-gray-600 mt-2">Portal</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        type="email"
                        label="Email"
                        placeholder="manager1@delivery.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                    />

                    <Input
                        type="password"
                        label="Password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                    />

                    <Button type="submit" className="w-full" loading={loading}>
                        Sign In
                    </Button>
                </form>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Demo Credentials:</p>
                    <div className="text-sm text-gray-600">
                        <p>Email: manager1@delivery.com</p>
                        <p>Password: password123</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
