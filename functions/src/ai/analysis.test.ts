import { describe, expect, it } from 'vitest';
import type { Extraction } from '@casepilot/shared';
import { toReviewItems } from './analysis';

const page = { page: 1, text: 'The matter is listed for the next hearing on 15 December 2026.' };

const extraction: Extraction = {
  documentSummary: 'Test',
  language: 'en',
  caseDetails: { caseNumber: null, courtName: null, caseType: null, parties: [], dateOfOrder: null },
  facts: [],
  directions: [],
  dates: [
    { dateText: '15 December 2026', normalizedDate: '2026-12-15', dateType: 'hearing', basis: 'explicit', sourcePage: 1, sourceQuote: 'next hearing on 15 December 2026' },
    { dateText: 'within 14 days', normalizedDate: '2026-11-16', dateType: 'filing_deadline', basis: 'relative_to_order', sourcePage: 1, sourceQuote: null },
  ],
  proposedTasks: [
    { title: 'Attend hearing', description: '', priority: 'high', suggestedDueDate: '2026-12-15', dueDateBasis: 'explicit', condition: null, sourcePage: 1, sourceQuote: 'next hearing on 15 December 2026' },
    { title: 'Arrange representative', description: '', priority: 'medium', suggestedDueDate: '2026-12-15', dueDateBasis: 'relative_to_hearing', condition: null, sourcePage: 1, sourceQuote: null },
  ],
  warnings: [],
};

describe('toReviewItems', () => {
  const items = toReviewItems(extraction, 'doc1', 'page', [page]);

  it('keeps dates the order states and clears dates the model worked out', () => {
    expect(items.dates.map((d) => d.normalizedDate)).toEqual(['2026-12-15', null]);
    expect(items.proposedTasks.map((t) => t.suggestedDueDate)).toEqual(['2026-12-15', null]);
    expect(items.proposedTasks[1]?.dueDateBasis).toBe('relative_to_hearing');
  });

  it('gives items stable IDs and leaves every decision pending', () => {
    expect(items.dates.map((d) => d.itemId)).toEqual(['date-1', 'date-2']);
    expect(items.proposedTasks.every((t) => t.decision === 'pending' && t.decidedBy === null)).toBe(true);
  });
});
