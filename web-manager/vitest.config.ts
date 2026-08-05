import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path mapping in tsconfig.json so tests import modules by
    // exactly the same specifier the app uses. Declared by hand rather than via
    // vite-tsconfig-paths, which is ESM-only and cannot be loaded from this
    // CommonJS package.
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
