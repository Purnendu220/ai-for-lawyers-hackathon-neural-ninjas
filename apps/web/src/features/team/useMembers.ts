import { collection, query, type Timestamp } from 'firebase/firestore';
import { useMemo } from 'react';
import { CASE_ASSIGNEE_ROLES, paths, type MemberDoc } from '@casepilot/shared';
import { useActiveOrg } from '@/features/org/org-context';
import { db } from '@/lib/firebase';
import { useLiveQuery, type WithId } from '@/lib/live';

export type Member = WithId<MemberDoc<Timestamp>>;

/** Live member list of the active workspace, sorted by name. */
export function useMembers() {
  const { id: orgId } = useActiveOrg();
  const membersQuery = useMemo(() => query(collection(db(), paths.members(orgId))), [orgId]);
  const live = useLiveQuery<MemberDoc<Timestamp>>(membersQuery);

  return useMemo(() => {
    const members = [...(live.data ?? [])].sort((a, b) =>
      (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''),
    );
    const byId = new Map(members.map((m) => [m.id, m]));
    const assignable = members.filter(
      (m) => m.status === 'active' && CASE_ASSIGNEE_ROLES.includes(m.role),
    );
    return { ...live, members, byId, assignable };
  }, [live]);
}

export function memberName(member: Member | undefined): string {
  return member?.displayName || member?.email || 'Former member';
}
