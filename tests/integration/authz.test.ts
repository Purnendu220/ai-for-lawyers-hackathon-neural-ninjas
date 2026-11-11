import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { callables } from '@casepilot/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  call,
  createUser,
  deleteObjectStatus,
  downloadStatus,
  emptyCaseFields,
  uploadObject,
  uploadSample,
  warmUp,
  type TestUser,
} from './emulators';

// The role × callable matrix (blueprint §6, packages/shared/src/permissions.ts), checked against
// the running functions. Calls by permitted roles name records that don't exist, so they pass the
// permission check and stop at "not found" without changing anything.

type Member = 'owner' | 'admin' | 'lawyer' | 'paralegal' | 'viewer';
type Principal = Member | 'suspended' | 'outsider' | 'anonymous';

const WRITERS: Member[] = ['owner', 'admin', 'lawyer'];
const STAFF: Member[] = [...WRITERS, 'paralegal'];
const MANAGERS: Member[] = ['owner', 'admin'];
const MEMBERS: Member[] = [...STAFF, 'viewer'];
const PRINCIPALS: Principal[] = [...MEMBERS, 'suspended', 'outsider', 'anonymous'];

const PDF = 'application/pdf';
const missing = 'does-not-exist';
const samplePdf = new Uint8Array(readFileSync(new URL('../../seed/samples/sample-order.pdf', import.meta.url)));

let orgId: string;
let caseId: string;
const users = {} as Record<Exclude<Principal, 'anonymous'>, TestUser>;
const as = (principal: Principal) => (principal === 'anonymous' ? undefined : users[principal]);

const task = { title: 'File reply', description: '', priority: 'medium', dueDateOnly: null, assignedTo: null };

const MATRIX: Record<string, { allowed: Member[]; input: () => Record<string, unknown> }> = {
  createCase: { allowed: WRITERS, input: () => ({ orgId, fields: emptyCaseFields('Matrix case') }) },
  updateCase: {
    allowed: WRITERS,
    input: () => ({ orgId, caseId: missing, fields: emptyCaseFields('Matrix case'), status: 'active' }),
  },
  archiveCase: { allowed: WRITERS, input: () => ({ orgId, caseId: missing, archived: true }) },
  inviteMember: {
    allowed: MANAGERS,
    input: () => ({ orgId, email: `matrix-${randomUUID().slice(0, 8)}@example.test`, role: 'viewer' }),
  },
  revokeInvitation: { allowed: MANAGERS, input: () => ({ orgId, inviteId: missing }) },
  updateMember: { allowed: MANAGERS, input: () => ({ orgId, uid: missing, status: 'suspended' }) },
  startUpload: {
    allowed: STAFF,
    input: () => ({ orgId, caseId: missing, fileName: 'order.pdf', mimeType: PDF, sizeBytes: 100 }),
  },
  analyzeDocument: { allowed: WRITERS, input: () => ({ orgId, caseId: missing, documentId: missing }) },
  reviewAnalysis: {
    allowed: WRITERS,
    input: () => ({
      orgId,
      caseId: missing,
      analysisId: missing,
      decisions: [{ itemId: 'task-1', action: 'reject' }],
    }),
  },
  createTask: { allowed: STAFF, input: () => ({ orgId, caseId: missing, fields: task }) },
  updateTask: {
    allowed: STAFF,
    input: () => ({ orgId, caseId: missing, taskId: missing, changes: { status: 'completed' } }),
  },
  createEvent: {
    allowed: STAFF,
    input: () => ({ orgId, caseId: missing, fields: { type: 'hearing', title: 'Hearing', dateOnly: null } }),
  },
  updateEvent: {
    allowed: STAFF,
    input: () => ({ orgId, caseId: missing, eventId: missing, changes: { title: 'Hearing' } }),
  },
  verifyEvent: {
    allowed: WRITERS,
    input: () => ({ orgId, caseId: missing, eventId: missing, dateOnly: '2026-12-15' }),
  },
  listCaseActivity: { allowed: MEMBERS, input: () => ({ orgId, caseId: missing, after: null, limit: 5 }) },
  askCaseCopilot: {
    allowed: STAFF,
    input: () => ({ orgId, caseId: missing, question: 'When is the next hearing?' }),
  },
  translateSummary: { allowed: STAFF, input: () => ({ orgId, caseId: missing, analysisId: missing }) },
};

/** Callables any signed-in user may call: they act on the caller's own account or invitation. */
const OPEN_TO_SIGNED_IN = ['createOrganization', 'acceptInvitation'];

async function join(user: TestUser, role: Member) {
  const invite = await call('inviteMember', { orgId, email: user.email, role }, users.owner);
  const accepted = await call('acceptInvitation', { orgId, inviteId: invite.result.inviteId }, user);
  expect(accepted.error).toBeUndefined();
}

beforeAll(async () => {
  await warmUp([...Object.keys(MATRIX), ...OPEN_TO_SIGNED_IN]);
  const created = await Promise.all(
    (['owner', 'admin', 'lawyer', 'paralegal', 'viewer', 'suspended', 'outsider'] as const).map(
      async (label) => [label, await createUser(`authz-${label}`)] as const,
    ),
  );
  Object.assign(users, Object.fromEntries(created));
  orgId = (
    await call('createOrganization', { name: 'Matrix Chambers', workspaceType: 'law_firm', defaultLanguage: 'en' }, users.owner)
  ).result.orgId;
  await call('createOrganization', { name: 'Other Firm', workspaceType: 'law_firm', defaultLanguage: 'en' }, users.outsider);
  for (const role of ['admin', 'lawyer', 'paralegal', 'viewer'] as const) await join(users[role], role);
  await join(users.suspended, 'lawyer');
  const suspended = await call('updateMember', { orgId, uid: users.suspended.uid, status: 'suspended' }, users.owner);
  expect(suspended.error).toBeUndefined();
  caseId = (await call('createCase', { orgId, fields: emptyCaseFields('Storage isolation') }, users.owner)).result.caseId;
});

describe('role × callable matrix', () => {
  it('covers every callable', () => {
    expect([...Object.keys(MATRIX), ...OPEN_TO_SIGNED_IN].sort()).toEqual(Object.keys(callables).sort());
  });

  it.each(Object.entries(MATRIX))('%s', async (name, { allowed, input }) => {
    const outcomes = await Promise.all(
      PRINCIPALS.map(async (principal) => [principal, (await call(name, input(), as(principal))).error?.status ?? 'OK']),
    );
    const expected = PRINCIPALS.map((principal) => {
      if (principal === 'anonymous') return [principal, 'UNAUTHENTICATED'];
      if (allowed.includes(principal as Member)) return [principal, 'allowed'];
      return [principal, 'PERMISSION_DENIED'];
    });
    // A permitted call may still fail later (the record doesn't exist), just not on permissions.
    const actual = outcomes.map(([principal, status]) => [
      principal,
      status === 'PERMISSION_DENIED' || status === 'UNAUTHENTICATED' ? status : 'allowed',
    ]);
    expect(actual).toEqual(expected);
  });

  it.each(OPEN_TO_SIGNED_IN)('%s requires sign-in', async (name) => {
    const { error } = await call(name, { orgId, inviteId: missing, name: 'X Chambers', workspaceType: 'solo', defaultLanguage: 'en' });
    expect(error?.status).toBe('UNAUTHENTICATED');
  });
});

describe('Storage tenant isolation', () => {
  let original: string;

  beforeAll(async () => {
    original = (await uploadSample(orgId, caseId, users.owner)).storagePath;
  });

  it('lets every active member open an original, and nobody else', async () => {
    const statuses = await Promise.all(PRINCIPALS.map((principal) => downloadStatus(original, as(principal))));
    expect(Object.fromEntries(PRINCIPALS.map((principal, i) => [principal, statuses[i]]))).toEqual({
      owner: 200,
      admin: 200,
      lawyer: 200,
      paralegal: 200,
      viewer: 200,
      suspended: 403,
      outsider: 403,
      anonymous: 403,
    });
  });

  it('accepts an upload only from the member who reserved the path', async () => {
    const { result } = await call(
      'startUpload',
      { orgId, caseId, fileName: 'second.pdf', mimeType: PDF, sizeBytes: samplePdf.byteLength },
      users.paralegal,
    );
    const path = result.storagePath as string;
    for (const principal of ['owner', 'lawyer', 'suspended', 'outsider', 'anonymous'] as const) {
      expect([principal, await uploadObject(path, samplePdf, PDF, as(principal))]).toEqual([principal, 403]);
    }
    expect(await uploadObject(path, samplePdf, PDF, users.paralegal)).toBe(200);
  });

  it('never lets a client replace or delete an original, or write anywhere else', async () => {
    expect(await uploadObject(original, samplePdf, PDF, users.owner)).toBe(403);
    expect(await deleteObjectStatus(original, users.owner)).toBe(403);
    const folder = original.replace(/\/original$/, '');
    expect(await uploadObject(`${folder}/chunks.json`, samplePdf, 'application/json', users.owner)).toBe(403);
    expect(await uploadObject(`orgs/${orgId}/notes.pdf`, samplePdf, PDF, users.owner)).toBe(403);
    expect(await uploadObject(`public/${missing}.pdf`, samplePdf, PDF, users.owner)).toBe(403);
  });
});
