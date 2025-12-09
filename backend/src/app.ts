import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware';
import { rateLimiterMiddleware } from './middleware/rate-limiter.middleware';
import { logger } from './utils/logger';

// Import routes
import authRoutes from './routes/auth.routes';
import storeRoutes from './routes/stores.routes';
import staffRoutes from './routes/staff.routes';
import customerRoutes from './routes/customers.routes';
import orderRoutes from './routes/orders.routes';
import analyticsRoutes from './routes/analytics.routes';
import reportsRoutes from './routes/reports.routes';

const app = new Hono();

// Global middleware
// Global middleware
// CORS must be first to handle preflight requests correctly
app.use('*', cors({
    origin: (origin) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return process.env.NODE_ENV === 'development' ? origin : null;

        // Development localhosts
        if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost:')) {
            return origin;
        }

        // Production Domains (Hardcoded Fallbacks + Env Var)
        const allowedDomains = [
            'https://admin.rakhangi.shop',
            'https://delivery.rakhangi.shop',
            'https://manager.rakhangi.shop',
            'https://api.rakhangi.shop'
        ];

        const envAllowed = process.env.ALLOWED_ORIGINS?.split(',') || [];
        const allAllowed = [...allowedDomains, ...envAllowed];

        if (allAllowed.includes('*') || allAllowed.includes(origin)) {
            return origin;
        }

        return null;
    },
    credentials: true,
}));

app.use('*', secureHeaders());
app.use('*', rateLimiterMiddleware);

// Request Logging Middleware
app.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.info('Request completed', {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration: `${ms}ms`,
        ip: c.req.header('x-forwarded-for') || 'unknown'
    });
});

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

export default app;
