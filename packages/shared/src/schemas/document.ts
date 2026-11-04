import { z } from 'zod';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, type AllowedMimeType } from '../constants';
import { FirestoreId } from './common';

const MIME_TYPES = Object.keys(ALLOWED_UPLOAD_TYPES) as [AllowedMimeType, ...AllowedMimeType[]];

export const StartUploadInput = z.object({
  orgId: FirestoreId,
  caseId: FirestoreId,
  fileName: z.string().trim().min(1, 'The file needs a name').max(255, 'The file name is too long'),
  mimeType: z.enum(MIME_TYPES, 'Upload a PDF or Word (.docx) file'),
  sizeBytes: z
    .number()
    .int()
    .min(1, 'This file is empty')
    .max(MAX_UPLOAD_BYTES, 'Files must be 15 MB or smaller'),
});
export type StartUploadInput = z.infer<typeof StartUploadInput>;

export const StartUploadOutput = z.object({ documentId: z.string(), storagePath: z.string() });

export const DocumentRef = z.object({
  orgId: FirestoreId,
  caseId: FirestoreId,
  documentId: FirestoreId,
});
export type DocumentRef = z.infer<typeof DocumentRef>;

export const AnalyzeDocumentOutput = z.object({ jobId: z.string() });

/** Body of the processDocument and runAnalysis tasks. */
export const DocumentTaskPayload = DocumentRef.extend({ jobId: FirestoreId });
export type DocumentTaskPayload = z.infer<typeof DocumentTaskPayload>;
