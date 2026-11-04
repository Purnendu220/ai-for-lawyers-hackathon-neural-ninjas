import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { onTaskDispatched } from 'firebase-functions/tasks';
import {
  DocumentTaskPayload,
  MAX_ANALYSED_PAGES,
  pagesTruncatedWarning,
  paths,
  storagePaths,
  type AnalysisDoc,
  type DocumentDoc,
} from '@casepilot/shared';
import { toReviewItems } from '../ai/analysis';
import { anthropicApiKey, getAiProvider } from '../ai';
import type { DocumentPage } from '../ai/provider';
import { audit } from '../core/audit';
import { db } from '../core/firebase';
import { JOB_MAX_ATTEMPTS, PermanentJobError } from '../core/jobs';
import { recordTokens, reserveAnalysis } from '../core/quota';
import { runDocumentJob } from './documentJob';

const TIMEOUT_SECONDS = 540;

/**
 * Runs Prompt A on the extracted text and saves the result as an analysis waiting for review.
 * The analysis ID is the job ID, so a retried attempt overwrites instead of duplicating.
 */
export const runAnalysis = onTaskDispatched(
  {
    retryConfig: { maxAttempts: JOB_MAX_ATTEMPTS, minBackoffSeconds: 60 },
    // Bounds concurrent model calls across all workspaces.
    rateLimits: { maxConcurrentDispatches: 5 },
    memory: '512MiB',
    timeoutSeconds: TIMEOUT_SECONDS,
    secrets: [anthropicApiKey],
  },
  async (req) => {
    const payload = DocumentTaskPayload.parse(req.data);
    const { orgId, caseId, documentId, jobId } = payload;

    await runDocumentJob(payload, TIMEOUT_SECONDS * 1000, async ({ job, docRef }) => {
      const record = (await docRef.get()).data() as DocumentDoc<Timestamp> | undefined;
      if (!record?.sourceUnit || !record.sha256) {
        throw new PermanentJobError('not_extracted', 'This document has no extracted text yet.');
      }

      const [contents] = await getStorage().bucket().file(storagePaths.pages(orgId, caseId, documentId)).download();
      const pages = JSON.parse(contents.toString('utf8')) as DocumentPage[];
      const analysed = pages.slice(0, MAX_ANALYSED_PAGES);

      await reserveAnalysis(orgId);
      const result = await getAiProvider().extract({
        documentId,
        sha256: record.sha256,
        sourceUnit: record.sourceUnit,
        pages: analysed,
      });
      const { output } = result;
      const items = toReviewItems(output, documentId, record.sourceUnit, analysed);

      const analysis: Omit<AnalysisDoc<Timestamp>, 'createdAt'> = {
        orgId,
        caseId,
        documentId,
        status: 'pending_review',
        mode: result.mode,
        model: result.model,
        promptVersion: result.promptVersion,
        summary: output.documentSummary,
        language: output.language,
        caseDetails: output.caseDetails,
        ...items,
        warnings: [
          ...(pages.length > analysed.length ? [pagesTruncatedWarning(analysed.length, pages.length)] : []),
          ...output.warnings,
        ],
        pagesAnalysed: analysed.length,
        pageCount: pages.length,
        usage: result.usage,
        latencyMs: result.latencyMs,
        reviewedBy: null,
        reviewedAt: null,
      };

      const batch = db.batch();
      batch.set(db.doc(paths.analysis(orgId, caseId, jobId)), {
        ...analysis,
        createdAt: FieldValue.serverTimestamp(),
      });
      // An earlier analysis nobody has started reviewing is replaced by this one.
      if (record.latestAnalysisId && record.latestAnalysisId !== jobId) {
        const previous = db.doc(paths.analysis(orgId, caseId, record.latestAnalysisId));
        const prior = (await previous.get()).data() as AnalysisDoc<Timestamp> | undefined;
        if (prior?.status === 'pending_review') batch.update(previous, { status: 'superseded' });
      }
      batch.update(docRef, {
        processingStatus: 'ready',
        latestAnalysisId: jobId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      audit(batch, { uid: job.requestedBy, orgId }, {
        action: 'analysis.created',
        entityType: 'analysis',
        entityId: jobId,
        caseId,
        metadata: { mode: result.mode, model: result.model, promptVersion: result.promptVersion },
      });
      await batch.commit();
      await recordTokens(orgId, result.usage);

      const unverified = [...items.facts, ...items.directions, ...items.dates, ...items.proposedTasks].filter(
        (item) => !item.sourceRef.verified,
      ).length;
      logger.info('analysis.done', {
        orgId,
        caseId,
        documentId,
        jobId,
        mode: result.mode,
        model: result.model,
        pages: analysed.length,
        items: items.facts.length + items.directions.length + items.dates.length + items.proposedTasks.length,
        unverified,
        latencyMs: result.latencyMs,
        inputTokens: result.usage?.inputTokens ?? null,
        outputTokens: result.usage?.outputTokens ?? null,
      });
    });
  },
);
