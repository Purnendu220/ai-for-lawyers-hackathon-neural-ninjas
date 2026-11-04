import { z } from 'zod';
import { ROLES } from '../enums';
import { FirestoreId } from './common';

/** Ownership is never granted by invitation; an owner promotes an existing member instead. */
export const INVITABLE_ROLES = ['admin', 'lawyer', 'paralegal', 'viewer'] as const;

export const InviteMemberInput = z.object({
  orgId: FirestoreId,
  email: z.email('Enter a valid email address').max(254),
  role: z.enum(INVITABLE_ROLES),
});
export type InviteMemberInput = z.infer<typeof InviteMemberInput>;

export const InviteMemberOutput = z.object({
  inviteId: z.string(),
  /** True when a pending invitation for this email already existed and was returned instead. */
  existing: z.boolean(),
});

export const InvitationRef = z.object({ orgId: FirestoreId, inviteId: FirestoreId });
export type InvitationRef = z.infer<typeof InvitationRef>;

export const AcceptInvitationOutput = z.object({ orgId: z.string(), orgName: z.string() });

export const UpdateMemberInput = z
  .object({
    orgId: FirestoreId,
    uid: FirestoreId,
    role: z.enum(ROLES).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .refine((input) => input.role !== undefined || input.status !== undefined, {
    message: 'Nothing to change',
  });
export type UpdateMemberInput = z.infer<typeof UpdateMemberInput>;
