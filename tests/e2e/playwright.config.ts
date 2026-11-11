import { defineConfig, devices } from '@playwright/test';

// Runs inside `firebase emulators:exec` (npm run test:e2e from the repo root). The web app is the
// emulator build served by `vite preview`, which sends the same Content-Security-Policy as Hosting.
export default defineConfig({
  testDir: '.',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview:emulator -w @casepilot/web',
    cwd: '../..',
    url: 'http://localhost:4173',
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
