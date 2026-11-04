import { CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router';
import { can, ROLE_LABELS, WORKSPACE_TYPE_LABELS } from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCases } from '@/features/cases/useCases';
import { useActiveOrg } from '@/features/org/org-context';

/** Filled in as the features behind them land (tasks and hearings on Day 5, review on Day 4). */
const LATER_KPIS = ['Hearings in the next 14 days', 'Open tasks', 'Awaiting review'];

const STEPS = [
  'Create a case',
  'Upload a court order',
  'Review the AI suggestions against the source pages',
  'Track approved tasks on the timeline',
];

export default function DashboardPage() {
  const { org, member } = useActiveOrg();
  const canCreateCase = can(member.role, 'case.write', org.policy);
  const cases = useCases();
  const activeCases = cases.data?.filter((c) => c.status === 'active' || c.status === 'pending');
  // Only the first step is tracked so far; the rest arrive with uploads and review.
  const currentStep = cases.data && cases.data.length > 0 ? 1 : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {org.name}
            <Badge variant="secondary">{WORKSPACE_TYPE_LABELS[org.workspaceType]}</Badge>
            <Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
          </p>
        </div>
        {canCreateCase && (
          <Button asChild>
            <Link to="/cases/new">New case</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Active cases</CardDescription>
          </CardHeader>
          <CardContent className="px-4 text-2xl font-semibold">
            <Link to="/cases" className="hover:underline">
              {activeCases ? activeCases.length : '—'}
            </Link>
          </CardContent>
        </Card>
        {LATER_KPIS.map((label) => (
          <Card key={label} className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardDescription>{label}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 text-2xl font-semibold text-muted-foreground">—</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming hearings</CardTitle>
            <CardDescription>Only dates a lawyer has verified appear here.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <CalendarClock className="size-8" aria-hidden />
            No verified hearings yet.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>The core CasePilot workflow.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-3 text-sm">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-2">
                  {index < currentStep ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Done" />
                  ) : index === currentStep ? (
                    <Circle className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Next" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" aria-hidden />
                  )}
                  <span className={index < currentStep ? 'text-muted-foreground line-through' : undefined}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
