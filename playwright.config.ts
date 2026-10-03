import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Look for test files in the "tests" directory, relative to this configuration file.
  testDir: 'tests',

  fullyParallel: true,
  workers: '50%',

  // Reporter to use
  reporter: 'html',

  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: 'http://localhost:8080',

    // Axis label snapshots follow this locale's clock and date order
    locale: 'en-GB',

    // Collect traces
    trace: {
      mode: 'on-all-retries',
      snapshots: { dom: false, screen: true }
    },
  },
  retries: 1,
  // Configure projects for major browsers.
  projects: [
    {
      name: 'chromium',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Run your local dev server before starting the tests.
  webServer: {
    command: 'pnpm run devserver',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
