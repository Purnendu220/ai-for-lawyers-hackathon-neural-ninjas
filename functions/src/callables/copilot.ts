import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/https';
import {
  callables,
  paths,
  storagePaths,
  type AnalysisDoc,
  type CallableOutput,
  type CopilotAnswer,
  type CopilotSource,
  type DocumentDoc,
  type SourceUnit,
} from '@casepilot/shared';
import { anthropicApiKey, getAiProvider } from '../ai';
import { normalizeForMatch } from '../ai/citations';
import { cleanAnswer, COPILOT_PROMPT_VERSION } from '../ai/prompts/copilot.v2';
import type { AiResult } from '../ai/provider';
import { rank } from '../ai/retrieval';
import { audit } from '../core/audit';
import { requireAuth, requireMember } from '../core/authz';
import { PermanentJobError } from '../core/errors';
import { callableOptions, db } from '../core/firebase';
import { recordTokens, reserveAiUse } from '../core/quota';
import { parseInput } from '../core/validate';
import type { Chunk } from '../docproc/chunk';

type Passage = Chunk & { id: string; fileName: string; unit: SourceUnit };

const MAX_QUOTE_CHARS = 300;
const DEVANAGARI = /\p{Script=Devanagari}/u;

/** chunks.json per document version, kept for the life of the function instance. */
const chunkCache = new Map<string, Passage[]>();

async function loadPassages(orgId: string, caseId: string): Promise<Passage[]> {
  const ready = await db
    .collection(paths.documents(orgId, caseId))
    .where('processingStatus', '==', 'ready')
    .get();
  const bucket = getStorage().bucket();
  const perDocument = await Promise.all(
    ready.docs.map(async (snap) => {
      const doc = snap.data() as DocumentDoc<Timestamp>;
      const key = `${snap.id}:${doc.updatedAt?.toMillis() ?? 0}`;
      const cached = chunkCache.get(key);
      if (cached) return cached;
      const [contents] = await bucket.file(storagePaths.chunks(orgId, caseId, snap.id)).download();
      const passages = (JSON.parse(contents.toString('utf8')) as Chunk[]).map((chunk) => ({
        ...chunk,
        id: chunk.chunkId,
        fileName: doc.fileName,
        unit: doc.sourceUnit ?? 'page',
      }));
      if (chunkCache.size > 50) chunkCache.clear();
      chunkCache.set(key, passages);
      return passages;
    }),
  );
  return perDocument.flat();
}

/** Turns provider failures into errors the app can show. */
async function aiCall<T>(work: () => Promise<AiResult<T>>): Promise<AiResult<T>> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof PermanentJobError) throw new HttpsError('failed-precondition', error.userMessage);
    logger.error('copilot.ai_failed', { stack: (error as Error).stack?.split('\n').slice(0, 6).join('\n') });
    throw new HttpsError('unavailable', 'The AI service is busy. Try again in a moment.');
  }
}

async function requireQuota(orgId: string): Promise<void> {
  const exhausted = await reserveAiUse(orgId, 'copilotQuestions');
  if (exhausted !== null) {
    throw new HttpsError(
      'resource-exhausted',
      `This workspace has used its ${exhausted} AI questions for today. Try again tomorrow.`,
    );
  }
}

/**
 * Answers a question from the case's own documents (docs/ARCHITECTURE.md §5.7). Only retrieved
 * passages reach the model, and a source is kept only when it names one of them; its quote is
 * checked against that passage. The question, answer and sources are saved for the case team.
 */
export const askCaseCopilot = onCall(
  { ...callableOptions, timeoutSeconds: 120, memory: '512MiB', secrets: [anthropicApiKey] },
  async (req): Promise<CallableOutput<'askCaseCopilot'>> => {
    requireAuth(req);
    const input = parseInput(callables.askCaseCopilot.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'copilot.ask');
    const { caseId, question } = input;
    if (!(await db.doc(paths.case(ctx.orgId, caseId)).get()).exists) {
      throw new HttpsError('not-found', 'Case not found.');
    }
    await requireQuota(ctx.orgId);

    const provider = getAiProvider();
    const passages = await loadPassages(ctx.orgId, caseId);

    // Keyword search can't match a Hindi question to English documents, so search with both.
    let searchText = question;
    if (DEVANAGARI.test(question) && !passages.some((p) => DEVANAGARI.test(p.text))) {
      const translated = await aiCall(() => provider.translate({ text: question, to: 'en' }));
      searchText = `${question} ${translated.output}`;
    }
    const top = rank(passages, searchText, 8);
    const excerpts = top.map((p, i) => ({ label: `c${i + 1}`, unit: p.unit, page: p.page, text: p.text }));

    let result: AiResult<CopilotAnswer> | null = null;
    if (excerpts.length > 0) result = await aiCall(() => provider.answer({ question, excerpts }));
    const output: CopilotAnswer = result?.output ?? {
      answer:
        passages.length === 0
          ? 'There are no analysed documents in this case yet. Upload a court order first.'
          : 'The documents in this case do not appear to address this.',
      insufficientEvidence: true,
      sources: [],
      followUpQuestions: [],
    };

    const byLabel = new Map(excerpts.map((e, i) => [e.label, top[i] as Passage]));
    const seen = new Set<string>();
    const sources: CopilotSource[] = [];
    for (const source of output.sources) {
      const passage = byLabel.get(source.chunkId.trim());
      if (!passage || seen.has(passage.id)) continue;
      seen.add(passage.id);
      const quote = source.quote?.trim().slice(0, MAX_QUOTE_CHARS) || null;
      const needle = quote ? normalizeForMatch(quote) : '';
      sources.push({
        documentId: passage.documentId,
        fileName: passage.fileName,
        chunkId: passage.id,
        unit: passage.unit,
        page: passage.page,
        quote,
        verified: needle.length >= 8 && normalizeForMatch(passage.text).includes(needle),
      });
    }

    const ref = db.collection(paths.messages(ctx.orgId, caseId)).doc();
    const batch = db.batch();
    batch.create(ref, {
      question,
      answer: cleanAnswer(output.answer),
      insufficientEvidence: output.insufficientEvidence,
      unsupported: !output.insufficientEvidence && sources.length === 0,
      sources,
      followUpQuestions: output.followUpQuestions.slice(0, 3),
      mode: result?.mode ?? 'live',
      model: result?.model ?? 'none',
      promptVersion: COPILOT_PROMPT_VERSION,
      usage: result?.usage ?? null,
      latencyMs: result?.latencyMs ?? 0,
      createdBy: ctx.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    audit(batch, ctx, {
      action: 'copilot.asked',
      entityType: 'message',
      entityId: ref.id,
      caseId,
      metadata: { excerpts: excerpts.length, sources: sources.length, insufficientEvidence: output.insufficientEvidence },
    });
    await batch.commit();
    await recordTokens(ctx.orgId, result?.usage ?? null);
    logger.info('copilot.answered', {
      orgId: ctx.orgId,
      caseId,
      messageId: ref.id,
      passages: passages.length,
      excerpts: excerpts.length,
      sources: sources.length,
      unverified: sources.filter((s) => !s.verified).length,
      latencyMs: result?.latencyMs ?? 0,
      inputTokens: result?.usage?.inputTokens ?? null,
      outputTokens: result?.usage?.outputTokens ?? null,
    });
    return { messageId: ref.id };
  },
);

/** Hindi version of an analysis summary, made once and kept on the analysis. */
export const translateSummary = onCall(
  { ...callableOptions, timeoutSeconds: 120, secrets: [anthropicApiKey] },
  async (req): Promise<CallableOutput<'translateSummary'>> => {
    requireAuth(req);
    const input = parseInput(callables.translateSummary.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'copilot.ask');
    const ref = db.doc(paths.analysis(ctx.orgId, input.caseId, input.analysisId));
    const analysis = (await ref.get()).data() as AnalysisDoc<Timestamp> | undefined;
    if (!analysis) throw new HttpsError('not-found', 'Analysis not found.');
    if (analysis.summaryHi) return { summaryHi: analysis.summaryHi };

    await requireQuota(ctx.orgId);
    const result = await aiCall(() => getAiProvider().translate({ text: analysis.summary, to: 'hi' }));
    const batch = db.batch();
    batch.update(ref, { summaryHi: result.output, summaryHiMode: result.mode, summaryHiModel: result.model });
    audit(batch, ctx, {
      action: 'analysis.translated',
      entityType: 'analysis',
      entityId: input.analysisId,
      caseId: input.caseId,
      metadata: { language: 'hi' },
    });
    await batch.commit();
    await recordTokens(ctx.orgId, result.usage);
    return { summaryHi: result.output };
  },
);
