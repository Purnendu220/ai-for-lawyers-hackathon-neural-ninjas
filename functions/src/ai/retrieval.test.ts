import { describe, expect, it } from 'vitest';
import { rank } from './retrieval';

const passages = [
  { id: 'p1', text: 'The plaintiff shall file its updated statement of account within 14 days.' },
  { id: 'p2', text: 'The matter is listed for the next hearing on 15 December 2026.' },
  { id: 'p3', text: 'Both parties shall ensure their authorized representatives are available.' },
];

describe('rank', () => {
  it('puts the passage that answers the question first', () => {
    expect(rank(passages, 'When is the next hearing?')[0]?.id).toBe('p2');
    expect(rank(passages, 'What must the plaintiff file?')[0]?.id).toBe('p1');
  });

  it('ignores case, punctuation and stop words', () => {
    expect(rank(passages, 'STATEMENT of ACCOUNT!!')[0]?.id).toBe('p1');
    expect(rank(passages, 'what is the')).toEqual([]);
  });

  it('returns nothing when no word matches', () => {
    expect(rank(passages, 'costs imposed on the defendant')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(rank(passages, 'shall', 1)).toHaveLength(1);
  });
});
