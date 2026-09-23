import { test, expect } from '@playwright/test';
import { getUsableText } from '../src/openai.js';

test('shows a clear fallback when the answer service fails', async ({ page }) => {
  await page.route('**/api/answer', async route => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Ask' }).click();

  await expect(page.locator('#error')).toHaveText('The answer service is unavailable. Please try again later.');
});

test('treats a cut-off model reply as a failure', () => {
  expect(() =>
    getUsableText({
      status: 'incomplete',
      output_text: 'A target-date fund holds a mix of',
      usage: undefined
    })
  ).toThrow('Model returned no usable answer');
});

test('treats an empty model reply as a failure', () => {
  expect(() =>
    getUsableText({ status: 'completed', output_text: '  ', usage: undefined })
  ).toThrow('Model returned no usable answer');
});

test('returns the text of a complete model reply', () => {
  expect(
    getUsableText({
      status: 'completed',
      output_text: 'A target-date fund holds a mix of stocks and bonds.',
      usage: undefined
    })
  ).toBe('A target-date fund holds a mix of stocks and bonds.');
});
