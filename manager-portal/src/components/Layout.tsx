import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Store, ShoppingCart, Users, BarChart3, LogOut, Package, Radio, User, Menu, X } from 'lucide-react';
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

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
            {/* Mobile Header */}
            <header className="bg-white shadow-sm sticky top-0 z-30">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-14 sm:h-16">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                            aria-label="Toggle menu"
                        >
                            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>

                        {/* Logo */}
                        <div className="flex items-center space-x-2 sm:space-x-4">
                            <img
                                src="/logo.png"
                                alt="Rakhangi General Stores"
                                className="h-8 sm:h-12 w-auto"
                            />
                            <div className="hidden sm:block">
                                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Store Manager</h1>
                                <p className="text-xs sm:text-sm text-gray-600 hidden lg:block">Welcome, {user?.name}</p>
                            </div>
                        </div>

                        {/* Desktop Actions */}
                        <div className="hidden md:flex items-center space-x-2">
                            <button
                                onClick={() => navigate('/profile')}
                                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                <User size={20} />
                                <span className="hidden lg:inline">Profile</span>
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <LogOut size={20} />
                                <span className="hidden lg:inline">Logout</span>
                            </button>
                        </div>

                        {/* Mobile Profile Button */}
                        <button
                            onClick={() => navigate('/profile')}
                            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <User size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Desktop Navigation */}
            <nav className="hidden md:block bg-white border-b sticky top-14 sm:top-16 z-20">
                <div className="px-4 sm:px-6 lg:px-8">
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

            {/* Mobile Drawer Navigation */}
            <div
                className={`md:hidden fixed inset-0 z-40 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black bg-opacity-50"
                    onClick={() => setIsMobileMenuOpen(false)}
                />

                {/* Drawer */}
                <div
                    className={`absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                        }`}
                >
                    {/* Drawer Header */}
                    <div className="p-4 border-b bg-gradient-to-r from-primary-600 to-primary-700">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                                <User className="text-primary-600" size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                                <p className="text-xs text-primary-100 truncate">{user?.storeName}</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Items */}
                    <nav className="p-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;

                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors mb-1 ${isActive
                                            ? 'bg-primary-50 text-primary-600'
                                            : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <Icon size={20} />
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Drawer Footer */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                        >
                            <LogOut size={20} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    );
}
