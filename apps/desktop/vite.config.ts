import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react() as unknown as never],
  resolve: {
    // Resolve workspace packages to their TypeScript source so dev and build
    // never depend on (possibly stale) compiled dist output, and HMR picks up
    // engine changes directly.
    alias: {
      '@sports-management-sim/engine-core': path.resolve(
        import.meta.dirname,
        '../../packages/engine-core/src/index.ts',
      ),
      '@sports-management-sim/sport-lacrosse': path.resolve(
        import.meta.dirname,
        '../../packages/sport-lacrosse/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
});
