import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Store,
    Users,
    UserCircle,
    Package,
    BarChart3,
    FileText,
    LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function Sidebar() {
    const { user, logout } = useAuthStore();

    const navItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'STORE_MANAGER'] },
        { name: 'Stores', path: '/stores', icon: Store, roles: ['ADMIN'] },
        { name: 'Staff', path: '/staff', icon: Users, roles: ['ADMIN'] },
        { name: 'Customers', path: '/customers', icon: UserCircle, roles: ['ADMIN', 'STORE_MANAGER'] },
        { name: 'Orders', path: '/orders', icon: Package, roles: ['ADMIN', 'STORE_MANAGER'] },
        { name: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['ADMIN', 'STORE_MANAGER'] },
        { name: 'Reports', path: '/reports', icon: FileText, roles: ['ADMIN', 'STORE_MANAGER'] },
    ];

    const filteredNavItems = navItems.filter((item) =>
        item.roles.includes(user?.role || '')
    );

    return (
        <div className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-gray-800">
                <img
                    src="/logo.png"
                    alt="Rakhangi General Stores"
                    className="w-full h-auto mb-2"
                />
                <p className="text-sm text-gray-400 mt-1 text-center">Admin Portal</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
                {filteredNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-primary-600 text-white'
                                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`
                            }
                        >
                            <Icon size={20} />
                            <span className="font-medium">{item.name}</span>
                        </NavLink>
                    );
                })}
            </nav>

            {/* User Info & Logout */}
            <div className="p-4 border-t border-gray-800">
                <div className="flex items-center space-x-3 px-4 py-3 bg-gray-800 rounded-lg mb-2">
                    <UserCircle size={24} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user?.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Logout</span>
                </button>
            </div>
        </div>
    );
}
