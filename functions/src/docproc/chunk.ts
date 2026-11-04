import type { DocumentPage } from '../ai/provider';

export type Chunk = {
  chunkId: string;
  documentId: string;
  page: number;
  /** Character offsets into the page text, so a citation can be highlighted exactly. */
  start: number;
  end: number;
  text: string;
};

type Span = { start: number; end: number };

/** Splits a span longer than `max` at the last whitespace before the limit. */
function splitLong(text: string, span: Span, max: number): Span[] {
  const pieces: Span[] = [];
  let start = span.start;
  while (span.end - start > max) {
    const window = text.slice(start, start + max);
    const cut = Math.max(window.lastIndexOf('. ') + 1, window.lastIndexOf(' '));
    const end = start + (cut > max / 2 ? cut : max);
    pieces.push({ start, end });
    start = end;
    while (start < span.end && /\s/.test(text.charAt(start))) start++;
  }
  if (start < span.end) pieces.push({ start, end: span.end });
  return pieces;
}

/** Paragraph spans of a page, with surrounding whitespace excluded. */
function paragraphs(text: string): Span[] {
  const spans: Span[] = [];
  const re = /\S[\s\S]*?(?=\n\s*\n|$)/g;
  for (let match = re.exec(text); match; match = re.exec(text)) {
    const start = match.index;
    let end = start + match[0].length;
    while (end > start && /\s/.test(text.charAt(end - 1))) end--;
    spans.push({ start, end });
  }
  return spans;
}

/**
 * Cuts each page into paragraph-aligned chunks of about `target` characters (never more than
 * `max`) for copilot retrieval (docs/ARCHITECTURE.md §5.4). Chunks never cross a page boundary.
 */
export function chunkPages(
  documentId: string,
  pages: DocumentPage[],
  { target = 1000, max = 1200 }: { target?: number; max?: number } = {},
): Chunk[] {
  const chunks: Chunk[] = [];
  for (const { page, text } of pages) {
    const spans = paragraphs(text).flatMap((span) => splitLong(text, span, max));
    let current: Span | null = null;
    const flush = () => {
      if (!current) return;
      chunks.push({
        chunkId: `${documentId}-p${page}-c${chunks.filter((c) => c.page === page).length + 1}`,
        documentId,
        page,
        start: current.start,
        end: current.end,
        text: text.slice(current.start, current.end),
      });
      current = null;
    };
    for (const span of spans) {
      if (current && (span.end - current.start > max || current.end - current.start >= target)) {
        flush();
      }
      current = current ? { start: current.start, end: span.end } : { ...span };
    }
    flush();
  }
  return chunks;
}
