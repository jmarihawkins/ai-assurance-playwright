import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: [
    {
      command: 'npm run start',
      url: 'http://127.0.0.1:4173/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      // Live mode pointed at local port 9, which fetch refuses to connect to,
      // so every model call fails without reaching OpenAI or using a real key.
      command: 'npm run start',
      url: 'http://127.0.0.1:4174/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        PORT: '4174',
        AI_MODE: 'live',
        OPENAI_API_KEY: 'test-key',
        OPENAI_BASE_URL: 'http://127.0.0.1:9/v1'
      }
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});
