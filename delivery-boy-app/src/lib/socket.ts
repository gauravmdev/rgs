import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const connectSocket = (storeId?: number, isAdmin?: boolean) => {
    // If already connected, just rejoin store
    if (socket?.connected) {
        console.log('🔌 Socket already connected, rejoining store...');
        if (isAdmin) {
            // Admin joins a special "admin" room to receive all events
            socket.emit('join-admin');
            console.log('📍 Admin joined admin room');
        } else if (storeId) {
            socket.emit('join-store', storeId);
            console.log('📍 Joined store room:', storeId);
        }
        return socket;
    }

    // Create new connection
    console.log('🔌 Creating new socket connection...');

    // Get headers from env or default
    // Get headers from env or default
    // Use the same logic as api.ts - prioritize dev port
    const socketUrl = import.meta.env.DEV
        ? 'http://localhost:3001'
        : (import.meta.env.VITE_API_URL || 'https://api.rakhangi.shop').replace(/\/api\/?$/, '');

    socket = io(socketUrl, {
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        path: '/socket.io/', // Ensure this matches backend default
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('✅ Socket connected:', socket?.id);
        if (isAdmin) {
            socket?.emit('join-admin');
            console.log('📍 Admin joined admin room');
        } else if (storeId) {
            socket?.emit('join-store', storeId);
            console.log('📍 Joined store room:', storeId);
        }
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
    });

    socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
        if (isAdmin) {
            socket?.emit('join-admin');
        } else if (storeId) {
            socket?.emit('join-store', storeId);
        }
    });

    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        console.log('🔌 Disconnecting socket...');
        socket.disconnect();
        socket = null;
    }
};

export const getSocket = () => {
    if (!socket) {
        console.warn('⚠️ Socket not initialized, call connectSocket first');
    }
    return socket;
};
