import { CASE_STATUS_LABELS, type CaseStatus } from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';

const VARIANT = {
  active: 'success',
  pending: 'warning',
  closed: 'secondary',
  archived: 'outline',
} as const satisfies Record<CaseStatus, string>;

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Badge variant={VARIANT[status]}>{CASE_STATUS_LABELS[status]}</Badge>;
}
