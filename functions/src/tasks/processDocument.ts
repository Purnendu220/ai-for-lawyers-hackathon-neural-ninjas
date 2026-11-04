import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onTaskDispatched } from 'firebase-functions/tasks';
import {
  DocumentTaskPayload,
  storagePaths,
  type DocumentDoc,
} from '@casepilot/shared';
import { EXTRACT_PROMPT_VERSION } from '../ai/prompts/extract.v1';
import { db } from '../core/firebase';
import {
  analysisJobId,
  enqueue,
  JOB_MAX_ATTEMPTS,
  jobRef,
  newJob,
  PermanentJobError,
} from '../core/jobs';
import { chunkPages } from '../docproc/chunk';
import { extractDocx, extractPdf, type ExtractedDocument } from '../docproc/extract';
import { runDocumentJob } from './documentJob';

const TIMEOUT_SECONDS = 300;

async function extract(record: DocumentDoc<Timestamp>, bytes: Uint8Array): Promise<ExtractedDocument> {
  try {
    return record.mimeType === 'application/pdf' ? await extractPdf(bytes) : await extractDocx(bytes);
  } catch {
    // Parsers fail the same way on every attempt, so this is not retried.
    throw new PermanentJobError(
      'unreadable_file',
      "CasePilot couldn't read this file. If it opens normally on your computer, save a fresh copy and upload that.",
    );
  }
}

/** Extracts per-page text and retrieval chunks, then queues the AI analysis. */
export const processDocument = onTaskDispatched(
  {
    retryConfig: { maxAttempts: JOB_MAX_ATTEMPTS, minBackoffSeconds: 60 },
    rateLimits: { maxConcurrentDispatches: 10 },
    memory: '1GiB',
    timeoutSeconds: TIMEOUT_SECONDS,
  },
  async (req) => {
    const payload = DocumentTaskPayload.parse(req.data);
    const { orgId, caseId, documentId } = payload;

    await runDocumentJob(payload, TIMEOUT_SECONDS * 1000, async ({ job, docRef }) => {
      const record = (await docRef.get()).data() as DocumentDoc<Timestamp> | undefined;
      if (!record) throw new PermanentJobError('not_found', 'This document no longer exists.');
      await docRef.update({ processingStatus: 'extracting', updatedAt: FieldValue.serverTimestamp() });

      const bucket = getStorage().bucket();
      const [contents] = await bucket.file(record.storagePath).download();
      const extracted = await extract(record, new Uint8Array(contents));
      if (extracted.needsOcr) {
        throw new PermanentJobError(
          'needs_ocr',
          "This file has no readable text. It may be a scanned image; scanned documents aren't supported yet.",
        );
      }

      const chunks = chunkPages(documentId, extracted.pages);
      const save = (path: string, data: unknown) =>
        bucket.file(path).save(JSON.stringify(data), { contentType: 'application/json', resumable: false });
      await Promise.all([
        save(storagePaths.pages(orgId, caseId, documentId), extracted.pages),
        save(storagePaths.chunks(orgId, caseId, documentId), chunks),
      ]);

      const run = record.analysisRun + 1;
      const nextJobId = analysisJobId(documentId, EXTRACT_PROMPT_VERSION, run);
      const batch = db.batch();
      batch.update(docRef, {
        processingStatus: 'analyzing',
        sourceUnit: extracted.sourceUnit,
        pageCount: extracted.pages.length,
        warnings: extracted.warnings,
        analysisRun: run,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(
        jobRef(orgId, nextJobId),
        newJob('document_analysis', { caseId, documentId, run, requestedBy: job.requestedBy }),
      );
      await batch.commit();
      await enqueue('runAnalysis', { orgId, caseId, documentId, jobId: nextJobId });
    });
  },
);
