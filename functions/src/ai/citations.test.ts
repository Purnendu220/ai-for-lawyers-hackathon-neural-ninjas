import { describe, expect, it } from 'vitest';
import { normalizeForMatch, verifyCitation } from './citations';

const pages = [
  { page: 1, text: 'The plaintiff shall file its updated statement of account within 14 days.' },
  { page: 2, text: 'The matter is listed for the next hearing on 15 December 2026.' },
];
const check = (page: number | null, quote: string | null) =>
  verifyCitation('doc1', 'page', pages, page, quote);

describe('verifyCitation', () => {
  it('verifies a quote found on the cited page', () => {
    expect(check(2, 'next hearing on 15 December 2026')).toMatchObject({
      page: 2,
      verified: true,
      pageCorrected: false,
    });
  });

  it('corrects the page when the quote is on another page', () => {
    expect(check(1, 'listed for the next hearing')).toMatchObject({
      page: 2,
      verified: true,
      pageCorrected: true,
    });
  });

  it('ignores quote marks, dashes, case and line breaks', () => {
    expect(check(1, '“UPDATED statement\nof account” — within 14 days')).toMatchObject({ verified: true });
  });

  it('leaves invented, missing and too-short quotes unverified', () => {
    expect(check(1, 'the defendant shall pay costs of Rs. 50,000')).toMatchObject({ verified: false, page: 1 });
    expect(check(1, null)).toMatchObject({ verified: false, quote: null });
    expect(check(1, 'within')).toMatchObject({ verified: false });
  });

  it('drops a cited page that does not exist', () => {
    expect(check(9, 'no such text anywhere here')).toMatchObject({ page: null, verified: false });
  });
});

describe('normalizeForMatch', () => {
  it('keeps Devanagari vowel signs so Hindi quotes still match', () => {
    expect(normalizeForMatch('अगली सुनवाई')).toBe('अगली सुनवाई');
  });
});
