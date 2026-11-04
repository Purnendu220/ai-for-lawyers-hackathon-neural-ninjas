import { z } from 'zod';
import { SOURCE_UNITS } from '../enums';
import { FirestoreId } from './common';

/**
 * Output of Prompt C (blueprint §8). Strict and fully required for structured outputs; every
 * source must name one of the excerpts the model was given.
 */
export const CopilotAnswer = z.strictObject({
  answer: z.string(),
  insufficientEvidence: z.boolean(),
  sources: z.array(
    z.strictObject({
      /** The excerpt label the answer relies on, e.g. "c3". */
      chunkId: z.string(),
      /** Short verbatim quotation from that excerpt, or null. */
      quote: z.string().nullable(),
    }),
  ),
  followUpQuestions: z.array(z.string()),
});
export type CopilotAnswer = z.infer<typeof CopilotAnswer>;

export const AskCopilotInput = z.object({
  orgId: FirestoreId,
  caseId: FirestoreId,
  question: z.string().trim().min(3, 'Ask a longer question').max(1000, 'Keep the question under 1000 characters'),
});
export type AskCopilotInput = z.infer<typeof AskCopilotInput>;

export const CopilotSource = z.object({
  documentId: z.string(),
  fileName: z.string(),
  chunkId: z.string(),
  unit: z.enum(SOURCE_UNITS),
  page: z.number(),
  quote: z.string().nullable(),
  /** The quote was found in the cited passage. */
  verified: z.boolean(),
});
export type CopilotSource = z.infer<typeof CopilotSource>;

export const AskCopilotOutput = z.object({ messageId: z.string() });

export const TranslateSummaryInput = z.object({
  orgId: FirestoreId,
  caseId: FirestoreId,
  analysisId: FirestoreId,
});
export type TranslateSummaryInput = z.infer<typeof TranslateSummaryInput>;
export const TranslateSummaryOutput = z.object({ summaryHi: z.string() });

/** Output of the translation prompt. */
export const Translation = z.strictObject({ translation: z.string() });
