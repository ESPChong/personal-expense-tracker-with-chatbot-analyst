import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: './tests/global-setup.ts',
    setupFiles: ['./tests/setup.ts'],
    env: { TZ: 'UTC' }, // deterministic month boundaries everywhere
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Route files call cookies() from next/headers — swap in our fake jar
      'next/headers': path.resolve(__dirname, 'tests/mocks/next-headers.ts'),
    },
  },
});
