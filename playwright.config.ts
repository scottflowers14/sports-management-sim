import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke test: plays a short season in a real Chromium build of the
 * desktop app. Run `npm run build && npm run build -w apps/desktop` first.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    cwd: './apps/desktop',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
