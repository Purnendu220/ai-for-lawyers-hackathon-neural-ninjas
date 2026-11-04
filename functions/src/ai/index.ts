import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { defineSecret } from 'firebase-functions/params';
import { createAnthropicProvider } from './anthropic';
import { createFixtureProvider } from './fixture';
import type { AiProvider } from './provider';

/** Set with `npx firebase functions:secrets:set ANTHROPIC_API_KEY`. Never sent to the browser. */
export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

function readRecordings(file: string | undefined): Record<string, unknown> {
  return file && existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>) : {};
}

/**
 * Saves each live extraction to AI_RECORD_FILE, keyed by file hash, so a real Claude run can be
 * replayed later (the labelled demo fallback). Emulator only.
 */
function recording(provider: AiProvider, file: string): AiProvider {
  return {
    async extract(request) {
      const result = await provider.extract(request);
      if (result.mode === 'live') {
        const recordings = readRecordings(file);
        recordings[request.sha256] = result.output;
        writeFileSync(file, `${JSON.stringify(recordings, null, 2)}\n`);
      }
      return result;
    },
  };
}

/**
 * AI_MODE=fixture replays recordings from AI_FIXTURES_FILE (emulator and tests, see
 * functions/.env.demo-casepilot); anything else calls Claude.
 */
export function getAiProvider(): AiProvider {
  if (process.env.AI_MODE === 'fixture') {
    return createFixtureProvider(readRecordings(process.env.AI_FIXTURES_FILE));
  }
  const live = createAnthropicProvider(anthropicApiKey.value());
  const recordTo = process.env.AI_RECORD_FILE;
  return recordTo && process.env.FUNCTIONS_EMULATOR === 'true' ? recording(live, recordTo) : live;
}
