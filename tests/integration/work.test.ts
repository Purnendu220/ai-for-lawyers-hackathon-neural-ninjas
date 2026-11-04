import { beforeAll, describe, expect, it } from 'vitest';
import { call, createUser, emptyCaseFields, listDocs, readDoc, warmUp, type TestUser } from './emulators';

let owner: TestUser;
let paralegal: TestUser;
let viewer: TestUser;
let orgId: string;
let caseId: string;

const task = (overrides: Record<string, unknown> = {}) => ({
  title: 'Prepare the hearing file',
  description: '',
  priority: 'medium',
  dueDateOnly: null,
  assignedTo: null,
  ...overrides,
});

async function join(user: TestUser, role: string) {
  const invite = await call('inviteMember', { orgId, email: user.email, role }, owner);
  await call('acceptInvitation', { orgId, inviteId: invite.result.inviteId }, user);
}

beforeAll(async () => {
  await warmUp(['createOrganization', 'createCase', 'updateCase', 'createTask', 'updateTask', 'createEvent', 'updateEvent', 'verifyEvent', 'listCaseActivity', 'inviteMember', 'acceptInvitation']);
  [owner, paralegal, viewer] = await Promise.all([createUser('work-owner'), createUser('work-paralegal'), createUser('work-viewer')]);
  orgId = (await call('createOrganization', { name: 'Work Chambers', workspaceType: 'law_firm', defaultLanguage: 'en' }, owner)).result.orgId;
  await join(paralegal, 'paralegal');
  await join(viewer, 'viewer');
  caseId = (await call('createCase', { orgId, fields: emptyCaseFields('Original title') }, owner)).result.caseId;
});

describe('tasks', () => {
  let ownersTask: string;
  let paralegalsTask: string;

  it('creates manual tasks, and keeps viewers out', async () => {
    const created = await call('createTask', { orgId, caseId, fields: task({ dueDateOnly: '2026-12-01', priority: 'high' }) }, owner);
    expect(created.error).toBeUndefined();
    ownersTask = created.result.taskId;
    expect(await readDoc(`organizations/${orgId}/cases/${caseId}/tasks/${ownersTask}`, owner)).toMatchObject({
      status: 'open',
      origin: 'manual',
      dueDateOnly: '2026-12-01',
      dueDate: '2026-11-30T18:30:00Z',
      orgId,
      caseTitle: 'Original title',
    });
    const denied = await call('createTask', { orgId, caseId, fields: task() }, viewer);
    expect(denied.error?.status).toBe('PERMISSION_DENIED');
  });

  it('records completion time and audits completion', async () => {
    expect((await call('updateTask', { orgId, caseId, taskId: ownersTask, changes: { status: 'completed' } }, owner)).error).toBeUndefined();
    const done = await readDoc(`organizations/${orgId}/cases/${caseId}/tasks/${ownersTask}`, owner);
    expect(done.status).toBe('completed');
    expect(done.completedAt).not.toBeNull();
    await call('updateTask', { orgId, caseId, taskId: ownersTask, changes: { status: 'open' } }, owner);
    expect((await readDoc(`organizations/${orgId}/cases/${caseId}/tasks/${ownersTask}`, owner)).completedAt).toBeNull();
  });

  it('lets paralegals manage only their own tasks', async () => {
    const own = await call('createTask', { orgId, caseId, fields: task({ assignedTo: paralegal.uid }) }, paralegal);
    expect(own.error).toBeUndefined();
    paralegalsTask = own.result.taskId;
    expect((await call('updateTask', { orgId, caseId, taskId: paralegalsTask, changes: { status: 'in_progress' } }, paralegal)).error).toBeUndefined();

    const others = await call('updateTask', { orgId, caseId, taskId: ownersTask, changes: { status: 'completed' } }, paralegal);
    expect(others.error?.status).toBe('PERMISSION_DENIED');
    const reassign = await call('updateTask', { orgId, caseId, taskId: paralegalsTask, changes: { assignedTo: owner.uid } }, paralegal);
    expect(reassign.error?.status).toBe('PERMISSION_DENIED');
    const assignOthers = await call('createTask', { orgId, caseId, fields: task({ assignedTo: owner.uid }) }, paralegal);
    expect(assignOthers.error?.status).toBe('PERMISSION_DENIED');
  });

  it('refuses viewers as assignees', async () => {
    const result = await call('updateTask', { orgId, caseId, taskId: ownersTask, changes: { assignedTo: viewer.uid } }, owner);
    expect(result.error?.status).toBe('INVALID_ARGUMENT');
  });

  it('refreshes the case title copied onto tasks and events', async () => {
    await call('createEvent', { orgId, caseId, fields: { type: 'meeting', title: 'Client meeting', dateOnly: null } }, owner);
    const renamed = await call('updateCase', { orgId, caseId, fields: emptyCaseFields('Renamed case'), status: 'active' }, owner);
    expect(renamed.error).toBeUndefined();
    const titles = [
      ...(await listDocs(`organizations/${orgId}/cases/${caseId}/tasks`, owner)),
      ...(await listDocs(`organizations/${orgId}/cases/${caseId}/events`, owner)),
    ].map((d) => d.fields.caseTitle);
    expect(new Set(titles)).toEqual(new Set(['Renamed case']));
  });
});

describe('timeline events', () => {
  const casePath = () => `organizations/${orgId}/cases/${caseId}`;

  it('treats a date typed by a lawyer as verified and moves the next hearing to it', async () => {
    const later = await call('createEvent', { orgId, caseId, fields: { type: 'hearing', title: 'Final hearing', dateOnly: '2027-03-10' } }, owner);
    expect(later.error).toBeUndefined();
    expect(await readDoc(`${casePath()}/events/${later.result.eventId}`, owner)).toMatchObject({ dateStatus: 'verified', verifiedBy: owner.uid });
    expect((await readDoc(casePath(), owner)).nextHearingDateOnly).toBe('2027-03-10');

    await call('createEvent', { orgId, caseId, fields: { type: 'hearing', title: 'Next hearing', dateOnly: '2027-01-20' } }, owner);
    expect((await readDoc(casePath(), owner)).nextHearingDateOnly).toBe('2027-01-20');
  });

  it('keeps a paralegal’s date unverified until a lawyer confirms it', async () => {
    const created = await call('createEvent', { orgId, caseId, fields: { type: 'hearing', title: 'Mention', dateOnly: '2026-12-20' } }, paralegal);
    const eventId = created.result.eventId;
    expect(await readDoc(`${casePath()}/events/${eventId}`, owner)).toMatchObject({ dateStatus: 'needs_review' });
    expect((await readDoc(casePath(), owner)).nextHearingDateOnly).toBe('2027-01-20');

    const denied = await call('verifyEvent', { orgId, caseId, eventId, dateOnly: '2026-12-20' }, paralegal);
    expect(denied.error?.status).toBe('PERMISSION_DENIED');

    expect((await call('verifyEvent', { orgId, caseId, eventId, dateOnly: '2026-12-21' }, owner)).error).toBeUndefined();
    expect(await readDoc(`${casePath()}/events/${eventId}`, owner)).toMatchObject({ dateStatus: 'verified', eventDateOnly: '2026-12-21' });
    expect((await readDoc(casePath(), owner)).nextHearingDateOnly).toBe('2026-12-21');
  });

  it('moves the next hearing when a hearing becomes another kind of event', async () => {
    const events = await listDocs(`${casePath()}/events`, owner);
    const earliest = events.find((e) => e.fields.eventDateOnly === '2026-12-21')!;
    await call('updateEvent', { orgId, caseId, eventId: earliest.id, changes: { type: 'meeting' } }, owner);
    expect((await readDoc(casePath(), owner)).nextHearingDateOnly).toBe('2027-01-20');
  });
});

describe('listCaseActivity', () => {
  it('pages through the case’s audit trail, newest first, for any member', async () => {
    const first = await call('listCaseActivity', { orgId, caseId, after: null, limit: 3 }, viewer);
    expect(first.error).toBeUndefined();
    expect(first.result.entries).toHaveLength(3);
    expect(first.result.next).not.toBeNull();
    const times = first.result.entries.map((e: { at: string }) => e.at);
    expect([...times].sort().reverse()).toEqual(times);

    const second = await call('listCaseActivity', { orgId, caseId, after: first.result.next, limit: 50 }, viewer);
    const ids = new Set(first.result.entries.map((e: { id: string }) => e.id));
    expect(second.result.entries.every((e: { id: string }) => !ids.has(e.id))).toBe(true);
    expect(second.result.entries.at(-1).action).toBe('case.created');
  });

  it('keeps other organizations out', async () => {
    const outsider = await createUser('work-outsider');
    const result = await call('listCaseActivity', { orgId, caseId, after: null, limit: 10 }, outsider);
    expect(result.error?.status).toBe('PERMISSION_DENIED');
  });
});
