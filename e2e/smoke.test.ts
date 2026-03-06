import { test, expect } from '@playwright/test';

const uiRoutes = ['/', '/docs', '/pricing', '/app'];

test.describe('Route smoke', () => {
  for (const route of uiRoutes) {
    test(`${route} loads without 404`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator('body')).toBeVisible();
    });
  }

  test('health endpoint returns non-500 and JSON', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  test('status endpoint includes trace_id', async ({ request }) => {
    const response = await request.get('/api/status');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('trace_id');
  });
});
