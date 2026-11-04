import { LoaderCircle } from 'lucide-react';
import { Link } from 'react-router';
import { formatDateOnly } from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useOrgTasks } from '@/features/tasks/useTasks';
import { useUpcomingEvents } from '@/features/timeline/useEvents';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { useToday } from '@/lib/today';

type AgendaItem = {
  key: string;
  date: string;
  label: string;
  title: string;
  caseId: string;
  caseTitle: string;
  link: string;
};

/** Agenda of verified hearings and dates, and open task due dates, across all cases. */
export default function CalendarPage() {
  const { today, todayStart } = useToday();
  const events = useUpcomingEvents(todayStart);
  const tasks = useOrgTasks();

  const items: AgendaItem[] = [
    ...(events.data ?? []).map((e) => ({
      key: e.id,
      date: e.eventDateOnly as string,
      label: EVENT_TYPE_LABELS[e.type],
      title: e.title,
      caseId: e.caseId,
      caseTitle: e.caseTitle,
      link: `/cases/${e.caseId}/timeline`,
    })),
    ...(tasks.data ?? [])
      .filter((t) => t.dueDateOnly && t.dueDateOnly >= today)
      .map((t) => ({
        key: t.id,
        date: t.dueDateOnly as string,
        label: 'Task due',
        title: t.title,
        caseId: t.caseId,
        caseTitle: t.caseTitle,
        link: `/cases/${t.caseId}/tasks`,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const days = [...new Set(items.map((i) => i.date))];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Confirmed dates and task due dates across all cases.
        </p>
      </div>
      {events.loading || tasks.loading ? (
        <LoaderCircle
          className="mx-auto size-6 animate-spin text-muted-foreground"
          aria-label="Loading calendar"
        />
      ) : days.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing coming up.</p>
      ) : (
        days.map((day) => (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">
              {formatDateOnly(day)}
              {day === today && <span className="text-muted-foreground"> · Today</span>}
            </h2>
            <Card className="gap-0 py-0">
              <CardContent className="divide-y px-0">
                {items
                  .filter((i) => i.date === day)
                  .map((i) => (
                    <Link
                      key={i.key}
                      to={i.link}
                      className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm hover:bg-accent/60"
                    >
                      <Badge variant={i.label === 'Hearing' ? 'default' : 'outline'}>
                        {i.label}
                      </Badge>
                      <span className="font-medium">{i.title}</span>
                      <span className="text-muted-foreground">· {i.caseTitle}</span>
                    </Link>
                  ))}
              </CardContent>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
