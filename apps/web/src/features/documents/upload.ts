import { ref, uploadBytesResumable } from 'firebase/storage';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, type AllowedMimeType } from '@casepilot/shared';
import { call } from '@/lib/callables';
import { storage } from '@/lib/firebase';

const BY_EXTENSION: Record<string, AllowedMimeType> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const ACCEPTED_FILES = '.pdf,.docx,' + Object.keys(ALLOWED_UPLOAD_TYPES).join(',');

/** Some browsers report an empty type for .docx, so the extension is the fallback. */
export function uploadType(file: File): AllowedMimeType | null {
  if (file.type in ALLOWED_UPLOAD_TYPES) return file.type as AllowedMimeType;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[extension] ?? null;
}

/** Quick checks before reserving an upload. The server checks the real content again. */
export function uploadProblem(file: File): string | null {
  if (!uploadType(file)) return 'Upload a PDF or Word (.docx) file.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Files must be 15 MB or smaller.';
  return null;
}

/**
 * Reserves the document, then uploads the file to the reserved path. Processing starts on the
 * server once the upload finishes; the document's status shows its progress from there.
 */
export async function uploadDocument(
  orgId: string,
  caseId: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const mimeType = uploadType(file);
  if (!mimeType) throw new Error('Unsupported file type');
  const { documentId, storagePath } = await call('startUpload', {
    orgId,
    caseId,
    fileName: file.name,
    mimeType,
    sizeBytes: file.size,
  });
  const task = uploadBytesResumable(ref(storage, storagePath), file, { contentType: mimeType });
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => onProgress(snapshot.bytesTransferred / snapshot.totalBytes),
      reject,
      () => resolve(),
    );
  });
  return documentId;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
