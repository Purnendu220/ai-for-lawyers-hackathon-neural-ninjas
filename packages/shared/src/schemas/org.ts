import { z } from 'zod';
import { LANGUAGES, WORKSPACE_TYPES } from '../enums';

export const OrgName = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters')
  .max(120, 'Use at most 120 characters');

export const CreateOrganizationInput = z.object({
  name: OrgName,
  workspaceType: z.enum(WORKSPACE_TYPES),
  defaultLanguage: z.enum(LANGUAGES),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationInput>;

export const CreateOrganizationOutput = z.object({
  orgId: z.string(),
});
export type CreateOrganizationOutput = z.infer<typeof CreateOrganizationOutput>;
