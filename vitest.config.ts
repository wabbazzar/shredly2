import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/lib')
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/tmp/**']
    }
  }
});
