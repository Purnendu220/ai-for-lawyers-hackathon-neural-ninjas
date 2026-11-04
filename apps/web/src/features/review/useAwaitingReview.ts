import { collectionGroup, query, where, type Timestamp } from 'firebase/firestore';
import { useMemo } from 'react';
import type { AnalysisDoc } from '@casepilot/shared';
import { useActiveOrg } from '@/features/org/org-context';
import { db } from '@/lib/firebase';
import { useLiveQuery } from '@/lib/live';

/** Analyses across the workspace that still have items waiting for a lawyer's decision. */
export function useAwaitingReview() {
  const { id: orgId } = useActiveOrg();
  const awaitingQuery = useMemo(
    () =>
      query(
        collectionGroup(db(), 'analyses'),
        where('orgId', '==', orgId),
        where('status', 'in', ['pending_review', 'in_review']),
      ),
    [orgId],
  );
  return useLiveQuery<AnalysisDoc<Timestamp>>(awaitingQuery);
}
