import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    include: ['frontend/src/**/*.test.{ts,tsx}']
  }
});
