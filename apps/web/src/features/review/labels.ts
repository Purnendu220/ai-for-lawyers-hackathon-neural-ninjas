import type { DueDateBasis } from '@casepilot/shared';
import type { EXTRACTED_DATE_TYPES } from '@casepilot/shared';

export const DATE_TYPE_LABELS: Record<(typeof EXTRACTED_DATE_TYPES)[number], string> = {
  order_date: 'Order date',
  hearing: 'Hearing',
  filing_deadline: 'Filing deadline',
  compliance_deadline: 'Compliance deadline',
  past_event: 'Past event',
  other: 'Other date',
};

/** How a date or due date is fixed. Anything but 'explicit' needs a lawyer to work it out. */
export const BASIS_LABELS: Record<DueDateBasis, string> = {
  explicit: 'Stated in the order',
  relative_to_order: 'Counted from the order date',
  relative_to_service: 'Counted from service',
  relative_to_hearing: 'Counted from a hearing',
  none: 'No date given',
};

export { PRIORITY_LABELS } from '@/lib/labels';
