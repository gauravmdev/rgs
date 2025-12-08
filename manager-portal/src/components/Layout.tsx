import { type ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Store, ShoppingCart, Users, BarChart3, LogOut, Package, Radio } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { api } from '../lib/api';

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();

    useEffect(() => {
        if (user) {
            connectSocket(user.storeId, user.role === 'ADMIN');
        }

        return () => {
            disconnectSocket();
        };
    }, [user]);

    useEffect(() => {
        // Fetch fresh user data to get latest store assignment
        const fetchUserData = async () => {
            try {
                const response = await api.get('/auth/me');
                const freshUser = response.data.user;

                // Update auth store with fresh data
                const { token } = useAuthStore.getState();
                if (token) {
                    useAuthStore.getState().login(token, freshUser);
                }
            } catch (error) {
                console.error('Failed to fetch user data:', error);
            }
        };

        if (user) {
            fetchUserData();
        }
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/', label: 'Dashboard', icon: Store },
        { path: '/live-orders', label: 'Live Orders', icon: Radio },
        { path: '/process-order', label: 'Create Order', icon: ShoppingCart },
        { path: '/orders', label: 'Orders', icon: Package },
        { path: '/customers', label: 'Customers', icon: Users },
        { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <img
                                src="/logo.png"
                                alt="Rakhangi General Stores"
                                className="h-12 w-auto"
                            />
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Store Manager Portal</h1>
                                <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <LogOut size={20} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Navigation */}
            <nav className="bg-white border-b sticky top-16 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex space-x-8 overflow-x-auto">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;

                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className={`flex items-center space-x-2 px-3 py-4 border-b-2 transition-colors whitespace-nowrap ${isActive
                                        ? 'border-primary-600 text-primary-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                                        }`}
                                >
                                    <Icon size={20} />
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
