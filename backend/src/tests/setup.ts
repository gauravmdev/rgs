import { afterAll } from 'vitest';
import { redis } from '../config/redis';
import { queryClient } from '../config/database';

afterAll(async () => {
    // Close Redis connection
    await redis.quit();

    // Close Database connection
    await queryClient.end();
});
