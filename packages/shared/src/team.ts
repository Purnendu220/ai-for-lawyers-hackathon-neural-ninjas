import type { Role } from './enums';

/** Roles a case can be assigned to (blueprint §5 "assignedLawyerIds"). */
export const CASE_ASSIGNEE_ROLES: readonly Role[] = ['owner', 'admin', 'lawyer'];

/**
 * Roles `actor` may give to a member whose current role is `target` (null for a new invitation).
 * Owners manage everyone. Admins manage lawyers, paralegals and viewers, and cannot create admins.
 * An empty list means `actor` cannot manage that member at all.
 */
export function assignableRoles(actor: Role, target: Role | null): Role[] {
  if (actor === 'owner') return ['owner', 'admin', 'lawyer', 'paralegal', 'viewer'];
  if (actor === 'admin' && target !== 'owner' && target !== 'admin') {
    return ['lawyer', 'paralegal', 'viewer'];
  }
  return [];
}

export const INVITATION_TTL_DAYS = 7;
