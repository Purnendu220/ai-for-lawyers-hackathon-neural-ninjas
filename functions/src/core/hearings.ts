import { FieldValue, Timestamp, type Transaction } from 'firebase-admin/firestore';
import { dateOnlyToInstant, paths, todayDateOnly, type DateStatus, type EventDoc, type EventType } from '@casepilot/shared';
import type { CaseRecord } from './authz';
import { db } from './firebase';

type HearingFields = { type: EventType; dateStatus: DateStatus; eventDateOnly: string | null };

export const midnightIst = (day: string | null) => (day ? Timestamp.fromDate(dateOnlyToInstant(day)) : null);

/** Reads every hearing of a case. Call before the transaction's first write. */
export async function readHearings(tx: Transaction, orgId: string, caseId: string) {
  const snap = await tx.get(db.collection(paths.events(orgId, caseId)).where('type', '==', 'hearing'));
  return new Map(snap.docs.map((doc) => [doc.id, doc.data() as EventDoc<Timestamp>]));
}

/**
 * Keeps case.nextHearingDate on the earliest verified hearing from today (IST) on. `changed` holds
 * events written in this transaction, by ID, so they override what was read.
 */
export function refreshNextHearing(
  tx: Transaction,
  kase: CaseRecord,
  hearings: Map<string, HearingFields>,
  changed: Map<string, HearingFields>,
  actorUid: string,
): void {
  const today = todayDateOnly();
  const all = new Map([...hearings, ...changed]);
  const next =
    [...all.values()]
      .filter((e) => e.type === 'hearing' && e.dateStatus === 'verified' && e.eventDateOnly && e.eventDateOnly >= today)
      .map((e) => e.eventDateOnly as string)
      .sort()[0] ?? null;
  if (next === kase.data.nextHearingDateOnly) return;
  tx.update(kase.ref, {
    nextHearingDateOnly: next,
    nextHearingDate: midnightIst(next),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorUid,
  });
}
