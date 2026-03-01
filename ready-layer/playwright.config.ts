import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Requiem E2E tests.
 * Runs from ready-layer directory; test files are in ../e2e.
 */
export default defineConfig({
  testDir: '../e2e',
  testMatch: '**/*.test.ts',
  fullyParallel: true,
  reporter: [
    ['html', { outputFolder: '../playwright-report' }],
    ['json', { outputFile: '../playwright-report/results.json' }],
    ['list'],
  ],
  timeout: 30 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  use: {
    baseURL: process.env.PREVIEW_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PREVIEW_URL
    ? undefined
    : {
        // In CI: use the pre-built artifact via `next start` (fast, no compile).
        // Locally: use `next dev` for hot-reload.
        command: process.env.CI ? 'pnpm run start' : 'pnpm run dev',
        cwd: '.',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
});
