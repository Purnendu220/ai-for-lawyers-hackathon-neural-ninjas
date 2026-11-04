import { createHash } from 'node:crypto';
import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { onObjectFinalized } from 'firebase-functions/storage';
import { ORIGINAL_UPLOAD_PATH, paths, type DocumentDoc } from '@casepilot/shared';
import { audit } from '../core/audit';
import { db } from '../core/firebase';
import { enqueue, extractJobId, jobRef, newJob } from '../core/jobs';
import { FileRejectedError, validateUpload } from '../docproc/validateFile';

/**
 * Runs for every object written to the default bucket, including the server's own pages.json and
 * chunks.json, so it only acts on an `original` upload that matches a reservation still waiting
 * for its file. Anything else is ignored, which also makes repeated events harmless.
 */
export const onUploadFinalized = onObjectFinalized(
  { memory: '512MiB', timeoutSeconds: 120 },
  async (event) => {
    const match = ORIGINAL_UPLOAD_PATH.exec(event.data.name);
    if (!match) return;
    const [, orgId = '', caseId = '', documentId = ''] = match;
    const docRef = db.doc(paths.document(orgId, caseId, documentId));
    const record = (await docRef.get()).data() as DocumentDoc<Timestamp> | undefined;
    if (record?.processingStatus !== 'awaiting_upload') return;

    const file = getStorage().bucket(event.data.bucket).file(event.data.name);
    const [contents] = await file.download();
    const bytes = new Uint8Array(contents);
    const actor = { uid: record.uploadedBy, orgId };

    try {
      if (bytes.byteLength !== record.sizeBytes) {
        throw new FileRejectedError('type_mismatch', 'The uploaded file does not match what was declared.');
      }
      validateUpload(bytes, record.mimeType);
    } catch (error) {
      if (!(error instanceof FileRejectedError)) throw error;
      const batch = db.batch();
      batch.update(docRef, {
        processingStatus: 'rejected',
        errorCode: error.code,
        errorMessage: error.message,
        updatedAt: FieldValue.serverTimestamp(),
      });
      audit(batch, actor, {
        action: 'document.rejected',
        entityType: 'document',
        entityId: documentId,
        caseId,
        metadata: { code: error.code },
      });
      await batch.commit();
      await file.delete({ ignoreNotFound: true });
      logger.info('document.rejected', { orgId, caseId, documentId, code: error.code });
      return;
    }

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const same = await db
      .collection(paths.documents(orgId, caseId))
      .where('sha256', '==', sha256)
      .limit(1)
      .get();
    const jobId = extractJobId(documentId, record.extractRun);

    const batch = db.batch();
    batch.update(docRef, {
      processingStatus: 'queued',
      sha256,
      duplicateOfDocumentId: same.docs[0]?.id ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(
      jobRef(orgId, jobId),
      newJob('document_extract', { caseId, documentId, run: record.extractRun, requestedBy: record.uploadedBy }),
    );
    audit(batch, actor, {
      action: 'document.uploaded',
      entityType: 'document',
      entityId: documentId,
      caseId,
      metadata: { mimeType: record.mimeType, sizeBytes: record.sizeBytes },
    });
    await batch.commit();
    await enqueue('processDocument', { orgId, caseId, documentId, jobId });
    logger.info('document.queued', { orgId, caseId, documentId, jobId });
  },
);
