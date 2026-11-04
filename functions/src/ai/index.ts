import { readFileSync } from 'node:fs';
import { defineSecret } from 'firebase-functions/params';
import { createAnthropicProvider } from './anthropic';
import { createFixtureProvider } from './fixture';
import type { AiProvider } from './provider';

/** Set with `npx firebase functions:secrets:set ANTHROPIC_API_KEY`. Never sent to the browser. */
export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

/**
 * AI_MODE=fixture replays recordings from AI_FIXTURES_FILE (emulator and tests, see
 * functions/.env.demo-casepilot); anything else calls Claude.
 */
export function getAiProvider(): AiProvider {
  if (process.env.AI_MODE === 'fixture') {
    const file = process.env.AI_FIXTURES_FILE;
    const recordings = file ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>) : {};
    return createFixtureProvider(recordings);
  }
  return createAnthropicProvider(anthropicApiKey.value());
}
