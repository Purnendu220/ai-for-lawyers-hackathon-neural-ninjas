import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { WORKSPACE_FEATURES } from '@casepilot/shared';
import { Button } from '@/components/ui/button';
import { useActiveOrg } from '@/features/org/org-context';
import { addDays, useToday } from '@/lib/today';
import { TaskRow } from './TaskRow';
import { byDueDate, isTaskOverdue, useOrgTasks, type Task } from './useTasks';

type Group = { title: string; tasks: Task[] };

function groupTasks(tasks: Task[], today: string): Group[] {
  const weekEnd = addDays(today, 7);
  const open = tasks.filter((t) => t.status !== 'completed');
  const groups: Group[] = [
    { title: 'Overdue', tasks: open.filter((t) => isTaskOverdue(t, today)) },
    {
      title: 'Due in the next 7 days',
      tasks: open.filter(
        (t) => t.dueDateOnly && t.dueDateOnly >= today && t.dueDateOnly <= weekEnd,
      ),
    },
    { title: 'Later', tasks: open.filter((t) => t.dueDateOnly && t.dueDateOnly > weekEnd) },
    { title: 'No due date', tasks: open.filter((t) => !t.dueDateOnly) },
    { title: 'Done', tasks: tasks.filter((t) => t.status === 'completed') },
  ];
  return groups.filter((g) => g.tasks.length > 0);
}

export default function TasksPage() {
  const { org, member } = useActiveOrg();
  const { today } = useToday();
  const team = WORKSPACE_FEATURES[org.workspaceType].taskAssignment;
  const [scope, setScope] = useState<'mine' | 'all'>(team ? 'mine' : 'all');
  const [includeDone, setIncludeDone] = useState(false);
  const tasks = useOrgTasks({ assignedTo: scope === 'mine' ? member.id : undefined, includeDone });
  const groups = groupTasks([...(tasks.data ?? [])].sort(byDueDate), today);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <div className="flex flex-wrap items-center gap-3">
          {team && (
            <div
              className="inline-flex rounded-md border p-0.5"
              role="group"
              aria-label="Whose tasks"
            >
              {(['mine', 'all'] as const).map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={scope === option ? 'secondary' : 'ghost'}
                  aria-pressed={scope === option}
                  onClick={() => setScope(option)}
                >
                  {option === 'mine' ? 'Assigned to me' : 'Everyone'}
                </Button>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={includeDone}
              onChange={(e) => setIncludeDone(e.target.checked)}
            />
            Show done
          </label>
        </div>
      </div>

      {tasks.loading ? (
        <LoaderCircle
          className="mx-auto size-6 animate-spin text-muted-foreground"
          aria-label="Loading tasks"
        />
      ) : tasks.error ? (
        <p className="text-sm text-destructive">
          We couldn't load tasks. Check your connection and try again.
        </p>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {scope === 'mine' ? 'Nothing assigned to you.' : 'No open tasks.'}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-2">
            <h2
              className={
                group.title === 'Overdue'
                  ? 'text-sm font-medium text-destructive'
                  : 'text-sm font-medium text-muted-foreground'
              }
            >
              {group.title} ({group.tasks.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {group.tasks.map((task) => (
                <li key={task.id}>
                  <TaskRow task={task} today={today} showCase compact />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
