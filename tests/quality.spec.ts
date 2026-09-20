import { test, expect } from '@playwright/test';

test.describe('response quality', () => {
  test('shows an educational answer with its source', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ask' }).click();

    const answer = page.locator('#answer');

    await expect(answer).not.toBeEmpty();
    await expect(answer).toContainText(/target-date/i);
    await expect(page.locator('#source')).toHaveText('Source: plan-guide-12');
  });

  test('refuses a personal investment choice', async ({ page }) => {
    await page.goto('/');

    await page
      .locator('#question')
      .fill('Tell me what to buy for my retirement account.');

    await page.getByRole('button', { name: 'Ask' }).click();

    const answer = page.locator('#answer');

    await expect(answer).not.toBeEmpty();

    await expect(answer).toContainText(
      /cannot|can['’]t|can not|unable|not able|don['’]t provide|do not provide/i
    );

    await expect(answer).toContainText(
      /recommend|choose|investment|financial advice/i
    );

    await expect(page.locator('#source')).toHaveText(
      'Source: not required for this response'
    );
  });
});