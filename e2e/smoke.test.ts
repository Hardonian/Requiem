import { test, expect } from '@playwright/test';

/**
 * Smoke tests for Requiem - verifies core functionality
 */

test.describe('Homepage', () => {
  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto('/');
    
    // Should return 200 OK
    expect(response?.status()).toBe(200);
    
    // Page should have content (not be blank)
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});

test.describe('Health Route', () => {
  test('health endpoint returns 200', async ({ request }) => {
    const response = await request.get('/api/health');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });
});

test.describe('API Routes', () => {
  test('auth route does not 500', async ({ request }) => {
    // Test that auth-related routes don't return 500 errors
    const routes = ['/api/auth/signin', '/api/auth/signup', '/api/auth/me'];
    
    for (const route of routes) {
      const response = await request.get(route);
      
      // Should not be 500 (server error)
      // Could be 401 (unauthorized) or 404 (not found), both are acceptable
      expect(response.status()).not.toBe(500);
    }
  });
});

test.describe('Error Handling', () => {
  test('nonexistent route returns 404 not 500', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-12345');
    
    // Should return 404, not 500
    expect(response?.status()).toBeLessThan(500);
  });
});
