import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { logger } from 'firebase-functions';
import {
  FUNCTIONS_REGION,
  paths,
  type DocumentTaskPayload,
  type JobDoc,
  type JobType,
} from '@casepilot/shared';
import { db } from './firebase';

export { PermanentJobError } from './errors';

/** Attempts per job, matching each task queue's retryConfig.maxAttempts. */
export const JOB_MAX_ATTEMPTS = 3;

export const jobRef = (orgId: string, jobId: string) => db.doc(paths.job(orgId, jobId));

export const extractJobId = (documentId: string, run: number) => `${documentId}_extract_${run}`;

/** Task IDs allow only letters, digits, hyphens and underscores, so the prompt version's dot goes. */
export const analysisJobId = (documentId: string, promptVersion: string, run: number) =>
  `${documentId}_analyze_${promptVersion.replace(/[^A-Za-z0-9]/g, '-')}_${run}`;

export function newJob(
  type: JobType,
  fields: { caseId: string; documentId: string; run: number; requestedBy: string },
) {
  return {
    type,
    ...fields,
    status: 'queued',
    attempts: 0,
    leaseExpiresAt: null,
    queuedAt: FieldValue.serverTimestamp(),
    startedAt: null,
    completedAt: null,
    durationMs: null,
    errorCode: null,
  };
}

/**
 * Takes ownership of a queued job, or of one whose worker died (expired lease). Returns null when
 * another worker owns it or it is finished, so duplicate task deliveries do nothing. The lease
 * should equal the function timeout: a worker killed at its timeout has lost the lease by the time
 * Cloud Tasks retries, so the retry can claim the job.
 */
export async function claimJob(
  ref: DocumentReference,
  leaseMs: number,
): Promise<JobDoc<Timestamp> | null> {
  return db.runTransaction(async (tx) => {
    const job = (await tx.get(ref)).data() as JobDoc<Timestamp> | undefined;
    if (!job) return null;
    const leaseExpired =
      job.status === 'processing' && (job.leaseExpiresAt?.toMillis() ?? 0) < Date.now();
    if (job.status !== 'queued' && !leaseExpired) return null;
    tx.update(ref, {
      status: 'processing',
      attempts: FieldValue.increment(1),
      startedAt: FieldValue.serverTimestamp(),
      leaseExpiresAt: Timestamp.fromMillis(Date.now() + leaseMs),
    });
    return { ...job, attempts: job.attempts + 1 };
  });
}

export async function completeJob(ref: DocumentReference, startedMs: number): Promise<void> {
  await ref.update({
    status: 'succeeded',
    leaseExpiresAt: null,
    completedAt: FieldValue.serverTimestamp(),
    durationMs: Date.now() - startedMs,
    errorCode: null,
  });
}

/**
 * Records a failed attempt. Returns 'retry' when the task should be retried (the job goes back to
 * queued so the next delivery can claim it) or 'failed' when it is finished for good.
 */
export async function releaseJob(
  ref: DocumentReference,
  attempts: number,
  errorCode: string,
  permanent: boolean,
): Promise<'retry' | 'failed'> {
  const failed = permanent || attempts >= JOB_MAX_ATTEMPTS;
  await ref.update({
    status: failed ? 'failed' : 'queued',
    leaseExpiresAt: null,
    errorCode,
    ...(failed ? { completedAt: FieldValue.serverTimestamp() } : {}),
  });
  return failed ? 'failed' : 'retry';
}

/**
 * Queues a task. The task ID defaults to the job ID, so a repeated enqueue of the same job is
 * dropped; recovery passes a fresh one.
 */
export async function enqueue(
  functionName: 'processDocument' | 'runAnalysis',
  payload: DocumentTaskPayload,
  taskId: string = payload.jobId,
): Promise<void> {
  const queue = getFunctions().taskQueue<DocumentTaskPayload>(
    `locations/${FUNCTIONS_REGION}/functions/${functionName}`,
  );
  try {
    await queue.enqueue(payload, { id: taskId });
  } catch (error) {
    if ((error as { code?: string }).code === 'functions/task-already-exists') {
      logger.info('task.duplicate', { functionName, jobId: payload.jobId });
      return;
    }
    throw error;
  }
}
