import type { Extraction, SourceUnit } from '@casepilot/shared';
import { verifyCitation } from './citations';
import type { DocumentPage } from './provider';

type Cited = { sourcePage: number | null; sourceQuote: string | null };

/**
 * Turns a model extraction into reviewable items: each gets a stable item ID, a server-checked
 * source reference, and a pending decision. Nothing here is approved (blueprint §4 step 5).
 */
export function toReviewItems(
  extraction: Extraction,
  documentId: string,
  unit: SourceUnit,
  pages: DocumentPage[],
) {
  const review = <T extends Cited>(prefix: string, items: T[]) =>
    items.map(({ sourcePage, sourceQuote, ...item }, index) => ({
      ...item,
      itemId: `${prefix}-${index + 1}`,
      sourceRef: verifyCitation(documentId, unit, pages, sourcePage, sourceQuote),
      decision: 'pending' as const,
      decidedBy: null,
      decidedAt: null,
      resultEntityId: null,
    }));

  return {
    facts: review('fact', extraction.facts),
    directions: review('direction', extraction.directions),
    dates: review('date', extraction.dates),
    proposedTasks: review('task', extraction.proposedTasks),
  };
}
