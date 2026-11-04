import { ComingSoon } from '@/components/ComingSoon';

export default function NewCasePage() {
  return (
    <ComingSoon
      title="New case"
      plannedFor="Planned for Day 2 — Cases and team (docs/IMPLEMENTATION_PLAN.md)."
      description="Case title, number, court, matter type, parties and assigned lawyers, validated with the shared Zod schema."
    />
  );
}
