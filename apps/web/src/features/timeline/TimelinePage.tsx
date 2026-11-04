import { useMutation } from '@tanstack/react-query';
import { CalendarCheck, CircleDashed, ListChecks, LoaderCircle, Plus, Quote } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { can, formatDateOnly } from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCase } from '@/features/cases/case-context';
import { useActiveOrg } from '@/features/org/org-context';
import { byDueDate, useCaseTasks, type Task } from '@/features/tasks/useTasks';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { useToday } from '@/lib/today';
import { cn } from '@/lib/utils';
import { useOnline } from '@/pwa/online';
import { EventDialog } from './EventDialog';
import { useCaseEvents, type CaseEvent } from './useEvents';

type Entry = { date: string; event?: CaseEvent; task?: Task };

export default function TimelinePage() {
  const kase = useCase();
  const { org, member } = useActiveOrg();
  const { today } = useToday();
  const events = useCaseEvents(kase.id);
  const tasks = useCaseTasks(kase.id);
  const writable = kase.status !== 'archived';
  const canAdd = can(member.role, 'event.write', org.policy) && writable;

  const toConfirm = (events.data ?? []).filter(
    (e) => e.dateStatus !== 'verified' || !e.eventDateOnly,
  );
  const dated: Entry[] = [
    ...(events.data ?? [])
      .filter((e) => e.dateStatus === 'verified' && e.eventDateOnly)
      .map((event) => ({ date: event.eventDateOnly as string, event })),
    ...(tasks.data ?? [])
      .filter((t) => t.dueDateOnly && t.status !== 'cancelled')
      .sort(byDueDate)
      .map((task) => ({ date: task.dueDateOnly as string, task })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = dated.filter((e) => e.date >= today);
  const past = dated.filter((e) => e.date < today).reverse();

  if (events.loading || tasks.loading) {
    return (
      <LoaderCircle
        className="mx-auto size-6 animate-spin text-muted-foreground"
        aria-label="Loading timeline"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {canAdd && (
        <div className="flex justify-end">
          <EventDialog
            caseId={kase.id}
            trigger={
              <Button>
                <Plus aria-hidden />
                Add to timeline
              </Button>
            }
          />
        </div>
      )}

      {toConfirm.length > 0 && (
        <Card className="border-dashed border-warning/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDashed className="size-4 text-warning" aria-hidden />
              Dates to confirm
            </CardTitle>
            <CardDescription>
              These don't count as deadlines or hearings until a lawyer sets the date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {toConfirm.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm"
                >
                  <EventSummary event={event} />
                  {writable && <VerifyDate event={event} />}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing scheduled. Confirmed hearings, deadlines and task due dates appear here.
          </p>
        ) : (
          <Timeline entries={upcoming} today={today} writable={writable} />
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Past</h2>
          <Timeline entries={past} today={today} writable={writable} />
        </section>
      )}
    </div>
  );
}

function Timeline({
  entries,
  today,
  writable,
}: {
  entries: Entry[];
  today: string;
  writable: boolean;
}) {
  return (
    <ol className="relative flex flex-col gap-4 border-l pl-6">
      {entries.map(({ date, event, task }) => (
        <li key={event?.id ?? task?.id} className="relative">
          <span
            className={cn(
              'absolute top-1.5 -left-[1.95rem] size-3 rounded-full border-2 border-card',
              event?.type === 'hearing'
                ? 'bg-primary'
                : task
                  ? 'bg-muted-foreground'
                  : 'bg-success',
            )}
            aria-hidden
          />
          <p className="text-xs font-medium text-muted-foreground">
            {formatDateOnly(date)}
            {date === today && ' · Today'}
          </p>
          <div className="mt-1 rounded-lg border bg-card p-3 text-sm">
            {event ? (
              <div className="flex flex-col gap-2">
                <EventSummary event={event} />
                {writable && <VerifyDate event={event} correcting />}
              </div>
            ) : task ? (
              <div className="flex flex-wrap items-center gap-2">
                <ListChecks className="size-4 text-muted-foreground" aria-hidden />
                <span className={cn('font-medium', task.status === 'completed' && 'line-through')}>
                  {task.title}
                </span>
                <Badge variant="outline">Task due</Badge>
                <Link
                  to="../tasks"
                  relative="path"
                  className="text-xs text-primary hover:underline"
                >
                  Open tasks
                </Link>
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function EventSummary({ event }: { event: CaseEvent }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{event.title}</span>
        <Badge variant={event.type === 'hearing' ? 'default' : 'outline'}>
          {EVENT_TYPE_LABELS[event.type]}
        </Badge>
        {event.dateStatus === 'verified' ? (
          <Badge variant="success">
            <CalendarCheck aria-hidden />
            Verified
          </Badge>
        ) : (
          <Badge variant="warning">Needs a lawyer to confirm</Badge>
        )}
      </div>
      {event.dateText && (
        <p className="text-xs text-muted-foreground">The order says: “{event.dateText}”</p>
      )}
      {event.analysisId && event.sourceRef?.page && (
        <Link
          to={`../ai-review/${event.analysisId}`}
          relative="path"
          className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline"
        >
          <Quote className="size-3" aria-hidden />
          From the order, {event.sourceRef.unit === 'section' ? 'section' : 'page'}{' '}
          {event.sourceRef.page}
        </Link>
      )}
    </div>
  );
}

/** Confirm a date that needs review, or correct a verified one. Lawyers and above only. */
function VerifyDate({ event, correcting = false }: { event: CaseEvent; correcting?: boolean }) {
  const kase = useCase();
  const { id: orgId, org, member } = useActiveOrg();
  const online = useOnline();
  const [open, setOpen] = useState(!correcting);
  const [dateOnly, setDateOnly] = useState(event.eventDateOnly ?? '');
  const verify = useMutation({
    mutationFn: () => call('verifyEvent', { orgId, caseId: kase.id, eventId: event.id, dateOnly }),
    onSuccess: () => {
      toast.success('Date confirmed.');
      if (correcting) setOpen(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!can(member.role, 'event.verify', org.policy)) return null;
  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-fit px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        Correct date
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        aria-label={`Date for ${event.title}`}
        className="h-8 w-44"
        value={dateOnly}
        onChange={(e) => setDateOnly(e.target.value)}
      />
      <Button
        size="sm"
        disabled={!dateOnly || verify.isPending || !online}
        onClick={() => verify.mutate()}
      >
        {correcting ? 'Save date' : 'Confirm date'}
      </Button>
      {correcting && (
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      )}
    </div>
  );
}
