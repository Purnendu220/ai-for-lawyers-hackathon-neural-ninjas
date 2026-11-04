import { FieldValue, type DocumentData, type DocumentReference } from 'firebase-admin/firestore';
import { paths, type AuditAction, type AuditEntityType, type AuditMetadata } from '@casepilot/shared';
import { db } from './firebase';

/** A Transaction or a WriteBatch. */
type DocWriter = { set(ref: DocumentReference, data: DocumentData): unknown };

export type AuditEntry = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  caseId?: string | null;
  /** IDs, field names and enum values only. Never document text, quotes, titles or file names. */
  metadata?: AuditMetadata;
};

/** Writes an audit entry in the same transaction or batch as the change it records. */
export function audit(
  writer: DocWriter,
  actor: { uid: string; orgId: string },
  entry: AuditEntry,
): void {
  const ref = db.collection(paths.auditLogs(actor.orgId)).doc();
  writer.set(ref, {
    actorUid: actor.uid,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    caseId: entry.caseId ?? null,
    timestamp: FieldValue.serverTimestamp(),
    metadata: entry.metadata ?? {},
  });
}
