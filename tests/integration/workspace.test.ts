import { beforeAll, describe, expect, it } from 'vitest';
import { call, createUser, readDoc, readStatus, verifyEmail, warmUp, type TestUser } from './emulators';

const FUNCTIONS = [
  'createOrganization',
  'createCase',
  'updateCase',
  'archiveCase',
  'inviteMember',
  'revokeInvitation',
  'acceptInvitation',
  'updateMember',
];

const caseFields = (title: string, assignedLawyerIds: string[] = []) => ({
  title,
  caseNumber: 'CP-DEMO-001',
  courtName: 'Demo Civil Court, Delhi',
  matterType: 'commercial',
  caseType: '',
  clientName: 'ABC Traders',
  opposingParty: 'XYZ Supplies',
  assignedLawyerIds,
});

let owner: TestUser;
let lawyer: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let orgId: string;
let caseId: string;

beforeAll(async () => {
  await warmUp(FUNCTIONS);
  [owner, lawyer, viewer, outsider] = await Promise.all([
    createUser('owner'),
    createUser('lawyer', { verified: false }),
    createUser('viewer'),
    createUser('outsider'),
  ]);
  const created = await call(
    'createOrganization',
    { name: 'Demo Law Chambers', workspaceType: 'law_firm', defaultLanguage: 'en' },
    owner,
  );
  orgId = created.result.orgId;
  await call(
    'createOrganization',
    { name: 'Other Firm', workspaceType: 'law_firm', defaultLanguage: 'en' },
    outsider,
  );
});

describe('cases', () => {
  it('creates a case assigned to its creator by default', async () => {
    const created = await call('createCase', { orgId, fields: caseFields('ABC Traders v. XYZ Supplies') }, owner);
    expect(created.error).toBeUndefined();
    caseId = created.result.caseId;

    const kase = await readDoc(`organizations/${orgId}/cases/${caseId}`, owner);
    expect(kase).toMatchObject({
      title: 'ABC Traders v. XYZ Supplies',
      status: 'active',
      caseType: null,
      jurisdiction: 'India',
      assignedLawyerIds: [owner.uid],
    });
  });

  it('rejects unknown matter types and assignees outside the workspace', async () => {
    const badMatter = await call('createCase', { orgId, fields: { ...caseFields('Bad matter'), matterType: 'nonsense' } }, owner);
    expect(badMatter.error?.status).toBe('INVALID_ARGUMENT');
    const badAssignee = await call('createCase', { orgId, fields: caseFields('Bad assignee', [outsider.uid]) }, owner);
    expect(badAssignee.error?.status).toBe('INVALID_ARGUMENT');
  });

  it('rejects paths smuggled into IDs', async () => {
    const result = await call('updateCase', { orgId, caseId: '../x', fields: caseFields('x'), status: 'active' }, owner);
    expect(result.error?.status).toBe('INVALID_ARGUMENT');
  });

  it('keeps cases away from other organizations', async () => {
    expect(await readStatus(`organizations/${orgId}/cases/${caseId}`, outsider)).toBe(403);
    const update = await call('updateCase', { orgId, caseId, fields: caseFields('Hijacked'), status: 'active' }, outsider);
    expect(update.error?.status).toBe('PERMISSION_DENIED');
  });

  it('locks archived cases until they are restored', async () => {
    expect((await call('archiveCase', { orgId, caseId, archived: true }, owner)).error).toBeUndefined();
    const blocked = await call('updateCase', { orgId, caseId, fields: caseFields('Edited'), status: 'active' }, owner);
    expect(blocked.error?.status).toBe('FAILED_PRECONDITION');
    expect((await call('archiveCase', { orgId, caseId, archived: false }, owner)).error).toBeUndefined();
    expect((await readDoc(`organizations/${orgId}/cases/${caseId}`, owner)).status).toBe('active');
  });
});

describe('team', () => {
  let lawyerInvite: string;

  it('creates one invitation per email and returns it again when repeated', async () => {
    const first = await call('inviteMember', { orgId, email: lawyer.email.toUpperCase(), role: 'lawyer' }, owner);
    const second = await call('inviteMember', { orgId, email: lawyer.email, role: 'lawyer' }, owner);
    expect(first.result.existing).toBe(false);
    expect(second.result).toEqual({ inviteId: first.result.inviteId, existing: true });
    lawyerInvite = first.result.inviteId;
  });

  it('requires a verified email matching the invitation', async () => {
    const unverified = await call('acceptInvitation', { orgId, inviteId: lawyerInvite }, lawyer);
    expect(unverified.error?.status).toBe('FAILED_PRECONDITION');
    const wrongPerson = await call('acceptInvitation', { orgId, inviteId: lawyerInvite }, viewer);
    expect(wrongPerson.error?.status).toBe('PERMISSION_DENIED');
  });

  it('adds the invitee as a member who can read and be assigned to cases', async () => {
    await verifyEmail(lawyer);
    const accepted = await call('acceptInvitation', { orgId, inviteId: lawyerInvite }, lawyer);
    expect(accepted.result).toEqual({ orgId, orgName: 'Demo Law Chambers' });
    expect(await readStatus(`organizations/${orgId}/cases/${caseId}`, lawyer)).toBe(200);
    expect((await readDoc(`users/${lawyer.uid}`, lawyer)).lastActiveOrgId).toBe(orgId);

    const assigned = await call(
      'updateCase',
      { orgId, caseId, fields: caseFields('ABC Traders v. XYZ Supplies', [owner.uid, lawyer.uid]), status: 'pending' },
      lawyer,
    );
    expect(assigned.error).toBeUndefined();
    expect(await readDoc(`organizations/${orgId}/cases/${caseId}`, owner)).toMatchObject({
      status: 'pending',
      assignedLawyerIds: [owner.uid, lawyer.uid],
    });
  });

  it('lets viewers read cases but not change them', async () => {
    const { result } = await call('inviteMember', { orgId, email: viewer.email, role: 'viewer' }, owner);
    expect((await call('acceptInvitation', { orgId, inviteId: result.inviteId }, viewer)).error).toBeUndefined();
    expect(await readStatus(`organizations/${orgId}/cases/${caseId}`, viewer)).toBe(200);
    const create = await call('createCase', { orgId, fields: caseFields('Viewer case') }, viewer);
    expect(create.error?.status).toBe('PERMISSION_DENIED');
  });

  it('only lets owners and admins manage members', async () => {
    const result = await call('updateMember', { orgId, uid: viewer.uid, role: 'admin' }, lawyer);
    expect(result.error?.status).toBe('PERMISSION_DENIED');
    const self = await call('updateMember', { orgId, uid: owner.uid, role: 'viewer' }, owner);
    expect(self.error?.status).toBe('FAILED_PRECONDITION');
  });

  it('cuts off a suspended member immediately', async () => {
    expect((await call('updateMember', { orgId, uid: viewer.uid, status: 'suspended' }, owner)).error).toBeUndefined();
    expect(await readStatus(`organizations/${orgId}/cases/${caseId}`, viewer)).toBe(403);
    const memberships = (await readDoc(`users/${viewer.uid}`, viewer)).memberships as Record<string, unknown>;
    expect(memberships[orgId]).toBeUndefined();
  });

  it('refuses withdrawn invitations', async () => {
    const newcomer = await createUser('newcomer');
    const { result } = await call('inviteMember', { orgId, email: newcomer.email, role: 'paralegal' }, owner);
    expect((await call('revokeInvitation', { orgId, inviteId: result.inviteId }, owner)).error).toBeUndefined();
    const accept = await call('acceptInvitation', { orgId, inviteId: result.inviteId }, newcomer);
    expect(accept.error?.status).toBe('FAILED_PRECONDITION');
  });

  it('records every change in the audit log', async () => {
    const response = await fetch(
      `http://127.0.0.1:8180/v1/projects/demo-casepilot/databases/(default)/documents/organizations/${orgId}/auditLogs?pageSize=100`,
      { headers: { authorization: `Bearer ${owner.token}` } },
    );
    const { documents = [] } = (await response.json()) as { documents?: { fields: { action: { stringValue: string } } }[] };
    const actions = documents.map((d) => d.fields.action.stringValue);
    for (const action of ['org.created', 'case.created', 'case.archived', 'case.restored', 'case.updated', 'member.invited', 'member.joined', 'member.updated', 'invitation.revoked']) {
      expect(actions).toContain(action);
    }
  });
});
