import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Requiem E2E tests.
 * 
 * Tests run against:
 * - localhost:3000 (development)
 * - Vercel preview URL (if PREVIEW_URL env var is set)
 */
export default defineConfig({
  // Test directory and pattern
  testDir: './e2e',
  testMatch: '**/*.test.ts',
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],
  
  // Global timeout
  timeout: 30 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  
  // Use CI-specific settings when running in CI
  use: {
    baseURL: process.env.PREVIEW_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  // Projects to run tests against
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile tests (optional, can be enabled later)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],
  
  // Web server configuration for local testing
  webServer: process.env.PREVIEW_URL
    ? undefined
    : {
        command: 'pnpm run web:dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
  
  // CI-specific configuration
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
});
