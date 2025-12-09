import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['src/**/*.test.ts'],
        setupFiles: ['./src/tests/setup.ts'],
        env: {
            DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb',
            REDIS_URL: 'redis://localhost:6379',
            JWT_SECRET: 'test-secret-at-least-32-chars-long-string-for-val',
            NODE_ENV: 'test',
        },
    },
});
