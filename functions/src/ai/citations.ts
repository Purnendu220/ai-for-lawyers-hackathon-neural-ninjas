import type { SourceRef, SourceUnit } from '@casepilot/shared';
import type { DocumentPage } from './provider';

const MAX_QUOTE_CHARS = 300;
/** Shorter quotes match too easily to prove anything. */
const MIN_QUOTE_CHARS = 8;

/**
 * Compares text by letters, marks and digits only, so curly quotes, dashes, line breaks and
 * spacing differences between the PDF text and the model's quote do not matter.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Checks a model citation against the document text (docs/ARCHITECTURE.md §6.2). A quote found on
 * the cited page is verified; one found on another page is verified with the page corrected; a
 * missing or unfound quote stays unverified and is flagged for the reviewer.
 */
export function verifyCitation(
  documentId: string,
  unit: SourceUnit,
  pages: DocumentPage[],
  sourcePage: number | null,
  sourceQuote: string | null,
): SourceRef {
  const quote = sourceQuote?.trim().slice(0, MAX_QUOTE_CHARS) || null;
  const cited = pages.some((p) => p.page === sourcePage) ? sourcePage : null;
  const unverified: SourceRef = {
    documentId,
    unit,
    page: cited,
    quote,
    verified: false,
    pageCorrected: false,
  };
  const needle = quote ? normalizeForMatch(quote) : '';
  if (needle.length < MIN_QUOTE_CHARS) return unverified;

  const onPage = (page: DocumentPage) => normalizeForMatch(page.text).includes(needle);
  const citedPage = pages.find((p) => p.page === cited);
  if (citedPage && onPage(citedPage)) return { ...unverified, verified: true };
  const elsewhere = pages.find(onPage);
  if (elsewhere) return { ...unverified, page: elsewhere.page, verified: true, pageCorrected: true };
  return unverified;
}
