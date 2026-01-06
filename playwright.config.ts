import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially - Obsidian is a single instance
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker - Obsidian can only run one instance
  reporter: 'list',
  timeout: 60000, // 60 seconds per test
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'on', // Capture screenshots for all tests
  },
  projects: [
    {
      name: 'obsidian',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
