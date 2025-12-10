import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { connectSocket, disconnectSocket } from '../../lib/socket';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const { user } = useAuthStore();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        // Connect socket when layout mounts
        if (user) {
            const socket = connectSocket(user.storeId, user.role === 'ADMIN');

            console.log('🔌 Socket connecting...', {
                storeId: user.storeId,
                userId: user.id,
                role: user.role,
                isAdmin: user.role === 'ADMIN',
                connected: socket?.connected
            });

            // Wait a bit for connection to establish
            setTimeout(() => {
                if (socket?.connected) {
                    console.log('✅ Socket connected successfully');
                } else {
                    console.warn('⚠️ Socket not connected, trying to connect...');
                    socket?.connect();
                }
            }, 1000);
        }

        // Cleanup on unmount
        return () => {
            console.log('🔌 Disconnecting socket...');
            disconnectSocket();
        };
    }, [user?.storeId, user?.id]);

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar Content */}
            <div className={`
                fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out md:hidden
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden md:block w-64 flex-shrink-0">
                <Sidebar />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden w-full">
                <Header onSidebarOpen={() => setIsMobileMenuOpen(true)} />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 w-full relative">
                    {children}
                </main>
            </div>
        </div>
    );
}
