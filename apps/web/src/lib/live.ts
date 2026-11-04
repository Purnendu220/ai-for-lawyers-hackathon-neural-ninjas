import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';

export type WithId<T> = T & { id: string };

export type Live<T> = {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  /** True while showing data from the device cache rather than the server. */
  fromCache: boolean;
};

type Snapshot<T> = { path: string; data: T | undefined; error: Error | null; fromCache: boolean };

/**
 * Subscribes to one Firestore document. `null` path means "not ready yet". Resolves to `null` when
 * the document does not exist.
 */
export function useLiveDoc<T>(path: string | null): Live<WithId<T> | null> {
  const [snapshot, setSnapshot] = useState<Snapshot<WithId<T> | null> | null>(null);

  useEffect(() => {
    if (!path) return;
    return onSnapshot(
      doc(db(), path),
      { includeMetadataChanges: true },
      (snap) =>
        setSnapshot({
          path,
          data: snap.exists() ? ({ id: snap.id, ...snap.data() } as WithId<T>) : null,
          error: null,
          fromCache: snap.metadata.fromCache,
        }),
      (error) => setSnapshot({ path, data: undefined, error, fromCache: false }),
    );
  }, [path]);

  if (!path) return { data: undefined, error: null, loading: false, fromCache: false };
  if (snapshot?.path !== path) return { data: undefined, error: null, loading: true, fromCache: false };
  return { data: snapshot.data, error: snapshot.error, loading: false, fromCache: snapshot.fromCache };
}
