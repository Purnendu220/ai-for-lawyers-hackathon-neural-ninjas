import { doc, updateDoc, type Timestamp } from 'firebase/firestore';
import { useCallback, useMemo, type ReactNode } from 'react';
import { paths, type MemberDoc, type OrganizationDoc, type UserDoc } from '@casepilot/shared';
import { useUser } from '@/features/auth/auth-context';
import { db } from '@/lib/firebase';
import { useLiveDoc } from '@/lib/live';
import { OrgContext, type OrgState } from './org-context';

/**
 * Loads the signed-in user's workspaces. The membership map on users/{uid} lists them; the
 * member document of the active workspace is the authority on role and status.
 */
export function OrgProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const profile = useLiveDoc<UserDoc<Timestamp>>(paths.user(user.uid));

  const orgs = useMemo(
    () =>
      Object.entries(profile.data?.memberships ?? {})
        .map(([id, membership]) => ({ id, name: membership.orgName, role: membership.role }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [profile.data],
  );

  const lastActive = profile.data?.lastActiveOrgId ?? null;
  const activeId = orgs.some((o) => o.id === lastActive) ? lastActive : (orgs[0]?.id ?? null);

  const org = useLiveDoc<OrganizationDoc<Timestamp>>(activeId ? paths.org(activeId) : null);
  const member = useLiveDoc<MemberDoc<Timestamp>>(
    activeId ? paths.member(activeId, user.uid) : null,
  );

  const switchOrg = useCallback(
    (orgId: string) => updateDoc(doc(db(), paths.user(user.uid)), { lastActiveOrgId: orgId }),
    [user.uid],
  );

  const value = useMemo<OrgState>(() => {
    const active =
      activeId && org.data && member.data?.status === 'active'
        ? { id: activeId, org: org.data, member: member.data }
        : null;
    return {
      loading: profile.loading || (activeId !== null && (org.loading || member.loading)),
      error: profile.error,
      profile: profile.data ?? null,
      orgs,
      active,
      switchOrg,
    };
  }, [activeId, member, org, orgs, profile, switchOrg]);

  return <OrgContext value={value}>{children}</OrgContext>;
}
