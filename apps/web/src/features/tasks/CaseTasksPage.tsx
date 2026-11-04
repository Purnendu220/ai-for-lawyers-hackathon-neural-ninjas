import { Columns3, List, LoaderCircle, Plus } from 'lucide-react';
import { useState } from 'react';
import { can, type TaskStatus } from '@casepilot/shared';
import { Button } from '@/components/ui/button';
import { useCase } from '@/features/cases/case-context';
import { useActiveOrg } from '@/features/org/org-context';
import { TASK_STATUS_LABELS } from '@/lib/labels';
import { useToday } from '@/lib/today';
import { cn } from '@/lib/utils';
import { TaskDialog } from './TaskDialog';
import { TaskRow } from './TaskRow';
import { byDueDate, useCaseTasks } from './useTasks';

const VIEW_KEY = 'casepilot.caseTasksView';
const BOARD: TaskStatus[] = ['open', 'in_progress', 'completed'];

function savedView(): 'list' | 'board' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list';
  } catch {
    return 'list';
  }
}

export default function CaseTasksPage() {
  const kase = useCase();
  const { org, member } = useActiveOrg();
  const { today } = useToday();
  const tasks = useCaseTasks(kase.id);
  const [view, setView] = useState(savedView);
  const canCreate = can(member.role, 'task.write', org.policy) && kase.status !== 'archived';

  function chooseView(next: 'list' | 'board') {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered; fine.
    }
  }

  const all = [...(tasks.data ?? [])].sort(byDueDate);
  const active = all.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const finished = all.filter((t) => t.status === 'completed' || t.status === 'cancelled');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="View">
          {(['list', 'board'] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={view === option ? 'secondary' : 'ghost'}
              aria-pressed={view === option}
              onClick={() => chooseView(option)}
            >
              {option === 'list' ? <List aria-hidden /> : <Columns3 aria-hidden />}
              {option === 'list' ? 'List' : 'Board'}
            </Button>
          ))}
        </div>
        {canCreate && (
          <TaskDialog
            caseId={kase.id}
            trigger={
              <Button>
                <Plus aria-hidden />
                New task
              </Button>
            }
          />
        )}
      </div>

      {tasks.loading ? (
        <LoaderCircle
          className="mx-auto size-6 animate-spin text-muted-foreground"
          aria-label="Loading tasks"
        />
      ) : all.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No tasks yet. Approve suggested tasks in an AI review, or add one yourself.
        </p>
      ) : view === 'list' ? (
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col gap-2">
            {active.map((task) => (
              <li key={task.id}>
                <TaskRow task={task} today={today} />
              </li>
            ))}
          </ul>
          {finished.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Done and cancelled</h2>
              <ul className="flex flex-col gap-2">
                {finished.map((task) => (
                  <li key={task.id}>
                    <TaskRow task={task} today={today} compact />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {BOARD.map((status) => {
            const column = all.filter((t) => t.status === status);
            return (
              <section
                key={status}
                className={cn('flex flex-col gap-2 rounded-xl bg-muted/60 p-3')}
              >
                <h2 className="text-sm font-medium">
                  {TASK_STATUS_LABELS[status]}{' '}
                  <span className="text-muted-foreground">({column.length})</span>
                </h2>
                {column.map((task) => (
                  <TaskRow key={task.id} task={task} today={today} compact />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
