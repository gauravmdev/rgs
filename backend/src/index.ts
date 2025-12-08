import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware';
import { initializeSocket } from './config/socket';
import { redis } from './config/redis';
import { db } from './config/database';

// Import routes (we'll create these next)
import authRoutes from './routes/auth.routes';
import storeRoutes from './routes/stores.routes';
import staffRoutes from './routes/staff.routes';
import customerRoutes from './routes/customers.routes';
import orderRoutes from './routes/orders.routes';
import analyticsRoutes from './routes/analytics.routes';
import reportsRoutes from './routes/reports.routes';

const app = new Hono();

// Global middleware
app.use('*', cors({
    origin: (origin) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return process.env.NODE_ENV === 'development' ? origin : null;

        // Allow all localhost origins during development
        if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost:')) {
            return origin;
        }

        // Check against allowed origins
        const allowed = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
        if (allowed.includes('*') || allowed.includes(origin)) {
            return origin;
        }

        return null;
    },
    credentials: true,
}));

app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
    });
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/stores', storeRoutes);
app.route('/api/staff', staffRoutes);
app.route('/api/customers', customerRoutes);
app.route('/api/orders', orderRoutes);
app.route('/api/analytics', analyticsRoutes);
app.route('/api/reports', reportsRoutes);

// Error handling
app.notFound(notFoundHandler);
app.onError(errorHandler);

// Start server
const port = parseInt(process.env.PORT || '3000');

console.log('🚀 Starting Delivery App Server...');
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
