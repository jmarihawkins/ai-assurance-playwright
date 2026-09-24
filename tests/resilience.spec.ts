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

test('returns a 503 when the model call fails on the server', async ({ request }) => {
  // The server on 4174 cannot reach a model, so this goes through the real error path.
  const response = await request.post('http://127.0.0.1:4174/api/answer', {
    data: { question: 'How does a target-date fund work?' }
  });

  expect(response.status()).toBe(503);

  const body = await response.json();

  expect(body.error).toBe('AI service is temporarily unavailable');
  expect(body.requestId).toBeTruthy();
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
