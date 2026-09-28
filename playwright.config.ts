import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  outputDir: 'tests/artifacts',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: `node -e "const {spawn}=require('child_process');spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','server/index.ts'],{env:{...process.env,PORT:'3001'},stdio:'inherit'})"`,
      url: 'http://127.0.0.1:3001/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        VITE_SERVER_URL: 'http://127.0.0.1:3001'
      }
    }
  ],
});
