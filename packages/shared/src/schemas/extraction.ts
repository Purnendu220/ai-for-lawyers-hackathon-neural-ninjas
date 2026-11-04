import { z } from 'zod';
import { DUE_DATE_BASES, LANGUAGES, TASK_PRIORITIES } from '../enums';

/**
 * Output of Prompt A (blueprint §8): what the model extracts from one court order.
 *
 * Built for OpenAI Structured Outputs in strict mode: every object is strict and every key is
 * required, so unknown values are `null` (never omitted) and unknown lists are `[]`.
 * Length and range limits are enforced after parsing, not in the schema sent to the model.
 */

/** Page (PDF) or section (DOCX) number, or null when the model cannot cite a source. */
const SourcePage = z.number().int().nullable();
/** Short verbatim quotation supporting the item, or null when unsupported. */
const SourceQuote = z.string().nullable();
/** 'YYYY-MM-DD', only when the text states the date unambiguously. */
const NormalizedDate = z.string().nullable();

export const DIRECTION_TYPES = ['explicit', 'conditional'] as const;

export const EXTRACTED_DATE_TYPES = [
  'order_date',
  'hearing',
  'filing_deadline',
  'compliance_deadline',
  'past_event',
  'other',
] as const;

export const ExtractedFact = z.strictObject({
  fact: z.string(),
  sourcePage: SourcePage,
  sourceQuote: SourceQuote,
});

export const ExtractedDirection = z.strictObject({
  direction: z.string(),
  /** 'conditional' when the direction depends on something else happening first. */
  directionType: z.enum(DIRECTION_TYPES),
  condition: z.string().nullable(),
  responsibleParty: z.string().nullable(),
  sourcePage: SourcePage,
  sourceQuote: SourceQuote,
});

export const ExtractedDate = z.strictObject({
  /** Exactly as written in the document, e.g. "within 14 days from the date of this order". */
  dateText: z.string(),
  normalizedDate: NormalizedDate,
  dateType: z.enum(EXTRACTED_DATE_TYPES),
  /** Anything other than 'explicit' needs a lawyer to work out the actual date. */
  basis: z.enum(DUE_DATE_BASES),
  sourcePage: SourcePage,
  sourceQuote: SourceQuote,
});

export const ProposedTask = z.strictObject({
  title: z.string(),
  description: z.string(),
  priority: z.enum(TASK_PRIORITIES),
  /** Only when the document states the due date explicitly; never inferred from a hearing date. */
  suggestedDueDate: NormalizedDate,
  dueDateBasis: z.enum(DUE_DATE_BASES),
  condition: z.string().nullable(),
  sourcePage: SourcePage,
  sourceQuote: SourceQuote,
});

export const Extraction = z.strictObject({
  documentSummary: z.string(),
  language: z.enum(LANGUAGES),
  caseDetails: z.strictObject({
    caseNumber: z.string().nullable(),
    courtName: z.string().nullable(),
    caseType: z.string().nullable(),
    parties: z.array(z.string()),
    dateOfOrder: NormalizedDate,
  }),
  facts: z.array(ExtractedFact),
  directions: z.array(ExtractedDirection),
  dates: z.array(ExtractedDate),
  proposedTasks: z.array(ProposedTask),
  /** Unclear, contradictory or missing text the lawyer should know about. */
  warnings: z.array(z.string()),
});

export type Extraction = z.infer<typeof Extraction>;
export type ExtractedFact = z.infer<typeof ExtractedFact>;
export type ExtractedDirection = z.infer<typeof ExtractedDirection>;
export type ExtractedDate = z.infer<typeof ExtractedDate>;
export type ProposedTask = z.infer<typeof ProposedTask>;
