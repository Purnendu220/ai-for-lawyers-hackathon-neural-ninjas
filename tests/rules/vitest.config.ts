import { defineConfig } from 'vitest/config';

// Runs inside `firebase emulators:exec` (npm run test:rules from the repo root), which sets
// FIRESTORE_EMULATOR_HOST for @firebase/rules-unit-testing.
export default defineConfig({
  test: {
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
