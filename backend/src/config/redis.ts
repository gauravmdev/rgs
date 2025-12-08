import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

redis.on('connect', () => {
    console.log('✅ Redis connected');
});

redis.on('error', (err) => {
    console.error('❌ Redis error:', err);
});

// Cache helper functions
export const cacheService = {
    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    },

    async set(key: string, value: any, ttl: number = 300): Promise<void> {
        try {
            await redis.setex(key, ttl, JSON.stringify(value));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    },

    async del(pattern: string): Promise<void> {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } catch (error) {
            console.error('Cache delete error:', error);
        }
    },

    async invalidateOrderCache(orderId?: number, storeId?: number): Promise<void> {
        // Clear list/search caches (assuming they use URL-based keys or need wildcard)
        // Adjust these patterns based on what your listing routes actually use if they cache.
        // But specifically for the analytics/dashboard issue:

        // 1. Dashboard Stats
        if (storeId) {
            await this.del(`cache:dashboard:${storeId}`);
            await this.del(`cache:daily-sales:${storeId}*`);
            await this.del(`cache:weekly-sales:${storeId}*`);
            await this.del(`cache:payment-methods:${storeId}`);
            await this.del(`cache:order-sources:${storeId}`);
            await this.del(`cache:top-customers:${storeId}*`);
            await this.del(`cache:delivery-performance:${storeId}*`);
        } else {
            // Fallback or Admin-wide clears
            await this.del('cache:dashboard:*');
            await this.del('cache:daily-sales:*');
            // ... etc
        }

        // Also clear strict URL based caches if any
        await this.del('cache:/api/orders*');
    },
};

export default redis;
