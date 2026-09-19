import { test, expect } from '@playwright/test';

test('shows a clear fallback when the answer service fails', async ({ page }) => {
  await page.route('**/api/answer', async route => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Ask' }).click();

  await expect(page.locator('#error')).toHaveText('The answer service is unavailable. Please try again later.');
});
