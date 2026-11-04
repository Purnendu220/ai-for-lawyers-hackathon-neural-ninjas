import type { Timestamp } from 'firebase/firestore';
import { createContext, useContext } from 'react';
import type { MemberDoc, OrganizationDoc, Role, UserDoc } from '@casepilot/shared';
import type { WithId } from '@/lib/live';

export type OrgSummary = { id: string; name: string; role: Role };

export type ActiveOrg = {
  id: string;
  org: WithId<OrganizationDoc<Timestamp>>;
  member: WithId<MemberDoc<Timestamp>>;
};

export type OrgState = {
  loading: boolean;
  error: Error | null;
  profile: WithId<UserDoc<Timestamp>> | null;
  orgs: OrgSummary[];
  active: ActiveOrg | null;
  switchOrg: (orgId: string) => Promise<void>;
};

export const OrgContext = createContext<OrgState | null>(null);

export function useOrgs(): OrgState {
  const value = useContext(OrgContext);
  if (!value) throw new Error('useOrgs must be used inside <OrgProvider>');
  return value;
}

/** For screens behind RequireOrg, where an active workspace is guaranteed. */
export function useActiveOrg(): ActiveOrg {
  const { active } = useOrgs();
  if (!active) throw new Error('useActiveOrg called without an active workspace');
  return active;
}
