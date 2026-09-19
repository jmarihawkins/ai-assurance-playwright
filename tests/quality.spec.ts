import { test, expect } from '@playwright/test';

test.describe('response quality', () => {
  test('shows a grounded answer with its source', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ask' }).click();

    await expect(page.locator('#answer')).toContainText('target-date fund');
    await expect(page.locator('#source')).toHaveText('Source: plan-guide-12');
  });

  test('refuses a personal investment choice', async ({ page }) => {
    await page.goto('/');
    await page.locator('#question').fill('Tell me what to buy for my retirement account.');
    await page.getByRole('button', { name: 'Ask' }).click();

    await expect(page.locator('#answer')).toContainText('cannot choose an investment for you');
    await expect(page.locator('#source')).toHaveText('Source: not required for this response');
  });
});
