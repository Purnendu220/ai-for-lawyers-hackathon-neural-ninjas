import type { CaseStatus, Language, MemberStatus, Role, WorkspaceType } from './enums';
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
  /** Lower-case. */
  email: string | null;
  joinedAt: TS;
};

export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export type InvitationDoc<TS> = {
  /** Lower-case. Only a signed-in user with this verified email can accept. */
  email: string;
  role: Role;
  status: InvitationStatus;
  invitedBy: string;
  createdAt: TS;
  expiresAt: TS;
  acceptedBy: string | null;
  acceptedAt: TS | null;
};

export type CaseDoc<TS> = {
  title: string;
  caseNumber: string | null;
  courtName: string | null;
  jurisdiction: 'India';
  matterType: string | null;
  caseType: string | null;
  status: CaseStatus;
  clientName: string | null;
  opposingParty: string | null;
  assignedLawyerIds: string[];
  /** Earliest verified future hearing; maintained by the server from Day 4. */
  nextHearingDate: TS | null;
  nextHearingDateOnly: string | null;
  createdAt: TS;
  createdBy: string;
  updatedAt: TS;
  updatedBy: string;
  archivedAt: TS | null;
};

export type AuditAction =
  | 'org.created'
  | 'member.invited'
  | 'member.joined'
  | 'member.updated'
  | 'case.created'
  | 'case.updated'
  | 'case.archived'
  | 'case.restored'
  | 'invitation.revoked'
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
  | 'invitation'
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
