import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { CopilotAnswer, Extraction, Translation } from '@casepilot/shared';
import { PermanentJobError } from '../core/errors';
import { buildCopilotInput, COPILOT_PROMPT_VERSION, COPILOT_SYSTEM_PROMPT } from './prompts/copilot.v2';
import { buildExtractionInput, EXTRACT_PROMPT_VERSION, EXTRACT_SYSTEM_PROMPT } from './prompts/extract.v1';
import { TRANSLATE_PROMPT_VERSION, translateSystemPrompt } from './prompts/translate.v1';
import type { AiProvider, AiResult } from './provider';

export const AI_MODEL = 'claude-opus-5-5';

type Effort = 'low' | 'medium' | 'high';

/**
 * Claude via the Anthropic API (docs/ARCHITECTURE.md §6.1). Structured output keeps each reply in
 * its Zod shape; the reply is validated again with Zod, and callers check citations against the
 * source text afterwards, because a well-formed reply can still be wrong.
 */
export function createAnthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 5 * 60 * 1000 });

  async function run<S extends z.ZodType>(
    schema: S,
    system: string,
    user: string,
    effort: Effort,
    promptVersion: string,
  ): Promise<AiResult<z.output<S>>> {
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
        output_config: { effort, format: betaZodOutputFormat(schema) },
        system,
        messages: [{ role: 'user', content: user }],
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
          'The AI service could not process this request. An administrator has been told.',
        );
      }
      throw error; // Rate limits, overload and network errors: retried by the caller.
    }

    if (response.stop_reason === 'refusal') {
      throw new PermanentJobError('ai_refused', 'The AI declined this request. Review the documents yourself.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new PermanentJobError(
        'ai_output_too_long',
        'The answer was longer than one AI reply can hold. Split the document or narrow the question.',
      );
    }
    if (!response.parsed_output) throw new Error('Model reply did not match the expected schema');

    return {
      output: schema.parse(response.parsed_output) as z.output<S>,
      mode: 'live',
      model: response.model,
      promptVersion,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      latencyMs: Date.now() - started,
    };
  }

  return {
    // Accuracy matters more than speed for legal directions and dates.
    extract: (request) =>
      run(Extraction, EXTRACT_SYSTEM_PROMPT, buildExtractionInput(request), 'high', EXTRACT_PROMPT_VERSION),
    answer: (request) =>
      run(CopilotAnswer, COPILOT_SYSTEM_PROMPT, buildCopilotInput(request), 'high', COPILOT_PROMPT_VERSION),
    // Faithful translation is a simple task; low effort keeps it quick.
    translate: async (request) => {
      const result = await run(
        Translation,
        translateSystemPrompt(request.to),
        request.text,
        'low',
        TRANSLATE_PROMPT_VERSION,
      );
      return { ...result, output: result.output.translation };
    },
  };
}
