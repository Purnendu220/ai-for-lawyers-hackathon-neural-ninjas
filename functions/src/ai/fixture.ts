import { Extraction } from '@casepilot/shared';
import { PermanentJobError } from '../core/errors';
import { COPILOT_PROMPT_VERSION } from './prompts/copilot.v2';
import { EXTRACT_PROMPT_VERSION } from './prompts/extract.v1';
import { TRANSLATE_PROMPT_VERSION } from './prompts/translate.v1';
import type { AiProvider, AiResult } from './provider';

export class FixtureNotFoundError extends PermanentJobError {
  constructor(sha256: string) {
    super(
      'no_recording',
      `Replay mode has no recorded analysis for this file (${sha256.slice(0, 12)}…). Live AI is off here.`,
    );
    this.name = 'FixtureNotFoundError';
  }
}

const fixtureResult = <T>(output: T, promptVersion: string): AiResult<T> => ({
  output,
  mode: 'fixture',
  model: 'fixture',
  promptVersion,
  usage: null,
  latencyMs: 0,
});

/**
 * Replays recorded extractions keyed by file hash, for tests, the emulator and the labelled demo
 * fallback (docs/ARCHITECTURE.md §6.6). It never invents an extraction for a document it has not
 * seen. Copilot answers and translations are fixed, clearly marked test stand-ins: they exercise
 * the plumbing (retrieval, citation checks, storage), not the model.
 */
export function createFixtureProvider(recordings: Record<string, unknown>): AiProvider {
  return {
    async extract(request) {
      const recorded = recordings[request.sha256];
      if (recorded === undefined) throw new FixtureNotFoundError(request.sha256);
      return fixtureResult(Extraction.parse(recorded), EXTRACT_PROMPT_VERSION);
    },
    async answer({ excerpts }) {
      const top = excerpts[0];
      if (!top) {
        return fixtureResult(
          {
            answer: 'Test mode: the documents provided do not establish an answer.',
            insufficientEvidence: true,
            sources: [],
            followUpQuestions: [],
          },
          COPILOT_PROMPT_VERSION,
        );
      }
      return fixtureResult(
        {
          answer: `Test mode, not an AI answer: the most relevant passage is on ${top.unit} ${top.page}.`,
          insufficientEvidence: false,
          sources: [{ chunkId: top.label, quote: top.text.slice(0, 80) }],
          followUpQuestions: ['When is the next hearing?'],
        },
        COPILOT_PROMPT_VERSION,
      );
    },
    async translate({ text, to }) {
      return fixtureResult(`[Test translation to ${to}] ${text}`, TRANSLATE_PROMPT_VERSION);
    },
  };
}
