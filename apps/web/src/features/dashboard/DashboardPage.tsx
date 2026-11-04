import { collection, limit, orderBy, query, type Timestamp } from 'firebase/firestore';
import { CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  can,
  formatDateOnly,
  formatInstant,
  paths,
  ROLE_LABELS,
  WORKSPACE_TYPE_LABELS,
  type AuditLogDoc,
} from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCases } from '@/features/cases/useCases';
import { useActiveOrg } from '@/features/org/org-context';
import { useAwaitingReview } from '@/features/review/useAwaitingReview';
import { TaskRow } from '@/features/tasks/TaskRow';
import { byDueDate, isTaskOverdue, useOrgTasks } from '@/features/tasks/useTasks';
import { memberName, useMembers } from '@/features/team/useMembers';
import { useUpcomingEvents } from '@/features/timeline/useEvents';
import { db } from '@/lib/firebase';
import { ACTIVITY_LABELS } from '@/lib/labels';
import { useLiveQuery } from '@/lib/live';
import { addDays, useToday } from '@/lib/today';

const STEPS = [
  'Create a case',
  'Upload a court order',
  'Review the AI suggestions against the source pages',
  'Track approved tasks on the timeline',
];

function Kpi({
  label,
  value,
  hint,
  to,
}: {
  label: string;
  value: number | undefined;
  hint?: ReactNode;
  to: string;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <Link to={to} className="text-2xl font-semibold hover:underline">
          {value ?? '—'}
        </Link>
        {hint && <p className="text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { org, member } = useActiveOrg();
  const { today, todayStart } = useToday();
  const cases = useCases();
  const tasks = useOrgTasks();
  const hearings = useUpcomingEvents(todayStart, { hearingsOnly: true });
  const awaiting = useAwaitingReview();
  const canCreateCase = can(member.role, 'case.write', org.policy);

  const activeCases = cases.data?.filter((c) => c.status === 'active' || c.status === 'pending');
  const twoWeeks = addDays(today, 14);
  const soonHearings = hearings.data?.filter((h) => (h.eventDateOnly ?? '') <= twoWeeks);
  const overdue = tasks.data?.filter((t) => isTaskOverdue(t, today)) ?? [];
  const weekEnd = addDays(today, 7);
  const urgent = [...(tasks.data ?? [])]
    .filter(
      (t) =>
        isTaskOverdue(t, today) ||
        (t.dueDateOnly && t.dueDateOnly <= weekEnd) ||
        t.priority === 'urgent',
    )
    .sort(byDueDate)
    .slice(0, 6);

  // Progress through the core workflow, until there is real work to show instead.
  const hasWork = (tasks.data?.length ?? 0) > 0 || (hearings.data?.length ?? 0) > 0;
  const currentStep = !cases.data?.length ? 0 : awaiting.data?.length ? 2 : hasWork ? 4 : 1;

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
        <Kpi label="Active cases" value={activeCases?.length} to="/cases" />
        <Kpi label="Hearings in the next 14 days" value={soonHearings?.length} to="/calendar" />
        <Kpi
          label="Open tasks"
          value={tasks.data?.length}
          to="/tasks"
          hint={
            overdue.length > 0 && <span className="text-destructive">{overdue.length} overdue</span>
          }
        />
        <Kpi label="Awaiting review" value={awaiting.data?.length} to="/cases" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming hearings</CardTitle>
            <CardDescription>Only dates a lawyer has verified appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            {hearings.data?.length ? (
              <ul className="divide-y text-sm">
                {hearings.data.slice(0, 5).map((h) => (
                  <li key={h.id}>
                    <Link
                      to={`/cases/${h.caseId}/timeline`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 hover:underline"
                    >
                      <span className="w-28 shrink-0 font-medium">
                        {formatDateOnly(h.eventDateOnly as string)}
                      </span>
                      <span>{h.caseTitle}</span>
                      <span className="text-muted-foreground">{h.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <CalendarClock className="size-8" aria-hidden />
                No verified hearings yet.
              </div>
            )}
          </CardContent>
        </Card>

        {currentStep < STEPS.length ? (
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
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-success"
                        aria-label="Done"
                      />
                    ) : (
                      <Circle
                        className={
                          index === currentStep
                            ? 'mt-0.5 size-4 shrink-0 text-primary'
                            : 'mt-0.5 size-4 shrink-0 text-muted-foreground/40'
                        }
                        aria-label={index === currentStep ? 'Next' : undefined}
                      />
                    )}
                    <span
                      className={
                        index < currentStep ? 'text-muted-foreground line-through' : undefined
                      }
                    >
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ) : (
          <RecentActivity />
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="grid gap-1.5">
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Overdue, due within a week, or marked urgent.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/tasks">All tasks</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {urgent.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {urgent.map((task) => (
                <li key={task.id}>
                  <TaskRow task={task} today={today} showCase compact />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing urgent.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** The workspace's latest actions. The audit log is readable by owners and admins only. */
function RecentActivity() {
  const { id: orgId, org, member } = useActiveOrg();
  const { byId } = useMembers();
  const cases = useCases();
  const allowed = can(member.role, 'audit.read', org.policy);
  const logQuery = useMemo(
    () =>
      allowed
        ? query(collection(db(), paths.auditLogs(orgId)), orderBy('timestamp', 'desc'), limit(8))
        : null,
    [orgId, allowed],
  );
  const logs = useLiveQuery<AuditLogDoc<Timestamp>>(logQuery);
  const caseTitle = (id: string | null) => cases.data?.find((c) => c.id === id)?.title;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{allowed ? 'Recent activity' : 'Recently updated cases'}</CardTitle>
      </CardHeader>
      <CardContent>
        {allowed ? (
          <ul className="flex flex-col gap-2 text-sm">
            {(logs.data ?? []).map((log) => (
              <li key={log.id}>
                <span className="font-medium">{memberName(byId.get(log.actorUid))}</span>{' '}
                {ACTIVITY_LABELS[log.action] ?? log.action}
                {caseTitle(log.caseId) && (
                  <span className="text-muted-foreground"> · {caseTitle(log.caseId)}</span>
                )}
                {log.timestamp && (
                  <span className="block text-xs text-muted-foreground">
                    {formatInstant(log.timestamp.toDate())}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {(cases.data ?? []).slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link to={`/cases/${c.id}/overview`} className="hover:underline">
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
