import { test, expect } from '@playwright/test';

test.describe('Tax-AIS Application Smoke Test', () => {
  test('loads home page and mounts root application', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Tax-AIS|AIS/i);
    await expect(page.locator('#root')).toBeVisible();
  });
});
