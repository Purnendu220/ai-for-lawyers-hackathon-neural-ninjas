import { beforeAll, describe, expect, it } from 'vitest';
import {
  analyseSample,
  call,
  createUser,
  emptyCaseFields,
  listDocs,
  readDoc,
  readStatus,
  warmUp,
  type TestUser,
} from './emulators';

// The emulator runs the fixture provider: copilot answers quote the top retrieved passage and are
// marked as test stand-ins, so these tests check retrieval, source checks and storage, not the model.

let owner: TestUser;
let viewer: TestUser;
let orgId: string;
let caseId: string;
let analysisId: string;

const ask = (question: string, user: TestUser = owner, onCase = caseId) =>
  call('askCaseCopilot', { orgId, caseId: onCase, question }, user);
const message = (id: string, onCase = caseId) => readDoc(`organizations/${orgId}/cases/${onCase}/messages/${id}`, owner);

beforeAll(async () => {
  await warmUp(['createOrganization', 'createCase', 'startUpload', 'askCaseCopilot', 'translateSummary', 'inviteMember', 'acceptInvitation']);
  [owner, viewer] = await Promise.all([createUser('copilot-owner'), createUser('copilot-viewer')]);
  orgId = (await call('createOrganization', { name: 'Copilot Chambers', workspaceType: 'law_firm', defaultLanguage: 'en' }, owner)).result.orgId;
  const invite = await call('inviteMember', { orgId, email: viewer.email, role: 'viewer' }, owner);
  await call('acceptInvitation', { orgId, inviteId: invite.result.inviteId }, viewer);
  caseId = (await call('createCase', { orgId, fields: emptyCaseFields('ABC Traders v. XYZ Supplies') }, owner)).result.caseId;
  analysisId = await analyseSample(orgId, caseId, owner);
});

describe('askCaseCopilot', () => {
  it('answers from the case documents with a source checked against the passage', async () => {
    const { result, error } = await ask('When is the next hearing?');
    expect(error).toBeUndefined();
    const saved = await message(result.messageId);
    expect(saved).toMatchObject({
      question: 'When is the next hearing?',
      insufficientEvidence: false,
      unsupported: false,
      mode: 'fixture',
      createdBy: owner.uid,
    });
    const [source] = saved.sources as { page: number; verified: boolean; fileName: string; unit: string }[];
    expect(source).toMatchObject({ page: 1, unit: 'page', verified: true, fileName: 'sample-order.pdf' });
  });

  it('says so instead of answering when no passage matches', async () => {
    const { result } = await ask('zebra unicorn telescope');
    expect(await message(result.messageId)).toMatchObject({ insufficientEvidence: true, sources: [], model: 'none' });
  });

  it('says there is nothing to search on a case without documents', async () => {
    const emptyCase = (await call('createCase', { orgId, fields: emptyCaseFields('Empty case') }, owner)).result.caseId;
    const { result } = await ask('When is the next hearing?', owner, emptyCase);
    const saved = await message(result.messageId, emptyCase);
    expect(saved.insufficientEvidence).toBe(true);
    expect(saved.answer).toMatch(/no analysed documents/);
  });

  it('accepts questions in Hindi', async () => {
    const { error } = await ask('अगली सुनवाई कब है?');
    expect(error).toBeUndefined();
  });

  it('lets viewers read the answers but not ask', async () => {
    const { error } = await ask('When is the next hearing?', viewer);
    expect(error?.status).toBe('PERMISSION_DENIED');
    const messages = await listDocs(`organizations/${orgId}/cases/${caseId}/messages`, owner);
    expect(await readStatus(`organizations/${orgId}/cases/${caseId}/messages/${messages[0]!.id}`, viewer)).toBe(200);
  });

  it('rejects questions that are too short', async () => {
    const { error } = await ask('hi');
    expect(error?.status).toBe('INVALID_ARGUMENT');
  });

  it('audits each question without storing its text in the log', async () => {
    const logs = await listDocs(`organizations/${orgId}/auditLogs`, owner);
    const asked = logs.filter((l) => l.fields.action === 'copilot.asked');
    expect(asked.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(asked)).not.toContain('next hearing');
  });
});

describe('translateSummary', () => {
  it('stores a Hindi summary once and returns it again', async () => {
    const first = await call('translateSummary', { orgId, caseId, analysisId }, owner);
    expect(first.result.summaryHi).toMatch(/^\[Test translation to hi\]/);
    const analysis = await readDoc(`organizations/${orgId}/cases/${caseId}/analyses/${analysisId}`, owner);
    expect(analysis).toMatchObject({ summaryHi: first.result.summaryHi, summaryHiMode: 'fixture' });
    const second = await call('translateSummary', { orgId, caseId, analysisId }, owner);
    expect(second.result.summaryHi).toBe(first.result.summaryHi);
  });

  it('keeps viewers from spending the AI quota', async () => {
    const { error } = await call('translateSummary', { orgId, caseId, analysisId }, viewer);
    expect(error?.status).toBe('PERMISSION_DENIED');
  });
});
