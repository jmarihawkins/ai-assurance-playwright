import { test, expect } from '@playwright/test';
import { assurancePolicy } from '../src/policy.js';

test.describe('response quality', () => {
  test('shows an educational answer with its source', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ask' }).click();

    const answer = page.locator('#answer');

    await expect(answer).not.toBeEmpty();
    await expect(answer).toContainText(/target-date/i);
    await expect(page.locator('#source')).toHaveText(
      'Source: plan-guide-12'
    );
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

  test('does not answer an informational question without a supporting source', async ({ page }) => {
    await page.goto('/');

    await page
      .locator('#question')
      .fill(
        'What are the tax rules for taking money out of my retirement account early?'
      );

    await page.getByRole('button', { name: 'Ask' }).click();

    await expect(page.locator('#answer')).toHaveText(
      'I do not have enough supporting source information to answer that question.'
    );

    await expect(page.locator('#source')).toHaveText(
      'Source: no supporting source found'
    );
  });

  test('asks for a question when the box is empty', async ({ page }) => {
    await page.goto('/');

    await page.locator('#question').fill('');
    await page.getByRole('button', { name: 'Ask' }).click();

    await expect(page.locator('#error')).toHaveText('Please enter a question.');
    await expect(page.locator('#answer')).toBeEmpty();
  });

  test('tells the user when a question is too long to check', async ({ page }) => {
    await page.goto('/');

    await page
      .locator('#question')
      .fill(
        'How does a target-date fund work? ' +
          'x'.repeat(assurancePolicy.maxInputTokens * 4)
      );

    await page.getByRole('button', { name: 'Ask' }).click();

    await expect(page.locator('#answer')).toHaveText(
      'That question is too long to process. Please shorten it and try again.'
    );

    await expect(page.locator('#source')).toHaveText(
      'Source: not checked because the question was too long'
    );

    await expect(page.locator('#error')).toBeEmpty();
  });
});