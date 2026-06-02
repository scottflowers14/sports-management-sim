import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@sports-management-sim/engine-core': path.resolve(
        import.meta.dirname,
        'packages/engine-core/src/index.ts',
      ),
      '@sports-management-sim/sport-lacrosse': path.resolve(
        import.meta.dirname,
        'packages/sport-lacrosse/src/index.ts',
      ),
    },
  },
  test: {
    include: ['packages/**/src/**/*.test.ts?(x)', 'apps/**/src/**/*.test.ts?(x)'],
  },
});
