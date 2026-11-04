import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Extraction } from '@casepilot/shared';
import { PermanentJobError } from '../core/errors';
import { buildExtractionInput, EXTRACT_PROMPT_VERSION, EXTRACT_SYSTEM_PROMPT } from './prompts/extract.v1';
import type { AiProvider } from './provider';

export const AI_MODEL = 'claude-opus-5-5';

/**
 * Claude via the Anthropic API (docs/ARCHITECTURE.md §6.1). Structured output keeps the reply in
 * the Extraction shape; the reply is validated again with Zod and every citation is checked against
 * the page text afterwards, because a well-formed reply can still be wrong.
 */
export function createAnthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 5 * 60 * 1000 });

  return {
    async extract(request) {
      const started = Date.now();
      let response;
      try {
        response = await client.beta.messages.parse({
          model: AI_MODEL,
          max_tokens: 16000,
          // On a safety decline, the API retries the request on a fallback model it picks by
          // refusal category; response.model then names the model that answered.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          // Accuracy matters more than speed for legal directions and dates.
          output_config: { effort: 'high', format: betaZodOutputFormat(Extraction) },
          system: EXTRACT_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildExtractionInput(request) }],
        });
      } catch (error) {
        // Bad requests and auth problems fail the same way on every attempt.
        if (
          error instanceof Anthropic.BadRequestError ||
          error instanceof Anthropic.AuthenticationError ||
          error instanceof Anthropic.PermissionDeniedError
        ) {
          throw new PermanentJobError(
            'ai_request_rejected',
            'The AI service could not process this document. An administrator has been told.',
          );
        }
        throw error; // Rate limits, overload and network errors: retried by the task queue.
      }

      if (response.stop_reason === 'refusal') {
        throw new PermanentJobError(
          'ai_refused',
          'The AI declined to analyse this document. Review it manually.',
        );
      }
      if (response.stop_reason === 'max_tokens') {
        throw new PermanentJobError(
          'ai_output_too_long',
          'This document produced more findings than one analysis can hold. Split it and upload the parts.',
        );
      }
      if (!response.parsed_output) throw new Error('Model reply did not match the extraction schema');

      return {
        output: Extraction.parse(response.parsed_output),
        mode: 'live',
        model: response.model,
        promptVersion: EXTRACT_PROMPT_VERSION,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        latencyMs: Date.now() - started,
      };
    },
  };
}
