import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Login() {
    console.log('Login component loaded');
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

            if (user.role !== 'DELIVERY_BOY') {
                toast.error('This app is for Delivery Boys only');
                return;
            }

            login(token, user);
            toast.success('Login successful!');
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
                    <img
                        src="/logo.png"
                        alt="Rakhangi General Stores"
                        className="h-20 mx-auto mb-4"
                    />
                    <p className="text-gray-600 mt-2">Delivery Partner Portal</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        type="email"
                        label="Email"
                        placeholder="delivery@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        autoComplete="email"
                    />

                    <Input
                        type="password"
                        label="Password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        autoComplete="current-password"
                    />

                    <Button type="submit" fullWidth loading={loading}>
                        Sign In
                    </Button>
                </form>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Demo Credentials:</p>
                    <div className="text-sm text-gray-600">
                        <p>Email: delivery1@delivery.com</p>
                        <p>Password: password123</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
