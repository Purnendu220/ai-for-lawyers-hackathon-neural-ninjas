import { Extraction } from '@casepilot/shared';
import { EXTRACT_PROMPT_VERSION } from './prompts/extract.v1';
import type { AiProvider } from './provider';

export class FixtureNotFoundError extends Error {
  constructor(sha256: string) {
    super(`No recorded extraction for document ${sha256.slice(0, 12)}…`);
    this.name = 'FixtureNotFoundError';
  }
}

/**
 * Replays recorded extractions keyed by file hash: for tests, the emulator, and the labelled demo
 * fallback (docs/ARCHITECTURE.md §6.6). It never invents output for a document it has not seen.
 */
export function createFixtureProvider(recordings: Record<string, unknown>): AiProvider {
  return {
    async extract(request) {
      const recorded = recordings[request.sha256];
      if (recorded === undefined) throw new FixtureNotFoundError(request.sha256);
      return {
        output: Extraction.parse(recorded),
        mode: 'fixture',
        model: 'fixture',
        promptVersion: EXTRACT_PROMPT_VERSION,
        usage: null,
        latencyMs: 0,
      };
    },
  };
}
