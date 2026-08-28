import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envUatLocal = path.resolve(process.cwd(), '.env.uat.local');
const envLocal = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envUatLocal)) {
  dotenv.config({ path: envUatLocal, override: true });
} else if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal, override: true });
} else {
  dotenv.config();
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://dev.onpro.tech',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      slowMo: process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : 0,
    },
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
