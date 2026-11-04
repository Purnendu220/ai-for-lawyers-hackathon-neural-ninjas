import { LoaderCircle } from 'lucide-react';
import type { DocumentStatus } from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';

const STATUS: Record<
  DocumentStatus,
  {
    label: string;
    variant: 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
    busy?: boolean;
  }
> = {
  awaiting_upload: { label: 'Uploading', variant: 'secondary', busy: true },
  queued: { label: 'Queued', variant: 'secondary', busy: true },
  extracting: { label: 'Reading text', variant: 'secondary', busy: true },
  analyzing: { label: 'AI analysing', variant: 'secondary', busy: true },
  ready: { label: 'Ready for review', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

export function ProcessingStatus({ status }: { status: DocumentStatus }) {
  const { label, variant, busy } = STATUS[status];
  return (
    <Badge variant={variant} aria-live="polite">
      {busy && <LoaderCircle className="animate-spin" aria-hidden />}
      {label}
    </Badge>
  );
}
