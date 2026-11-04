import { defineConfig } from 'vitest/config';

// Runs inside `firebase emulators:exec` (npm run test:integration from the repo root). The first
// call to each function starts a worker, which can take well over 30 seconds on Windows.
export default defineConfig({
  test: {
    testTimeout: 120_000,
    hookTimeout: 600_000,
    fileParallelism: false,
  },
});
