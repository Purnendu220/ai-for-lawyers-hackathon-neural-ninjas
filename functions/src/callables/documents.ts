import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/https';
import {
  callables,
  paths,
  storagePaths,
  type CallableOutput,
  type DocumentDoc,
} from '@casepilot/shared';
import { EXTRACT_PROMPT_VERSION } from '../ai/prompts/extract.v1';
import { audit } from '../core/audit';
import { requireAuth, requireCase, requireMember } from '../core/authz';
import { callableOptions, db } from '../core/firebase';
import { analysisJobId, enqueue, extractJobId, jobRef, newJob } from '../core/jobs';
import { parseInput } from '../core/validate';

/** A reservation not used within this window is treated as abandoned. */
const UPLOAD_WINDOW_MS = 30 * 60 * 1000;

/**
 * Reserves a document and its storage path. The client then uploads with the Storage SDK, and
 * Storage rules accept exactly one file there with the declared size and type
 * (docs/ARCHITECTURE.md §5.4).
 */
export const startUpload = onCall(
  callableOptions,
  async (req): Promise<CallableOutput<'startUpload'>> => {
    requireAuth(req);
    const input = parseInput(callables.startUpload.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'doc.upload');
    const ref = db.collection(paths.documents(ctx.orgId, input.caseId)).doc();
    const storagePath = storagePaths.original(ctx.orgId, input.caseId, ref.id);

    await db.runTransaction(async (tx) => {
      await requireCase(tx, ctx, input.caseId, { writable: true });
      const now = FieldValue.serverTimestamp();
      tx.create(ref, {
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storagePath,
        processingStatus: 'awaiting_upload',
        uploadedBy: ctx.uid,
        uploadedAt: now,
        uploadExpiresAt: Timestamp.fromMillis(Date.now() + UPLOAD_WINDOW_MS),
        sha256: null,
        duplicateOfDocumentId: null,
        sourceUnit: null,
        pageCount: null,
        warnings: [],
        errorCode: null,
        errorMessage: null,
        latestAnalysisId: null,
        extractRun: 1,
        analysisRun: 0,
        updatedAt: now,
      });
      audit(tx, ctx, {
        action: 'document.upload_started',
        entityType: 'document',
        entityId: ref.id,
        caseId: input.caseId,
        metadata: { mimeType: input.mimeType, sizeBytes: input.sizeBytes },
      });
    });

    return { documentId: ref.id, storagePath };
  },
);

/**
 * Retries a failed document or re-runs the analysis of a ready one. A document that never got as
 * far as extracted text is extracted again; otherwise only the AI analysis runs again.
 */
export const analyzeDocument = onCall(
  callableOptions,
  async (req): Promise<CallableOutput<'analyzeDocument'>> => {
    requireAuth(req);
    const input = parseInput(callables.analyzeDocument.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'ai.rerun');
    const docRef = db.doc(paths.document(ctx.orgId, input.caseId, input.documentId));

    const task = await db.runTransaction(async (tx) => {
      await requireCase(tx, ctx, input.caseId, { writable: true });
      const record = (await tx.get(docRef)).data() as DocumentDoc<Timestamp> | undefined;
      if (!record) throw new HttpsError('not-found', 'Document not found.');
      if (record.processingStatus === 'rejected') {
        throw new HttpsError('failed-precondition', 'This file was rejected. Upload a corrected file instead.');
      }
      if (record.processingStatus !== 'ready' && record.processingStatus !== 'failed') {
        throw new HttpsError('failed-precondition', 'This document is still being processed.');
      }

      const reExtract = record.pageCount === null;
      const run = (reExtract ? record.extractRun : record.analysisRun) + 1;
      const jobId = reExtract
        ? extractJobId(input.documentId, run)
        : analysisJobId(input.documentId, EXTRACT_PROMPT_VERSION, run);
      tx.update(docRef, {
        processingStatus: reExtract ? 'queued' : 'analyzing',
        [reExtract ? 'extractRun' : 'analysisRun']: run,
        errorCode: null,
        errorMessage: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        jobRef(ctx.orgId, jobId),
        newJob(reExtract ? 'document_extract' : 'document_analysis', {
          caseId: input.caseId,
          documentId: input.documentId,
          run,
          requestedBy: ctx.uid,
        }),
      );
      audit(tx, ctx, {
        action: 'analysis.requested',
        entityType: 'document',
        entityId: input.documentId,
        caseId: input.caseId,
        metadata: { stage: reExtract ? 'extract' : 'analyze', run },
      });
      return { jobId, functionName: reExtract ? ('processDocument' as const) : ('runAnalysis' as const) };
    });

    await enqueue(task.functionName, { ...input, orgId: ctx.orgId, jobId: task.jobId });
    return { jobId: task.jobId };
  },
);
