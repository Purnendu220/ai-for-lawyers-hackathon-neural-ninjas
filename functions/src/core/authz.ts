import type { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/https';
import {
  can,
  DEFAULT_ORG_POLICY,
  paths,
  type Action,
  type MemberDoc,
  type OrganizationDoc,
  type OrgPolicy,
  type Role,
} from '@casepilot/shared';
import { db } from './firebase';

export type AuthedUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
};

export type MemberContext = AuthedUser & {
  orgId: string;
  role: Role;
  policy: OrgPolicy;
};

export function requireAuth(req: CallableRequest): AuthedUser {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.');
  const token = req.auth.token;
  return {
    uid: req.auth.uid,
    email: token.email ?? null,
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
  if (!member || member.status !== 'active') {
    throw new HttpsError('permission-denied', 'You are not a member of this workspace.');
  }
  const org = orgSnap?.data() as OrganizationDoc<Timestamp> | undefined;
  const policy = org?.policy ?? DEFAULT_ORG_POLICY;
  if (!can(member.role, action, policy)) {
    throw new HttpsError('permission-denied', 'Your role does not allow this action.');
  }
  return { ...user, orgId, role: member.role, policy };
}
