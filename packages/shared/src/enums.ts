export const ROLES = ['owner', 'admin', 'lawyer', 'paralegal', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const MEMBER_STATUSES = ['active', 'invited', 'suspended'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const WORKSPACE_TYPES = ['solo', 'law_firm', 'corporate'] as const;
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

export const LANGUAGES = ['en', 'hi'] as const;
export type Language = (typeof LANGUAGES)[number];

export const CASE_STATUSES = ['active', 'pending', 'closed', 'archived'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const DOCUMENT_STATUSES = [
  'awaiting_upload',
  'queued',
  'extracting',
  'analyzing',
  'ready',
  'failed',
  'rejected',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const ANALYSIS_STATUSES = ['pending_review', 'in_review', 'reviewed', 'superseded'] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const ITEM_DECISIONS = ['pending', 'approved', 'edited', 'rejected'] as const;
export type ItemDecision = (typeof ITEM_DECISIONS)[number];

export const TASK_STATUSES = ['open', 'in_progress', 'completed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const EVENT_TYPES = ['hearing', 'deadline', 'filing', 'meeting', 'note'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const DATE_STATUSES = ['extracted', 'verified', 'needs_review'] as const;
export type DateStatus = (typeof DATE_STATUSES)[number];

export const DUE_DATE_BASES = [
  'explicit',
  'relative_to_order',
  'relative_to_service',
  'relative_to_hearing',
  'none',
] as const;
export type DueDateBasis = (typeof DUE_DATE_BASES)[number];

export const SOURCE_UNITS = ['page', 'section'] as const;
export type SourceUnit = (typeof SOURCE_UNITS)[number];

export const ORIGINS = ['ai', 'manual'] as const;
export type Origin = (typeof ORIGINS)[number];

export const JOB_TYPES = ['document_extract', 'document_analysis', 'reminder'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['queued', 'processing', 'succeeded', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  lawyer: 'Lawyer',
  paralegal: 'Paralegal',
  viewer: 'Viewer',
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  closed: 'Closed',
  archived: 'Archived',
};

export const WORKSPACE_TYPE_LABELS: Record<WorkspaceType, string> = {
  solo: 'Solo advocate',
  law_firm: 'Law firm',
  corporate: 'Corporate legal team',
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी (Hindi)',
};
