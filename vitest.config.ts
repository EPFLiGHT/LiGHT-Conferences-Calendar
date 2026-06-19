import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve the "@/..." aliases from tsconfig.json (native Vite support).
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
