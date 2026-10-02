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
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/desktop/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.ts?(x)', '**/test-fixtures.ts', '**/test-setup.ts', '**/main.tsx', '**/index.ts'],
      reporter: ['text-summary', 'json-summary', 'html'],
      // The engine packages carry the game's rules, so CI holds them to a floor.
      thresholds: {
        'packages/engine-core/src/**': { lines: 95, branches: 85, functions: 95 },
        'packages/sport-lacrosse/src/**': { lines: 90, branches: 82, functions: 88 },
      },
    },
  },
});
