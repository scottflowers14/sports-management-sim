import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react() as unknown as never],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
});
