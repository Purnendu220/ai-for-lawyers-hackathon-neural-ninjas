import { FieldValue, type DocumentReference, type Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { paths, type DocumentTaskPayload, type JobDoc } from '@casepilot/shared';
import { db } from '../core/firebase';
import { claimJob, completeJob, jobRef, PermanentJobError, releaseJob } from '../core/jobs';

export type DocumentJobContext = {
  job: JobDoc<Timestamp>;
  docRef: DocumentReference;
};

const RETRIES_EXHAUSTED = 'Processing failed after several attempts. Try again in a few minutes.';

/**
 * Runs one attempt of a document job: claims it, does the work, and records the outcome. A
 * permanent error or the last attempt marks the document failed and ends the task; any other
 * error is rethrown so Cloud Tasks retries it.
 */
export async function runDocumentJob(
  payload: DocumentTaskPayload,
  leaseMs: number,
  work: (context: DocumentJobContext) => Promise<void>,
): Promise<void> {
  const ref = jobRef(payload.orgId, payload.jobId);
  const job = await claimJob(ref, leaseMs);
  const ids = { orgId: payload.orgId, caseId: payload.caseId, documentId: payload.documentId, jobId: payload.jobId };
  if (!job) {
    logger.info('job.skipped', ids);
    return;
  }
  const docRef = db.doc(paths.document(payload.orgId, payload.caseId, payload.documentId));
  const started = Date.now();

  try {
    await work({ job, docRef });
    await completeJob(ref, started);
    logger.info('job.succeeded', { ...ids, type: job.type, attempt: job.attempts, durationMs: Date.now() - started });
  } catch (error) {
    const permanent = error instanceof PermanentJobError;
    const code = permanent ? error.code : 'internal';
    // Only codes and stack traces are logged: errors from the AI provider can echo document text.
    logger.error('job.failed', {
      ...ids,
      type: job.type,
      attempt: job.attempts,
      code,
      stack: permanent ? undefined : (error as Error).stack?.split('\n').slice(0, 6).join('\n'),
    });
    const outcome = await releaseJob(ref, job.attempts, code, permanent);
    if (outcome === 'retry') throw error;
    await docRef.update({
      processingStatus: 'failed',
      errorCode: code,
      errorMessage: permanent ? error.userMessage : RETRIES_EXHAUSTED,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
