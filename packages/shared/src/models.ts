import type { AllowedMimeType } from './constants';
import type {
  AnalysisStatus,
  CaseStatus,
  DateStatus,
  DocumentStatus,
  DueDateBasis,
  EventType,
  ItemDecision,
  JobStatus,
  JobType,
  Language,
  MemberStatus,
  Origin,
  Role,
  SourceUnit,
  TaskPriority,
  TaskStatus,
  WorkspaceType,
} from './enums';
import type { OrgPolicy } from './permissions';
import type { ReviewEdits } from './schemas/review';
import type {
  ExtractedDate,
  ExtractedDirection,
  ExtractedFact,
  Extraction,
  ProposedTask,
} from './schemas/extraction';

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
  | 'document.upload_started'
  | 'document.uploaded'
  | 'document.rejected'
  | 'analysis.requested'
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

export type DocumentDoc<TS> = {
  /** The user's file name. Shown in the app only; never logged or used in a storage path. */
  fileName: string;
  mimeType: AllowedMimeType;
  sizeBytes: number;
  storagePath: string;
  processingStatus: DocumentStatus;
  uploadedBy: string;
  uploadedAt: TS;
  /** An upload not finished by then is cleaned up. */
  uploadExpiresAt: TS;
  sha256: string | null;
  duplicateOfDocumentId: string | null;
  sourceUnit: SourceUnit | null;
  pageCount: number | null;
  /** Codes such as `page_3_no_text`. */
  warnings: string[];
  errorCode: string | null;
  /** User-facing explanation when rejected or failed. */
  errorMessage: string | null;
  latestAnalysisId: string | null;
  /** Run counters, so a retry gets a fresh job and task ID. */
  extractRun: number;
  analysisRun: number;
  updatedAt: TS;
};

/** Where an extracted item comes from, checked by the server against the page text. */
export type SourceRef = {
  documentId: string;
  unit: SourceUnit;
  page: number | null;
  quote: string | null;
  /** The quote was found in the document text. */
  verified: boolean;
  /** The quote was found on a different page than the model cited; `page` is the corrected one. */
  pageCorrected: boolean;
};

export type AnalysisItemReview<TS> = {
  itemId: string;
  sourceRef: SourceRef;
  decision: ItemDecision;
  decidedBy: string | null;
  decidedAt: TS | null;
  /** What the reviewer changed, kept beside the AI's original values. */
  edits: ReviewEdits | null;
  /** The task or event created on approval. */
  resultEntityId: string | null;
};

type WithoutSource<T> = Omit<T, 'sourcePage' | 'sourceQuote'>;

export type AnalysisFact<TS> = WithoutSource<ExtractedFact> & AnalysisItemReview<TS>;
export type AnalysisDirection<TS> = WithoutSource<ExtractedDirection> & AnalysisItemReview<TS>;
export type AnalysisDate<TS> = WithoutSource<ExtractedDate> & AnalysisItemReview<TS>;
export type AnalysisTask<TS> = WithoutSource<ProposedTask> & AnalysisItemReview<TS>;

export type AnalysisDoc<TS> = {
  documentId: string;
  status: AnalysisStatus;
  /** 'fixture' analyses are replays and are labelled as such in the app. */
  mode: 'live' | 'fixture';
  model: string;
  promptVersion: string;
  summary: string;
  language: Language;
  caseDetails: Extraction['caseDetails'];
  facts: AnalysisFact<TS>[];
  directions: AnalysisDirection<TS>[];
  dates: AnalysisDate<TS>[];
  proposedTasks: AnalysisTask<TS>[];
  /** From the model (unclear text) and from the server (pages not analysed). */
  warnings: string[];
  pagesAnalysed: number;
  pageCount: number;
  usage: { inputTokens: number; outputTokens: number } | null;
  latencyMs: number;
  createdAt: TS;
  reviewedBy: string | null;
  reviewedAt: TS | null;
};

export type JobDoc<TS> = {
  type: JobType;
  caseId: string;
  documentId: string;
  status: JobStatus;
  run: number;
  attempts: number;
  requestedBy: string;
  leaseExpiresAt: TS | null;
  queuedAt: TS;
  startedAt: TS | null;
  completedAt: TS | null;
  durationMs: number | null;
  errorCode: string | null;
};

/** Fields every task and event carries so cross-case queries can filter by organization. */
type CaseScoped = { orgId: string; caseId: string; caseTitle: string };

export type TaskDoc<TS> = CaseScoped & {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string | null;
  /** Midnight IST of dueDateOnly; always written (null when unknown) so it can be sorted on. */
  dueDate: TS | null;
  dueDateOnly: string | null;
  dueDateBasis: DueDateBasis;
  condition: string | null;
  origin: Origin;
  analysisId: string | null;
  analysisItemId: string | null;
  sourceRef: SourceRef | null;
  createdBy: string;
  createdAt: TS;
  updatedAt: TS;
  completedAt: TS | null;
};

export type EventDoc<TS> = CaseScoped & {
  type: EventType;
  title: string;
  /** Null until someone confirms the date (dateStatus 'needs_review'). */
  eventDate: TS | null;
  eventDateOnly: string | null;
  dateStatus: DateStatus;
  /** The date as written in the source document. */
  dateText: string | null;
  origin: Origin;
  analysisId: string | null;
  analysisItemId: string | null;
  sourceRef: SourceRef | null;
  createdBy: string;
  createdAt: TS;
  verifiedBy: string | null;
  verifiedAt: TS | null;
};
