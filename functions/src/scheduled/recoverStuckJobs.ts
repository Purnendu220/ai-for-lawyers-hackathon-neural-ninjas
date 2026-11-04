import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/scheduler';
import { APP_TIME_ZONE, type JobDoc } from '@casepilot/shared';
import { db } from '../core/firebase';
import { enqueue, JOB_MAX_ATTEMPTS } from '../core/jobs';

const QUEUED_TOO_LONG_MS = 30 * 60 * 1000;

/**
 * Every 15 minutes (docs/ARCHITECTURE.md §5.5):
 * - re-queues jobs whose worker died (lease expired) or that were queued but never dispatched,
 *   or fails them once their attempts are used up;
 * - closes upload reservations whose file never arrived.
 */
export const recoverStuckJobs = onSchedule(
  { schedule: 'every 15 minutes', timeZone: APP_TIME_ZONE, timeoutSeconds: 300 },
  async () => {
    const now = Timestamp.now();
    const [expired, neverRan, abandoned] = await Promise.all([
      db.collectionGroup('jobs').where('status', '==', 'processing').where('leaseExpiresAt', '<', now).limit(100).get(),
      db
        .collectionGroup('jobs')
        .where('status', '==', 'queued')
        .where('queuedAt', '<', Timestamp.fromMillis(now.toMillis() - QUEUED_TOO_LONG_MS))
        .limit(100)
        .get(),
      db
        .collectionGroup('documents')
        .where('processingStatus', '==', 'awaiting_upload')
        .where('uploadExpiresAt', '<', now)
        .limit(200)
        .get(),
    ]);

    let requeued = 0;
    let failed = 0;
    for (const snap of [...expired.docs, ...neverRan.docs]) {
      const job = snap.data() as JobDoc<Timestamp>;
      const orgId = snap.ref.parent.parent?.id;
      if (!orgId) continue;
      const documentRef = db.doc(`organizations/${orgId}/cases/${job.caseId}/documents/${job.documentId}`);
      if (job.attempts >= JOB_MAX_ATTEMPTS) {
        await snap.ref.update({ status: 'failed', leaseExpiresAt: null, errorCode: 'stuck', completedAt: FieldValue.serverTimestamp() });
        await documentRef.update({
          processingStatus: 'failed',
          errorCode: 'stuck',
          errorMessage: 'Processing stopped and could not be resumed. Try again.',
          updatedAt: FieldValue.serverTimestamp(),
        });
        failed++;
        continue;
      }
      await snap.ref.update({ status: 'queued', leaseExpiresAt: null, queuedAt: FieldValue.serverTimestamp() });
      // A fresh task ID: Cloud Tasks refuses to reuse the original one for a while.
      await enqueue(
        job.type === 'document_extract' ? 'processDocument' : 'runAnalysis',
        { orgId, caseId: job.caseId, documentId: job.documentId, jobId: snap.id },
        `${snap.id}-recovered-${now.toMillis()}`,
      );
      requeued++;
    }

    for (let i = 0; i < abandoned.docs.length; i += 400) {
      const batch = db.batch();
      for (const snap of abandoned.docs.slice(i, i + 400)) {
        batch.update(snap.ref, {
          processingStatus: 'failed',
          errorCode: 'upload_abandoned',
          errorMessage: "The upload didn't finish. Upload the file again.",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    logger.info('recovery.done', { requeued, failed, abandonedUploads: abandoned.size });
  },
);
