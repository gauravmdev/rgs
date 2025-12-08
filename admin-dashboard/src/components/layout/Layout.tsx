import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '../../store/authStore';
import { connectSocket, disconnectSocket } from '../../lib/socket';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const { user } = useAuthStore();

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
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
