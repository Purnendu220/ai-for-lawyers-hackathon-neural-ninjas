import { collection, orderBy, query, type Timestamp } from 'firebase/firestore';
import { useMemo } from 'react';
import { paths, type CaseDoc } from '@casepilot/shared';
import { useActiveOrg } from '@/features/org/org-context';
import { db } from '@/lib/firebase';
import { useLiveQuery, type WithId } from '@/lib/live';

export type Case = WithId<CaseDoc<Timestamp>>;

/**
 * Every case in the active workspace, most recently updated first. The MVP lets all members read
 * all cases (blueprint §6), and workspaces are small, so filtering happens on the client.
 */
export function useCases() {
  const { id: orgId } = useActiveOrg();
  const casesQuery = useMemo(
    () => query(collection(db(), paths.cases(orgId)), orderBy('updatedAt', 'desc')),
    [orgId],
  );
  return useLiveQuery<CaseDoc<Timestamp>>(casesQuery);
}
