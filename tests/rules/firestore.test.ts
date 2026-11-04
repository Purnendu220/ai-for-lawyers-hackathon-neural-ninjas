import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-casepilot',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'organizations/orgA'), { name: 'Org A' });
    await setDoc(doc(db, 'organizations/orgA/members/alice'), { role: 'owner', status: 'active' });
    await setDoc(doc(db, 'organizations/orgA/members/victor'), { role: 'viewer', status: 'active' });
    await setDoc(doc(db, 'organizations/orgA/members/sam'), { role: 'lawyer', status: 'suspended' });
    await setDoc(doc(db, 'organizations/orgA/cases/case1'), { title: 'Fictional case', status: 'active' });
    await setDoc(doc(db, 'organizations/orgA/cases/case1/tasks/t1'), {
      orgId: 'orgA',
      caseId: 'case1',
      status: 'open',
    });
    await setDoc(doc(db, 'organizations/orgA/auditLogs/log1'), { action: 'case.created' });
    await setDoc(doc(db, 'organizations/orgB'), { name: 'Org B' });
    await setDoc(doc(db, 'organizations/orgB/members/bob'), { role: 'owner', status: 'active' });
    await setDoc(doc(db, 'users/alice'), {
      displayName: 'Alice',
      memberships: { orgA: { orgName: 'Org A', role: 'owner' } },
      lastActiveOrgId: 'orgA',
    });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe('tenant isolation', () => {
  it('lets an active member read their organization’s case', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'organizations/orgA/cases/case1')));
    await assertSucceeds(getDoc(doc(as('victor'), 'organizations/orgA/cases/case1')));
  });

  it('blocks a member of another organization', async () => {
    await assertFails(getDoc(doc(as('bob'), 'organizations/orgA/cases/case1')));
    await assertFails(getDoc(doc(as('bob'), 'organizations/orgA/cases/case1/tasks/t1')));
  });

  it('blocks signed-out users and suspended members', async () => {
    const anonymous = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymous, 'organizations/orgA/cases/case1')));
    await assertFails(getDoc(doc(as('sam'), 'organizations/orgA/cases/case1')));
  });

  it('allows cross-case task queries only when filtered to the caller’s organization', async () => {
    await assertSucceeds(
      getDocs(query(collectionGroup(as('alice'), 'tasks'), where('orgId', '==', 'orgA'))),
    );
    await assertFails(
      getDocs(query(collectionGroup(as('bob'), 'tasks'), where('orgId', '==', 'orgA'))),
    );
    await assertFails(getDocs(collectionGroup(as('alice'), 'tasks')));
  });
});

describe('all writes go through Cloud Functions', () => {
  it('denies client writes to cases and tasks, even for owners', async () => {
    await assertFails(setDoc(doc(as('alice'), 'organizations/orgA/cases/case2'), { title: 'x' }));
    await assertFails(updateDoc(doc(as('alice'), 'organizations/orgA/cases/case1'), { title: 'x' }));
    await assertFails(
      updateDoc(doc(as('alice'), 'organizations/orgA/cases/case1/tasks/t1'), { status: 'completed' }),
    );
  });

  it('denies role escalation through member documents', async () => {
    await assertFails(
      updateDoc(doc(as('victor'), 'organizations/orgA/members/victor'), { role: 'owner' }),
    );
    await assertFails(
      setDoc(doc(as('bob'), 'organizations/orgA/members/bob'), { role: 'owner', status: 'active' }),
    );
  });

  it('shows audit logs to owners but not viewers', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'organizations/orgA/auditLogs/log1')));
    await assertFails(getDoc(doc(as('victor'), 'organizations/orgA/auditLogs/log1')));
  });
});

describe('user profile', () => {
  it('lets a user rename themselves', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), { displayName: 'Alice S.' }));
  });

  it('stops a user granting themselves a membership', async () => {
    await assertFails(
      updateDoc(doc(as('alice'), 'users/alice'), {
        'memberships.orgB': { orgName: 'Org B', role: 'owner' },
      }),
    );
  });

  it('only allows switching to a workspace the user belongs to', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), { lastActiveOrgId: 'orgA' }));
    await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { lastActiveOrgId: 'orgB' }));
  });

  it('keeps profiles private', async () => {
    await assertFails(getDoc(doc(as('bob'), 'users/alice')));
  });
});
