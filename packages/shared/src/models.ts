import type { Language, MemberStatus, Role, WorkspaceType } from './enums';
import type { OrgPolicy } from './permissions';

/**
 * Firestore document shapes. `TS` is the Timestamp class of whichever SDK reads the document
 * (firebase/firestore in the web app, firebase-admin/firestore in functions).
 */

export type UserMembership = {
  orgName: string;
  role: Role;
};

export type UserDoc<TS> = {
  displayName: string;
  email: string | null;
  createdAt: TS;
  /** Server-maintained mirror of organizations/{orgId}/members/{uid}. */
  memberships: Record<string, UserMembership>;
  lastActiveOrgId: string | null;
  preferences: { language: Language };
};

export type OrganizationDoc<TS> = {
  name: string;
  workspaceType: WorkspaceType;
  defaultLanguage: Language;
  policy: OrgPolicy;
  aiQuota: { analysesPerDay: number; copilotPerDay: number };
  createdAt: TS;
  createdBy: string;
};

export type MemberDoc<TS> = {
  role: Role;
  status: MemberStatus;
  displayName: string;
  email: string | null;
  joinedAt: TS;
};

export type AuditAction =
  | 'org.created'
  | 'member.invited'
  | 'member.joined'
  | 'member.updated'
  | 'case.created'
  | 'case.updated'
  | 'case.archived'
  | 'document.uploaded'
  | 'document.rejected'
  | 'analysis.created'
  | 'analysis.item.approved'
  | 'analysis.item.edited'
  | 'analysis.item.rejected'
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'event.created'
  | 'event.verified'
  | 'copilot.asked';

export type AuditEntityType =
  | 'organization'
  | 'member'
  | 'case'
  | 'document'
  | 'analysis'
  | 'task'
  | 'event'
  | 'message';

/** Metadata holds IDs, field names and enum values only — never document text, quotes or titles. */
export type AuditMetadata = Record<string, string | number | boolean | null | string[]>;

export type AuditLogDoc<TS> = {
  actorUid: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  caseId: string | null;
  timestamp: TS;
  metadata: AuditMetadata;
};
