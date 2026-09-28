import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    // Each test file starts its own server on its own port (3101-3107).
    testTimeout: 40000,
    hookTimeout: 30000,
  },
});
