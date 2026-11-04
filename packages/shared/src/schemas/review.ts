import { z } from 'zod';
import { isDateOnly } from '../dates';
import { TASK_PRIORITIES } from '../enums';
import { FirestoreId } from './common';

export const REVIEW_ACTIONS = ['approve', 'edit', 'reject'] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export type ReviewItemKind = 'fact' | 'direction' | 'date' | 'task';

/** Item IDs are `fact-1`, `direction-2`, `date-3`, `task-4` (see toReviewItems). */
export const REVIEW_ITEM_ID = /^(fact|direction|date|task)-(\d{1,4})$/;

export function reviewItemKind(itemId: string): ReviewItemKind | null {
  return (REVIEW_ITEM_ID.exec(itemId)?.[1] as ReviewItemKind | undefined) ?? null;
}

const DateOnlyValue = z.string().refine(isDateOnly, 'Enter a valid date');

/**
 * What a reviewer may change. `text` edits a fact or direction; `title`, `description` and
 * `priority` edit a task; `date` sets a task's due date or an event's date; `assignedTo` assigns a
 * task. Fields that do not apply to the item are ignored.
 */
export const ReviewEdits = z.object({
  text: z.string().trim().min(1, 'Enter the text').max(2000).optional(),
  title: z.string().trim().min(1, 'Enter a title').max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  date: DateOnlyValue.nullable().optional(),
  assignedTo: FirestoreId.nullable().optional(),
});
export type ReviewEdits = z.infer<typeof ReviewEdits>;

export const ReviewDecision = z.object({
  itemId: z.string().regex(REVIEW_ITEM_ID, 'Unknown item'),
  action: z.enum(REVIEW_ACTIONS),
  /** Optional with 'approve' (to confirm a date or assign a task), required with 'edit'. */
  edits: ReviewEdits.optional(),
});
export type ReviewDecision = z.infer<typeof ReviewDecision>;

export const ReviewAnalysisInput = z.object({
  orgId: FirestoreId,
  caseId: FirestoreId,
  analysisId: FirestoreId,
  decisions: z.array(ReviewDecision).min(1).max(100),
});
export type ReviewAnalysisInput = z.infer<typeof ReviewAnalysisInput>;

export const ReviewAnalysisOutput = z.object({
  /** Decisions recorded by this call. Items that already had a decision are skipped. */
  applied: z.number(),
  skipped: z.number(),
  taskIds: z.array(z.string()),
  eventIds: z.array(z.string()),
});
export type ReviewAnalysisOutput = z.infer<typeof ReviewAnalysisOutput>;
