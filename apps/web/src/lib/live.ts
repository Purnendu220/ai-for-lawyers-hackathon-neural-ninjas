import { doc, onSnapshot, type Query } from 'firebase/firestore';
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

type Snapshot<K, T> = { key: K; data: T | undefined; error: Error | null; fromCache: boolean };

/**
 * Subscribes to one Firestore document. `null` path means "not ready yet". Resolves to `null` when
 * the document does not exist.
 */
export function useLiveDoc<T>(path: string | null): Live<WithId<T> | null> {
  const [snapshot, setSnapshot] = useState<Snapshot<string, WithId<T> | null> | null>(null);

  useEffect(() => {
    if (!path) return;
    return onSnapshot(
      doc(db(), path),
      { includeMetadataChanges: true },
      (snap) =>
        setSnapshot({
          key: path,
          data: snap.exists() ? ({ id: snap.id, ...snap.data() } as WithId<T>) : null,
          error: null,
          fromCache: snap.metadata.fromCache,
        }),
      (error) => setSnapshot({ key: path, data: undefined, error, fromCache: false }),
    );
  }, [path]);

  if (!path) return { data: undefined, error: null, loading: false, fromCache: false };
  if (snapshot?.key !== path) return { data: undefined, error: null, loading: true, fromCache: false };
  return { data: snapshot.data, error: snapshot.error, loading: false, fromCache: snapshot.fromCache };
}

/**
 * Subscribes to a Firestore query. Build the query with useMemo so it only changes when its inputs
 * do; a new query object re-subscribes. `null` means "not ready yet".
 */
export function useLiveQuery<T>(query: Query | null): Live<WithId<T>[]> {
  const [snapshot, setSnapshot] = useState<Snapshot<Query, WithId<T>[]> | null>(null);

  useEffect(() => {
    if (!query) return;
    return onSnapshot(
      query,
      { includeMetadataChanges: true },
      (snap) =>
        setSnapshot({
          key: query,
          data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WithId<T>),
          error: null,
          fromCache: snap.metadata.fromCache,
        }),
      (error) => setSnapshot({ key: query, data: undefined, error, fromCache: false }),
    );
  }, [query]);

  if (!query) return { data: undefined, error: null, loading: false, fromCache: false };
  if (snapshot?.key !== query) return { data: undefined, error: null, loading: true, fromCache: false };
  return { data: snapshot.data, error: snapshot.error, loading: false, fromCache: snapshot.fromCache };
}
