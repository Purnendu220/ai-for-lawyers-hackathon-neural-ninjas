import { beforeAll, describe, expect, it } from 'vitest';
import {
  analyseSample,
  call,
  createUser,
  emptyCaseFields,
  listDocs,
  readDoc,
  warmUp,
  type TestUser,
} from './emulators';

// The replayed sample analysis (tests/integration/fixtures/recordings.json) contains:
//   fact-1 (quote found), fact-2 (invented quote), direction-1..3 (direction-2 conditional),
//   date-1 order date 2026-11-02, date-2 "within 14 days" (relative), date-3 hearing 2026-12-15,
//   task-1 (relative to order), task-2 (relative to service, conditional), task-3 (no date).

let owner: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let orgId: string;
let caseId: string;
let analysisId: string;

const review = (decisions: unknown[], user: TestUser = owner) =>
  call('reviewAnalysis', { orgId, caseId, analysisId, decisions }, user);
const analysisPath = () => `organizations/${orgId}/cases/${caseId}/analyses/${analysisId}`;

type Item = { itemId: string; decision: string; edits: Record<string, unknown> | null; resultEntityId: string | null };
const item = async (list: string, itemId: string) =>
  ((await readDoc(analysisPath(), owner))[list] as Item[]).find((i) => i.itemId === itemId)!;

beforeAll(async () => {
  await warmUp(['createOrganization', 'createCase', 'startUpload', 'reviewAnalysis', 'inviteMember', 'acceptInvitation']);
  [owner, viewer, outsider] = await Promise.all([createUser('rev-owner'), createUser('rev-viewer'), createUser('rev-outsider')]);
  orgId = (await call('createOrganization', { name: 'Review Chambers', workspaceType: 'law_firm', defaultLanguage: 'en' }, owner)).result.orgId;
  const invite = await call('inviteMember', { orgId, email: viewer.email, role: 'viewer' }, owner);
  await call('acceptInvitation', { orgId, inviteId: invite.result.inviteId }, viewer);
  caseId = (await call('createCase', { orgId, fields: emptyCaseFields('ABC Traders v. XYZ Supplies') }, owner)).result.caseId;
  analysisId = await analyseSample(orgId, caseId, owner);
});

describe('reviewAnalysis', () => {
  it('lets viewers read the analysis but not decide on it', async () => {
    const { error } = await review([{ itemId: 'task-1', action: 'approve' }], viewer);
    expect(error?.status).toBe('PERMISSION_DENIED');
  });

  it('turns approved tasks and dates into tasks and timeline events', async () => {
    const { result, error } = await review([
      { itemId: 'task-1', action: 'approve' },
      { itemId: 'task-3', action: 'approve', edits: { assignedTo: owner.uid } },
      { itemId: 'date-3', action: 'approve' },
    ]);
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ applied: 3, skipped: 0 });
    expect(result.taskIds).toHaveLength(2);
    expect(result.eventIds).toHaveLength(1);

    const tasks = await listDocs(`organizations/${orgId}/cases/${caseId}/tasks`, owner);
    expect(tasks).toHaveLength(2);
    const first = tasks.find((t) => t.fields.analysisItemId === 'task-1')!.fields;
    expect(first).toMatchObject({ status: 'open', orgId, caseTitle: 'ABC Traders v. XYZ Supplies', dueDate: null, dueDateOnly: null, origin: 'ai' });
    expect(tasks.find((t) => t.fields.analysisItemId === 'task-3')!.fields.assignedTo).toBe(owner.uid);

    const [hearing] = await listDocs(`organizations/${orgId}/cases/${caseId}/events`, owner);
    expect(hearing?.fields).toMatchObject({ type: 'hearing', dateStatus: 'verified', eventDateOnly: '2026-12-15', verifiedBy: owner.uid });
  });

  it('sets the case’s next hearing from a verified hearing', async () => {
    const kase = await readDoc(`organizations/${orgId}/cases/${caseId}`, owner);
    expect(kase.nextHearingDateOnly).toBe('2026-12-15');
  });

  it('ignores a repeated approval instead of creating duplicates', async () => {
    const { result } = await review([
      { itemId: 'task-1', action: 'approve' },
      { itemId: 'task-3', action: 'approve' },
      { itemId: 'date-3', action: 'approve' },
    ]);
    expect(result).toMatchObject({ applied: 0, skipped: 3, taskIds: [], eventIds: [] });
    expect(await listDocs(`organizations/${orgId}/cases/${caseId}/tasks`, owner)).toHaveLength(2);
  });

  it('records edits and rejections on the analysis', async () => {
    const { error } = await review([
      { itemId: 'direction-1', action: 'edit', edits: { text: 'Plaintiff to file the updated statement of account.' } },
      { itemId: 'fact-2', action: 'reject' },
    ]);
    expect(error).toBeUndefined();
    expect(await item('directions', 'direction-1')).toMatchObject({ decision: 'edited', edits: { text: 'Plaintiff to file the updated statement of account.' } });
    expect(await item('facts', 'fact-2')).toMatchObject({ decision: 'rejected', edits: null, resultEntityId: null });
    expect((await readDoc(analysisPath(), owner)).status).toBe('in_review');
  });

  it('keeps a relative date unverified unless the reviewer sets one', async () => {
    const { result } = await review([{ itemId: 'date-2', action: 'approve' }]);
    const [eventId] = result.eventIds;
    const event = await readDoc(`organizations/${orgId}/cases/${caseId}/events/${eventId}`, owner);
    expect(event).toMatchObject({ dateStatus: 'needs_review', eventDate: null, eventDateOnly: null, dateText: 'within 14 days from the date of this order' });
  });

  it('refuses impossible dates, outside assignees and unknown items', async () => {
    const badDate = await review([{ itemId: 'task-2', action: 'edit', edits: { date: '2026-02-30' } }]);
    expect(badDate.error?.status).toBe('INVALID_ARGUMENT');
    const badAssignee = await review([{ itemId: 'task-2', action: 'approve', edits: { assignedTo: outsider.uid } }]);
    expect(badAssignee.error?.status).toBe('INVALID_ARGUMENT');
    const unknown = await review([{ itemId: 'task-99', action: 'approve' }]);
    expect(unknown.error?.status).toBe('INVALID_ARGUMENT');
    expect((await item('proposedTasks', 'task-2')).decision).toBe('pending');
  });

  it('uses a date the reviewer confirmed and marks the analysis reviewed when nothing is left', async () => {
    const { result, error } = await review([
      { itemId: 'task-2', action: 'edit', edits: { title: 'Track service and the response window', date: '2026-11-30' } },
      { itemId: 'date-1', action: 'approve' },
      { itemId: 'fact-1', action: 'approve' },
      { itemId: 'direction-2', action: 'approve' },
      { itemId: 'direction-3', action: 'reject' },
    ]);
    expect(error).toBeUndefined();
    const task = await readDoc(`organizations/${orgId}/cases/${caseId}/tasks/${result.taskIds[0]}`, owner);
    expect(task).toMatchObject({ title: 'Track service and the response window', dueDateOnly: '2026-11-30', dueDate: '2026-11-29T18:30:00Z' });
    const analysis = await readDoc(analysisPath(), owner);
    expect(analysis).toMatchObject({ status: 'reviewed', reviewedBy: owner.uid });
  });

  it('audits every decision', async () => {
    const logs = await listDocs(`organizations/${orgId}/auditLogs`, owner);
    const actions = logs.map((l) => l.fields.action);
    expect(actions.filter((a) => a === 'analysis.item.approved').length).toBeGreaterThanOrEqual(7);
    expect(actions).toContain('analysis.item.edited');
    expect(actions).toContain('analysis.item.rejected');
  });
});
