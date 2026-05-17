import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,   // SQLite is single-writer
  workers: 1,             // one test at a time to avoid DB conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: 'http://localhost:3031',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Use a production build in CI — next dev compiles on-demand which can
    // blow past action timeouts on cold runners. Pre-building means instant
    // page loads once next start is up.
    command: process.env.CI
      ? 'next build && PORT=3031 next start'
      : 'PORT=3031 next dev',
    url: 'http://localhost:3031',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,  // allow 5 min for next build in CI
    env: {
      DATABASE_URL: 'file:./prisma/e2e.db',
      APP_PASSWORD: '',
    },
  },
});
