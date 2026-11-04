import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import type { Language, UserDoc, UserMembership } from '@casepilot/shared';
import type { AuthedUser } from './authz';

/**
 * users/{uid} fields to merge when a user gains a workspace. The membership map mirrors
 * organizations/{orgId}/members/{uid} so the app can list workspaces with one read.
 */
export function profileWithMembership(
  user: AuthedUser,
  existing: UserDoc<Timestamp> | undefined,
  orgId: string,
  membership: UserMembership,
  language: Language,
) {
  return {
    displayName: existing?.displayName || user.displayName || user.email || '',
    email: user.email,
    ...(existing ? {} : { createdAt: FieldValue.serverTimestamp() }),
    ...(existing?.preferences ? {} : { preferences: { language } }),
    memberships: { [orgId]: membership },
    lastActiveOrgId: orgId,
  };
}
