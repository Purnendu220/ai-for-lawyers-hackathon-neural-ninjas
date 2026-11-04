import { z } from 'zod';
import { isDateOnly } from '../dates';
import { EVENT_TYPES, TASK_PRIORITIES, TASK_STATUSES } from '../enums';
import { FirestoreId } from './common';

const DateOnlyValue = z.string().refine(isDateOnly, 'Enter a valid date');

export const TaskFields = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(200, 'Use at most 200 characters'),
  description: z.string().trim().max(2000, 'Use at most 2000 characters'),
  priority: z.enum(TASK_PRIORITIES),
  dueDateOnly: DateOnlyValue.nullable(),
  assignedTo: FirestoreId.nullable(),
});
export type TaskFields = z.infer<typeof TaskFields>;

export const CreateTaskInput = z.object({ orgId: FirestoreId, caseId: FirestoreId, fields: TaskFields });
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;
export const CreateTaskOutput = z.object({ taskId: z.string() });

export const UpdateTaskInput = z.object({
  orgId: FirestoreId,
  caseId: FirestoreId,
  taskId: FirestoreId,
  changes: TaskFields.partial()
    .extend({ status: z.enum(TASK_STATUSES).optional() })
    .refine((changes) => Object.keys(changes).length > 0, { message: 'Nothing to change' }),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

export const EventFields = z.object({
  type: z.enum(EVENT_TYPES),
  title: z.string().trim().min(1, 'Enter a title').max(200, 'Use at most 200 characters'),
  /** A date entered by a person is treated as verified; leave it empty for "date to be confirmed". */
  dateOnly: DateOnlyValue.nullable(),
});
export type EventFields = z.infer<typeof EventFields>;

export const CreateEventInput = z.object({ orgId: FirestoreId, caseId: FirestoreId, fields: EventFields });
export type CreateEventInput = z.infer<typeof CreateEventInput>;
export const CreateEventOutput = z.object({ eventId: z.string() });

export const UpdateEventInput = z.object({
  orgId: FirestoreId,
  caseId: FirestoreId,
  eventId: FirestoreId,
  changes: EventFields.pick({ type: true, title: true })
    .partial()
    .refine((changes) => Object.keys(changes).length > 0, { message: 'Nothing to change' }),
});
export type UpdateEventInput = z.infer<typeof UpdateEventInput>;

/** Confirms or corrects an event's date (blueprint §6 verifyEvent). */
export const VerifyEventInput = z.object({
  orgId: FirestoreId,
  caseId: FirestoreId,
  eventId: FirestoreId,
  dateOnly: DateOnlyValue,
});
export type VerifyEventInput = z.infer<typeof VerifyEventInput>;

export const ListCaseActivityInput = z.object({
  orgId: FirestoreId,
  caseId: FirestoreId,
  /** ID of the last entry of the previous page. */
  after: FirestoreId.nullable(),
  limit: z.number().int().min(1).max(50),
});
export type ListCaseActivityInput = z.infer<typeof ListCaseActivityInput>;

export const ActivityEntry = z.object({
  id: z.string(),
  action: z.string(),
  actorUid: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  /** ISO 8601. */
  at: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});
export type ActivityEntry = z.infer<typeof ActivityEntry>;

export const ListCaseActivityOutput = z.object({
  entries: z.array(ActivityEntry),
  /** Pass as `after` to get the next page; null when there are no more entries. */
  next: z.string().nullable(),
});
