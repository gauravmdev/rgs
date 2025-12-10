import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

let io: Server;

export const initializeSocket = (server: any) => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
        console.error('❌ Socket.IO Pub Client Error:', err);
    });

    subClient.on('error', (err) => {
        console.error('❌ Socket.IO Sub Client Error:', err);
    });

    io = new Server(server, {
        cors: {
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
            credentials: true,
        },
        adapter: createAdapter(pubClient, subClient),
    });

    io.on('connection', (socket) => {
        console.log('🔌 Client connected:', socket.id);

        // Join store room
        socket.on('join-store', (storeId: number) => {
            socket.join(`store-${storeId}`);
            console.log(`📍 Socket ${socket.id} joined store-${storeId}`);
        });

        // Admin joins a special room to receive all events
        socket.on('join-admin', () => {
            socket.join('admin');
            console.log(`📍 Socket ${socket.id} joined admin room`);
        });

        // Leave store room
        socket.on('leave-store', (storeId: number) => {
            socket.leave(`store-${storeId}`);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Client disconnected:', socket.id);
        });
    });

    console.log('✅ Socket.IO initialized');
    return io;
};

export const getIO = (): Server => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocket first.');
    }
    return io;
};

// Helper to emit to specific store
// Helper to emit to specific store AND admin room
export const emitToStore = (storeId: number, event: string, data: any) => {
    if (io) {
        io.to(`store-${storeId}`).emit(event, data);
        io.to('admin').emit(event, data); // Also send to admin room
        console.log(`📡 Emitted "${event}" to store-${storeId} and admin`);
    }
};

// Helper to emit to all connected clients
export const emitToAll = (event: string, data: any) => {
    if (io) {
        io.emit(event, data);
        console.log(`📡 Emitted "${event}" to all clients`);
    }
};
