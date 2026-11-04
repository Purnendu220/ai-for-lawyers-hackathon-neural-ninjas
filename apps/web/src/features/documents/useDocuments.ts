import { collection, orderBy, query, type Timestamp } from 'firebase/firestore';
import { useMemo } from 'react';
import { paths, type DocumentDoc } from '@casepilot/shared';
import { useActiveOrg } from '@/features/org/org-context';
import { db } from '@/lib/firebase';
import { useLiveQuery, type WithId } from '@/lib/live';

export type CaseDocument = WithId<DocumentDoc<Timestamp>>;

/** Documents of one case, newest first, with live processing status. */
export function useDocuments(caseId: string) {
  const { id: orgId } = useActiveOrg();
  const documentsQuery = useMemo(
    () => query(collection(db(), paths.documents(orgId, caseId)), orderBy('uploadedAt', 'desc')),
    [orgId, caseId],
  );
  return useLiveQuery<DocumentDoc<Timestamp>>(documentsQuery);
}
