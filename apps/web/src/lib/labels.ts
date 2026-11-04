import type { EventType, TaskPriority, TaskStatus } from '@casepilot/shared';

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'To do',
  in_progress: 'In progress',
  completed: 'Done',
  cancelled: 'Cancelled',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  hearing: 'Hearing',
  deadline: 'Deadline',
  filing: 'Filing',
  meeting: 'Meeting',
  note: 'Note',
};

/** How each audit action reads in an activity feed, after the person's name. */
export const ACTIVITY_LABELS: Record<string, string> = {
  'case.created': 'created the case',
  'case.updated': 'updated the case details',
  'case.archived': 'archived the case',
  'case.restored': 'restored the case',
  'document.upload_started': 'started uploading a document',
  'document.uploaded': 'uploaded a document',
  'document.rejected': 'uploaded a file that was rejected',
  'analysis.requested': 'asked for a new AI analysis',
  'analysis.created': 'received an AI analysis to review',
  'analysis.translated': 'translated a summary into Hindi',
  'copilot.asked': 'asked the case copilot a question',
  'analysis.item.approved': 'approved an AI suggestion',
  'analysis.item.edited': 'edited and approved an AI suggestion',
  'analysis.item.rejected': 'rejected an AI suggestion',
  'task.created': 'added a task',
  'task.updated': 'updated a task',
  'task.completed': 'completed a task',
  'event.created': 'added a timeline event',
  'event.updated': 'updated a timeline event',
  'event.verified': 'confirmed a date',
  'member.invited': 'invited a team member',
  'member.joined': 'joined the workspace',
  'member.updated': 'changed a member’s access',
  'org.created': 'created the workspace',
};
