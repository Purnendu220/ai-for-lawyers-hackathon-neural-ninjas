import { ComingSoon } from '@/components/ComingSoon';

export default function TimelinePage() {
  return (
    <ComingSoon
      title="Timeline"
      plannedFor="Planned for Day 5 — Tasks, timeline, dashboard (docs/IMPLEMENTATION_PLAN.md)."
      description="Hearings, deadlines and filings in date order. Extracted dates stay marked “needs review” until a lawyer verifies them."
    />
  );
}
