import type { Role } from './enums';

/**
 * Single permission matrix (blueprint §6). Functions enforce it; the web app uses it only to hide
 * or disable controls.
 */
export const PERMISSIONS = {
  'case.read': ['owner', 'admin', 'lawyer', 'paralegal', 'viewer'],
  'case.write': ['owner', 'admin', 'lawyer'],
  'doc.upload': ['owner', 'admin', 'lawyer', 'paralegal'],
  'ai.rerun': ['owner', 'admin', 'lawyer'],
  'ai.review': ['owner', 'admin', 'lawyer'],
  'task.write': ['owner', 'admin', 'lawyer', 'paralegal'],
  'event.write': ['owner', 'admin', 'lawyer', 'paralegal'],
  'event.verify': ['owner', 'admin', 'lawyer'],
  'copilot.ask': ['owner', 'admin', 'lawyer', 'paralegal'],
  'member.manage': ['owner', 'admin'],
  'audit.read': ['owner', 'admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof PERMISSIONS;

export type OrgPolicy = {
  /** Blueprint §6 marks paralegal approval as "configurable per policy". Off by default. */
  paralegalCanApprove: boolean;
};

export const DEFAULT_ORG_POLICY: OrgPolicy = { paralegalCanApprove: false };

export function can(
  role: Role | null | undefined,
  action: Action,
  policy: OrgPolicy = DEFAULT_ORG_POLICY,
): boolean {
  if (!role) return false;
  if (action === 'ai.review' && role === 'paralegal') return policy.paralegalCanApprove;
  return (PERMISSIONS[action] as readonly Role[]).includes(role);
}
