import { collection, collectionGroup, orderBy, query, where, type Timestamp } from 'firebase/firestore';
import { useMemo } from 'react';
import { paths, type EventDoc } from '@casepilot/shared';
import { useActiveOrg } from '@/features/org/org-context';
import { db } from '@/lib/firebase';
import { useLiveQuery, type WithId } from '@/lib/live';

export type CaseEvent = WithId<EventDoc<Timestamp>>;

export function useCaseEvents(caseId: string) {
  const { id: orgId } = useActiveOrg();
  const eventsQuery = useMemo(() => query(collection(db(), paths.events(orgId, caseId))), [orgId, caseId]);
  return useLiveQuery<EventDoc<Timestamp>>(eventsQuery);
}

/** Verified events across the workspace from `from` on, soonest first. `hearingsOnly` narrows. */
export function useUpcomingEvents(from: Timestamp, { hearingsOnly = false } = {}) {
  const { id: orgId } = useActiveOrg();
  const eventsQuery = useMemo(
    () =>
      query(
        collectionGroup(db(), 'events'),
        where('orgId', '==', orgId),
        ...(hearingsOnly ? [where('type', '==', 'hearing')] : []),
        where('dateStatus', '==', 'verified'),
        where('eventDate', '>=', from),
        orderBy('eventDate', 'asc'),
      ),
    [orgId, from, hearingsOnly],
  );
  return useLiveQuery<EventDoc<Timestamp>>(eventsQuery);
}
