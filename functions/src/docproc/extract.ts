import type { SourceUnit } from '@casepilot/shared';
import type { DocumentPage } from '../ai/provider';

export type ExtractedDocument = {
  sourceUnit: SourceUnit;
  pages: DocumentPage[];
  /** Codes such as `page_3_no_text`, shown to the reviewer. */
  warnings: string[];
  /** No page has usable text: the file is probably a scan (OCR is P2). */
  needsOcr: boolean;
};

/** Below this many non-space characters a page is treated as having no extractable text. */
const MIN_PAGE_CHARS = 20;
/** DOCX has no fixed pages, so its text is cut into numbered sections of about this size. */
const DOCX_SECTION_CHARS = 3000;

function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    // Any whitespace except newlines (including non-breaking spaces) becomes one space.
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function withTextWarnings(sourceUnit: SourceUnit, pages: DocumentPage[]): ExtractedDocument {
  const empty = pages.filter((p) => p.text.replace(/\s/g, '').length < MIN_PAGE_CHARS);
  return {
    sourceUnit,
    pages,
    warnings: empty.map((p) => `${sourceUnit}_${p.page}_no_text`),
    needsOcr: pages.length === 0 || empty.length === pages.length,
  };
}

export async function extractPdf(bytes: Uint8Array): Promise<ExtractedDocument> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  // pdf.js may detach the buffer it is given, so it gets a copy.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = text.map((pageText, i) => ({ page: i + 1, text: tidy(pageText) }));
  return withTextWarnings('page', pages);
}

export async function extractDocx(bytes: Uint8Array): Promise<ExtractedDocument> {
  const { default: mammoth } = await import('mammoth');
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  const paragraphs = tidy(value)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sections: DocumentPage[] = [];
  let current: string[] = [];
  let size = 0;
  for (const paragraph of paragraphs) {
    if (size > 0 && size + paragraph.length > DOCX_SECTION_CHARS) {
      sections.push({ page: sections.length + 1, text: current.join('\n\n') });
      current = [];
      size = 0;
    }
    current.push(paragraph);
    size += paragraph.length;
  }
  if (current.length > 0) sections.push({ page: sections.length + 1, text: current.join('\n\n') });
  return withTextWarnings('section', sections);
}
