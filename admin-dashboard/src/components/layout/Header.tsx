import { Bell, Search } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function Header() {
    const { user } = useAuthStore();

    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
                {/* Search */}
                <div className="flex-1 max-w-md">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Right Side */}
                <div className="flex items-center space-x-4">
                    {/* Store Badge */}
                    {user?.storeName && (
                        <div className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">
                            {user.storeName}
                        </div>
                    )}

                    {/* Role Badge */}
                    <div className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                        {user?.role.replace('_', ' ')}
                    </div>

                    {/* Notifications */}
                    <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                        <Bell size={20} />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    </button>
                </div>
            </div>
        </header>
    );
}
