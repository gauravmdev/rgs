import { serve } from '@hono/node-server';
import { initializeSocket } from './config/socket';
import { redis } from './config/redis';
import app from './app';

// Start server
const port = parseInt(process.env.PORT || '3000');

console.log('🚀 Starting Rakhangi General Stores Server...');
console.log('📦 Environment:', process.env.NODE_ENV || 'development');

const server = serve({
    fetch: app.fetch,
    port,
});

// Initialize Socket.IO
initializeSocket(server);

console.log(`✅ Server running on http://localhost:${port}`);
console.log(`📡 Socket.IO ready for connections`);
console.log(`🏥 Health check: http://localhost:${port}/health`);

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('⏳ SIGTERM received, shutting down gracefully...');
    await redis.quit();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('⏳ SIGINT received, shutting down gracefully...');
    await redis.quit();
    process.exit(0);
});
