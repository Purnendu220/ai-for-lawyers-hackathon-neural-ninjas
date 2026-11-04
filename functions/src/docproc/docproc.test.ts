import { readFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { chunkPages } from './chunk';
import { extractDocx, extractPdf } from './extract';
import { FileRejectedError, validateUpload } from './validateFile';

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const sample = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../../seed/samples/${name}`, import.meta.url)));

function rejection(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof FileRejectedError) return error.code;
    throw error;
  }
  return undefined;
}

describe('validateUpload', () => {
  it('accepts the sample order as PDF and DOCX', () => {
    expect(validateUpload(sample('sample-order.pdf'), PDF)).toBe('pdf');
    expect(validateUpload(sample('sample-order.docx'), DOCX)).toBe('docx');
  });

  it('rejects files whose content does not match the declared type', () => {
    expect(rejection(() => validateUpload(sample('sample-order.docx'), PDF))).toBe('type_mismatch');
    expect(rejection(() => validateUpload(sample('sample-order.pdf'), DOCX))).toBe('type_mismatch');
    expect(rejection(() => validateUpload(strToU8('MZ fake exe'), PDF))).toBe('type_mismatch');
  });

  it('rejects empty files and other types', () => {
    expect(rejection(() => validateUpload(new Uint8Array(), PDF))).toBe('empty');
    expect(rejection(() => validateUpload(strToU8('hello'), 'text/plain'))).toBe('unsupported_type');
  });

  it('rejects password-protected PDFs', () => {
    const encrypted = strToU8('%PDF-1.7\n1 0 obj <<>> endobj\ntrailer << /Root 1 0 R /Encrypt 5 0 R >>');
    expect(rejection(() => validateUpload(encrypted, PDF))).toBe('encrypted_pdf');
  });

  it('rejects zip files that are not Word documents', () => {
    const zip = zipSync({ 'notes.txt': strToU8('not a docx') });
    expect(rejection(() => validateUpload(zip, DOCX))).toBe('invalid_docx');
  });

  it('rejects zip bombs before inflating them', () => {
    const bomb = zipSync(
      { '[Content_Types].xml': strToU8('<x/>'), 'word/document.xml': new Uint8Array(20 * 1024 * 1024) },
      { level: 9 },
    );
    expect(rejection(() => validateUpload(bomb, DOCX))).toBe('docx_too_large');
  });
});

describe('extraction', () => {
  it('extracts the sample order PDF page by page', async () => {
    const doc = await extractPdf(sample('sample-order.pdf'));
    expect(doc.sourceUnit).toBe('page');
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0]?.text).toContain('updated statement of account');
    expect(doc.pages[0]?.text).toContain('15 December 2026');
    expect(doc.needsOcr).toBe(false);
  });

  it('flags a PDF with no text as needing OCR', async () => {
    const doc = await extractPdf(sample('blank-page.pdf'));
    expect(doc.needsOcr).toBe(true);
    expect(doc.warnings).toEqual(['page_1_no_text']);
  });

  it('extracts the sample order DOCX as sections', async () => {
    const doc = await extractDocx(sample('sample-order.docx'));
    expect(doc.sourceUnit).toBe('section');
    expect(doc.pages[0]?.text).toContain('The defendant may file a response');
  });
});

describe('chunkPages', () => {
  const paragraph = (n: number) => `Paragraph ${n}. ${'The court directs the parties to comply. '.repeat(8)}`;
  const text = Array.from({ length: 12 }, (_, i) => paragraph(i + 1)).join('\n\n');
  const chunks = chunkPages('doc1', [{ page: 1, text }, { page: 2, text: 'Short page.' }]);

  it('keeps chunks within the size limit and on one page', () => {
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(1200);
      expect(chunk.text.length).toBeGreaterThan(0);
    }
    expect(chunks.at(-1)).toMatchObject({ page: 2, text: 'Short page.' });
  });

  it('records offsets that map back to the page text', () => {
    for (const chunk of chunks.filter((c) => c.page === 1)) {
      expect(text.slice(chunk.start, chunk.end)).toBe(chunk.text);
    }
  });

  it('gives every chunk a unique id', () => {
    expect(new Set(chunks.map((c) => c.chunkId)).size).toBe(chunks.length);
  });

  it('splits a single paragraph longer than the limit', () => {
    const long = chunkPages('doc2', [{ page: 1, text: 'word '.repeat(1000).trim() }]);
    expect(long.length).toBeGreaterThan(3);
    expect(Math.max(...long.map((c) => c.text.length))).toBeLessThanOrEqual(1200);
  });
});
