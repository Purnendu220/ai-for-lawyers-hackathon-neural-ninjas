import type { DocumentReference, Timestamp, Transaction } from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/https';
import {
  can,
  DEFAULT_ORG_POLICY,
  paths,
  type Action,
  type CaseDoc,
  type MemberDoc,
  type OrganizationDoc,
  type OrgPolicy,
  type Role,
  type WorkspaceType,
} from '@casepilot/shared';
import { db } from './firebase';

export type AuthedUser = {
  uid: string;
  /** Lower-case. */
  email: string | null;
  emailVerified: boolean;
  displayName: string;
};

export type MemberContext = AuthedUser & {
  orgId: string;
  orgName: string;
  workspaceType: WorkspaceType;
  role: Role;
  policy: OrgPolicy;
};

export function requireAuth(req: CallableRequest): AuthedUser {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.');
  const token = req.auth.token;
  return {
    uid: req.auth.uid,
    email: token.email ? token.email.toLowerCase() : null,
    emailVerified: token.email_verified === true,
    displayName: typeof token.name === 'string' ? token.name : '',
  };
}

/**
 * Checks sign-in, active membership and role on every call. Admin SDK writes bypass Security
 * Rules, so this is the only authorization a callable gets (blueprint §6).
 */
export async function requireMember(
  req: CallableRequest,
  orgId: string,
  action: Action,
): Promise<MemberContext> {
  const user = requireAuth(req);
  const [memberSnap, orgSnap] = await db.getAll(
    db.doc(paths.member(orgId, user.uid)),
    db.doc(paths.org(orgId)),
  );
  const member = memberSnap?.data() as MemberDoc<Timestamp> | undefined;
  const org = orgSnap?.data() as OrganizationDoc<Timestamp> | undefined;
  if (member?.status !== 'active' || !org) {
    throw new HttpsError('permission-denied', 'You are not a member of this workspace.');
  }
  const policy = org.policy ?? DEFAULT_ORG_POLICY;
  if (!can(member.role, action, policy)) {
    throw new HttpsError('permission-denied', 'Your role does not allow this action.');
  }
  return {
    ...user,
    orgId,
    orgName: org.name,
    workspaceType: org.workspaceType,
    role: member.role,
    policy,
  };
}

export type CaseRecord = {
  id: string;
  ref: DocumentReference;
  data: CaseDoc<Timestamp>;
};

/** Loads a case of the caller's organization inside a transaction. */
export async function requireCase(
  tx: Transaction,
  ctx: MemberContext,
  caseId: string,
  options: { writable?: boolean } = {},
): Promise<CaseRecord> {
  const ref = db.doc(paths.case(ctx.orgId, caseId));
  const snap = await tx.get(ref);
  const data = snap.data() as CaseDoc<Timestamp> | undefined;
  if (!data) throw new HttpsError('not-found', 'Case not found.');
  if (options.writable && data.status === 'archived') {
    throw new HttpsError('failed-precondition', 'This case is archived. Restore it to make changes.');
  }
  return { id: snap.id, ref, data };
}
