import { z } from 'zod';
import { FirestoreId } from './common';

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use at most ${max} characters`);

/** The fields a lawyer edits on a case. Empty strings are stored as null. */
export const CaseFields = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Use at least 3 characters')
    .max(200, 'Use at most 200 characters'),
  caseNumber: optionalText(100),
  courtName: optionalText(200),
  matterType: optionalText(50),
  caseType: optionalText(100),
  clientName: optionalText(200),
  opposingParty: optionalText(200),
  assignedLawyerIds: z.array(FirestoreId).max(20, 'Assign at most 20 people'),
});
export type CaseFields = z.infer<typeof CaseFields>;

/** Statuses a lawyer can set directly. Archiving has its own action. */
export const EDITABLE_CASE_STATUSES = ['active', 'pending', 'closed'] as const;
export type EditableCaseStatus = (typeof EDITABLE_CASE_STATUSES)[number];

export const CaseFormValues = CaseFields.extend({ status: z.enum(EDITABLE_CASE_STATUSES) });
export type CaseFormValues = z.infer<typeof CaseFormValues>;

export const CreateCaseInput = z.object({ orgId: FirestoreId, fields: CaseFields });
export type CreateCaseInput = z.infer<typeof CreateCaseInput>;
export const CreateCaseOutput = z.object({ caseId: z.string() });

export const UpdateCaseInput = z.object({
  orgId: FirestoreId,
  caseId: FirestoreId,
  fields: CaseFields,
  status: z.enum(EDITABLE_CASE_STATUSES),
});
export type UpdateCaseInput = z.infer<typeof UpdateCaseInput>;

export const ArchiveCaseInput = z.object({
  orgId: FirestoreId,
  caseId: FirestoreId,
  archived: z.boolean(),
});
export type ArchiveCaseInput = z.infer<typeof ArchiveCaseInput>;
