import type { Timestamp } from 'firebase/firestore';
import type {
  AnalysisDate,
  AnalysisDirection,
  AnalysisFact,
  AnalysisTask,
  ItemDecision,
  ReviewItemKind,
} from '@casepilot/shared';

export type ReviewItem =
  | { kind: 'fact'; item: AnalysisFact<Timestamp> }
  | { kind: 'direction'; item: AnalysisDirection<Timestamp> }
  | { kind: 'date'; item: AnalysisDate<Timestamp> }
  | { kind: 'task'; item: AnalysisTask<Timestamp> };

/**
 * Reasons an item needs a closer look. Items with any of these are left out of bulk approval and
 * must be decided one by one (docs/ARCHITECTURE.md §6.2).
 */
export function itemWarnings({ kind, item }: ReviewItem): string[] {
  const warnings: string[] = [];
  if (!item.sourceRef.verified) warnings.push('Quote not found in the document');
  if (kind === 'direction' && item.directionType === 'conditional') warnings.push('Conditional');
  if (kind === 'date' && item.basis !== 'explicit') warnings.push('Date needs to be worked out');
  if (kind === 'task' && item.dueDateBasis !== 'explicit' && item.dueDateBasis !== 'none') {
    warnings.push('Due date needs to be worked out');
  }
  if (kind === 'task' && item.condition) warnings.push('Conditional');
  return warnings;
}

export const DECISION_LABELS: Record<Exclude<ItemDecision, 'pending'>, string> = {
  approved: 'Approved',
  edited: 'Approved with edits',
  rejected: 'Rejected',
};

export const KIND_RESULT: Partial<Record<ReviewItemKind, string>> = {
  task: 'Added to tasks',
  date: 'Added to the timeline',
};
