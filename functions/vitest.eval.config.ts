import { defineConfig } from 'vitest/config';

// Live prompt evaluation (npm run eval). Kept apart from the unit tests because it calls Claude.
export default defineConfig({
  test: {
    include: ['evals/**/*.eval.ts'],
    testTimeout: 300_000,
    fileParallelism: false,
  },
});
