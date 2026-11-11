import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  adminObjectStatus,
  call,
  createUser,
  deliverTask,
  downloadStatus,
  listDocs,
  readDoc,
  uploadObject,
  waitForDoc,
  warmUp,
  type TestUser,
} from './emulators';

const PDF = 'application/pdf';
const samplePdf = new Uint8Array(readFileSync(new URL('../../seed/samples/sample-order.pdf', import.meta.url)));
const finished = (doc: Record<string, unknown>) =>
  ['ready', 'failed', 'rejected'].includes(doc.processingStatus as string);

let owner: TestUser;
let outsider: TestUser;
let orgId: string;
let caseId: string;

async function upload(bytes: Uint8Array, declared = { mimeType: PDF, sizeBytes: bytes.byteLength }) {
  const { result, error } = await call(
    'startUpload',
    { orgId, caseId, fileName: 'Order 2 Nov 2026.pdf', ...declared },
    owner,
  );
  expect(error).toBeUndefined();
  const status = await uploadObject(result.storagePath, bytes, declared.mimeType, owner);
  return { ...(result as { documentId: string; storagePath: string }), status };
}

beforeAll(async () => {
  await warmUp(['createOrganization', 'createCase', 'startUpload', 'analyzeDocument']);
  [owner, outsider] = await Promise.all([createUser('doc-owner'), createUser('doc-outsider')]);
  orgId = (await call('createOrganization', { name: 'Docs Chambers', workspaceType: 'law_firm', defaultLanguage: 'en' }, owner)).result.orgId;
  await call('createOrganization', { name: 'Elsewhere', workspaceType: 'solo', defaultLanguage: 'en' }, outsider);
  caseId = (
    await call(
      'createCase',
      {
        orgId,
        fields: {
          title: 'ABC Traders v. XYZ Supplies',
          caseNumber: '',
          courtName: '',
          matterType: '',
          caseType: '',
          clientName: '',
          opposingParty: '',
          assignedLawyerIds: [],
        },
      },
      owner,
    )
  ).result.caseId;
});

describe('upload to analysis', () => {
  let documentId: string;
  let storagePath: string;
  let analysisId: string;

  it('turns an uploaded court order into an analysis waiting for review', async () => {
    const uploaded = await upload(samplePdf);
    expect(uploaded.status).toBe(200);
    ({ documentId, storagePath } = uploaded);

    const doc = await waitForDoc(`organizations/${orgId}/cases/${caseId}/documents/${documentId}`, owner, finished);
    expect(doc).toMatchObject({ processingStatus: 'ready', sourceUnit: 'page', pageCount: 1, errorCode: null });
    analysisId = doc.latestAnalysisId as string;

    const analysis = await readDoc(`organizations/${orgId}/cases/${caseId}/analyses/${analysisId}`, owner);
    expect(analysis).toMatchObject({ status: 'pending_review', mode: 'fixture', pagesAnalysed: 1 });
    expect(analysis.directions).toHaveLength(3);
    expect(analysis.proposedTasks).toHaveLength(3);
  });

  it('checks every citation against the page text', async () => {
    const analysis = await readDoc(`organizations/${orgId}/cases/${caseId}/analyses/${analysisId}`, owner);
    const facts = analysis.facts as { itemId: string; decision: string; sourceRef: { verified: boolean; page: number } }[];
    expect(facts.map((f) => f.sourceRef.verified)).toEqual([true, false]);
    for (const item of [...facts, ...(analysis.directions as typeof facts), ...(analysis.dates as typeof facts)]) {
      expect(item.decision).toBe('pending');
    }
    const directions = analysis.directions as typeof facts;
    expect(directions.every((d) => d.sourceRef.verified && d.sourceRef.page === 1)).toBe(true);
  });

  it('ignores a finished job delivered again instead of analysing twice', async () => {
    const jobsOf = async () =>
      (await listDocs(`organizations/${orgId}/jobs`, owner)).filter((job) => job.fields.documentId === documentId);
    const before = await jobsOf();
    expect(before.map((job) => [job.fields.type, job.fields.status, job.fields.attempts])).toEqual([
      ['document_analysis', 'succeeded', 1],
      ['document_extract', 'succeeded', 1],
    ]);
    for (const job of before) {
      const name = job.fields.type === 'document_extract' ? 'processDocument' : 'runAnalysis';
      expect(await deliverTask(name, { orgId, caseId, documentId, jobId: job.id })).toBe(204);
    }
    expect(await jobsOf()).toEqual(before);
    expect(await listDocs(`organizations/${orgId}/cases/${caseId}/analyses`, owner)).toHaveLength(1);
    const doc = await readDoc(`organizations/${orgId}/cases/${caseId}/documents/${documentId}`, owner);
    expect(doc).toMatchObject({ processingStatus: 'ready', latestAnalysisId: analysisId });
  });

  it('lets members open the original but nobody read the server-only text files', async () => {
    expect(await downloadStatus(storagePath, owner)).toBe(200);
    expect(await downloadStatus(storagePath, outsider)).toBe(403);
    expect(await downloadStatus(storagePath.replace(/original$/, 'pages.json'), owner)).toBe(403);
  });

  it('re-runs the analysis on request and supersedes the unreviewed one', async () => {
    const rerun = await call('analyzeDocument', { orgId, caseId, documentId }, owner);
    expect(rerun.error).toBeUndefined();
    const doc = await waitForDoc(
      `organizations/${orgId}/cases/${caseId}/documents/${documentId}`,
      owner,
      (d) => d.processingStatus === 'ready' && d.latestAnalysisId !== analysisId,
    );
    expect(doc.latestAnalysisId).toBe(rerun.result.jobId);
    const previous = await readDoc(`organizations/${orgId}/cases/${caseId}/analyses/${analysisId}`, owner);
    expect(previous.status).toBe('superseded');
  });
});

describe('upload checks', () => {
  it('rejects a file that is not really a PDF and deletes it', async () => {
    const fake = new TextEncoder().encode('MZ this is not a PDF at all');
    const uploaded = await upload(fake);
    expect(uploaded.status).toBe(200);
    const doc = await waitForDoc(`organizations/${orgId}/cases/${caseId}/documents/${uploaded.documentId}`, owner, finished);
    expect(doc).toMatchObject({ processingStatus: 'rejected', errorCode: 'type_mismatch' });
    // Members can no longer open it, and the file itself is gone.
    expect(await downloadStatus(uploaded.storagePath, owner)).toBe(403);
    expect(await adminObjectStatus(uploaded.storagePath)).toBe(404);
  });

  it('rejects a password-protected PDF with a message saying so', async () => {
    const encrypted = new TextEncoder().encode('%PDF-1.7\n1 0 obj <<>> endobj\ntrailer << /Root 1 0 R /Encrypt 5 0 R >>');
    const uploaded = await upload(encrypted);
    const doc = await waitForDoc(`organizations/${orgId}/cases/${caseId}/documents/${uploaded.documentId}`, owner, finished);
    expect(doc).toMatchObject({
      processingStatus: 'rejected',
      errorCode: 'encrypted_pdf',
      errorMessage: 'This PDF is password-protected. Upload a copy without a password.',
    });
    expect(await adminObjectStatus(uploaded.storagePath)).toBe(404);
  });

  it('stops at a PDF with no text instead of sending an empty document to the AI', async () => {
    const blank = new Uint8Array(readFileSync(new URL('../../seed/samples/blank-page.pdf', import.meta.url)));
    const uploaded = await upload(blank);
    const doc = await waitForDoc(`organizations/${orgId}/cases/${caseId}/documents/${uploaded.documentId}`, owner, finished);
    expect(doc).toMatchObject({ processingStatus: 'failed', errorCode: 'needs_ocr', latestAnalysisId: null });
    expect(doc.errorMessage).toMatch(/no readable text/);
  });

  it('refuses files over 15 MB before anything is uploaded', async () => {
    const { error } = await call(
      'startUpload',
      { orgId, caseId, fileName: 'huge.pdf', mimeType: PDF, sizeBytes: 15 * 1024 * 1024 + 1 },
      owner,
    );
    expect(error?.status).toBe('INVALID_ARGUMENT');
    expect(error?.details.issues).toEqual([{ path: 'sizeBytes', message: 'Files must be 15 MB or smaller' }]);
  });

  it('refuses uploads that do not match the reservation', async () => {
    const wrongSize = await upload(samplePdf, { mimeType: PDF, sizeBytes: samplePdf.byteLength + 1 });
    expect(wrongSize.status).toBe(403);
    const unreserved = await uploadObject(`orgs/${orgId}/cases/${caseId}/documents/made-up/original`, samplePdf, PDF, owner);
    expect(unreserved).toBe(403);
  });

  it('keeps other organizations from uploading to a case', async () => {
    const { error } = await call(
      'startUpload',
      { orgId, caseId, fileName: 'x.pdf', mimeType: PDF, sizeBytes: 10 },
      outsider,
    );
    expect(error?.status).toBe('PERMISSION_DENIED');
  });
});
