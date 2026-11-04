import { unzipSync } from 'fflate';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@casepilot/shared';

export type FileKind = (typeof ALLOWED_UPLOAD_TYPES)[keyof typeof ALLOWED_UPLOAD_TYPES];

export type FileRejectionCode =
  | 'empty'
  | 'too_large'
  | 'unsupported_type'
  | 'type_mismatch'
  | 'encrypted_pdf'
  | 'invalid_docx'
  | 'docx_too_large';

export class FileRejectedError extends Error {
  constructor(
    readonly code: FileRejectionCode,
    message: string,
  ) {
    super(message);
    this.name = 'FileRejectedError';
  }
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04

/** Zip-bomb guards for DOCX: total unpacked size, entry count, and per-entry compression ratio. */
const DOCX_MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
const DOCX_MAX_ENTRIES = 2000;
const DOCX_MAX_RATIO = 100;

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, i) => bytes[i] === byte);
}

/** An encrypted PDF declares /Encrypt in its trailer or cross-reference stream dictionary. */
function isEncryptedPdf(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes('/Encrypt');
}

function inspectDocx(bytes: Uint8Array): void {
  const names = new Set<string>();
  let unpacked = 0;
  let suspicious = false;
  try {
    // The filter sees each entry's sizes from the zip directory; returning false skips inflating it.
    unzipSync(bytes, {
      filter(file) {
        names.add(file.name);
        unpacked += file.originalSize;
        if (file.originalSize > 1024 * 1024 && file.originalSize > file.size * DOCX_MAX_RATIO) {
          suspicious = true;
        }
        return false;
      },
    });
  } catch {
    throw new FileRejectedError('invalid_docx', 'This Word file is damaged or not a .docx file.');
  }
  if (suspicious || names.size > DOCX_MAX_ENTRIES || unpacked > DOCX_MAX_UNPACKED_BYTES) {
    throw new FileRejectedError('docx_too_large', 'This Word file expands to more data than allowed.');
  }
  if (!names.has('[Content_Types].xml') || !names.has('word/document.xml')) {
    throw new FileRejectedError('invalid_docx', 'This file is not a Word (.docx) document.');
  }
}

/**
 * Checks an upload's real content against its declared type (blueprint §4: MIME type alone is not
 * sufficient). Returns the file kind or throws FileRejectedError with a user-facing message.
 */
export function validateUpload(bytes: Uint8Array, declaredMimeType: string): FileKind {
  if (bytes.byteLength === 0) throw new FileRejectedError('empty', 'This file is empty.');
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new FileRejectedError('too_large', 'Files must be 15 MB or smaller.');
  }
  const kind = ALLOWED_UPLOAD_TYPES[declaredMimeType as keyof typeof ALLOWED_UPLOAD_TYPES];
  if (!kind) {
    throw new FileRejectedError('unsupported_type', 'Upload a PDF or Word (.docx) file.');
  }
  if (kind === 'pdf') {
    if (!startsWith(bytes, PDF_MAGIC)) {
      throw new FileRejectedError('type_mismatch', 'This file is not a real PDF.');
    }
    if (isEncryptedPdf(bytes)) {
      throw new FileRejectedError(
        'encrypted_pdf',
        'This PDF is password-protected. Upload a copy without a password.',
      );
    }
    return kind;
  }
  if (!startsWith(bytes, ZIP_MAGIC)) {
    throw new FileRejectedError('type_mismatch', 'This file is not a real Word (.docx) document.');
  }
  inspectDocx(bytes);
  return kind;
}
