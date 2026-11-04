import { useMutation } from '@tanstack/react-query';
import { Pencil, Quote } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { formatDateOnly, TASK_STATUSES, type TaskStatus } from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { useActiveOrg } from '@/features/org/org-context';
import { memberName, useMembers } from '@/features/team/useMembers';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { useOnline } from '@/pwa/online';
import { TaskDialog } from './TaskDialog';
import { isTaskOverdue, useCanEditTask, type Task } from './useTasks';

type TaskRowProps = {
  task: Task;
  today: string;
  /** Show which case the task belongs to (cross-case lists). */
  showCase?: boolean;
  compact?: boolean;
};

export function TaskRow({ task, today, showCase = false, compact = false }: TaskRowProps) {
  const { id: orgId } = useActiveOrg();
  const { byId } = useMembers();
  const online = useOnline();
  const canEdit = useCanEditTask(task);
  const overdue = isTaskOverdue(task, today);
  const done = task.status === 'completed' || task.status === 'cancelled';
  const setStatus = useMutation({
    mutationFn: (status: TaskStatus) =>
      call('updateTask', { orgId, caseId: task.caseId, taskId: task.id, changes: { status } }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm',
        done && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('font-medium', task.status === 'completed' && 'line-through')}>
            {task.title}
          </p>
          {showCase && (
            <Link
              to={`/cases/${task.caseId}/tasks`}
              className="text-xs text-muted-foreground hover:underline"
            >
              {task.caseTitle}
            </Link>
          )}
          {!compact && task.description && (
            <p className="mt-1 text-muted-foreground">{task.description}</p>
          )}
        </div>
        {canEdit && (
          <TaskDialog
            caseId={task.caseId}
            task={task}
            trigger={
              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                aria-label={`Edit ${task.title}`}
              >
                <Pencil />
              </Button>
            }
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {task.dueDateOnly ? (
          <Badge variant={overdue ? 'destructive' : 'outline'}>
            {overdue ? 'Overdue · ' : 'Due '}
            {formatDateOnly(task.dueDateOnly)}
          </Badge>
        ) : (
          <Badge variant="secondary">No due date</Badge>
        )}
        {(task.priority === 'high' || task.priority === 'urgent') && (
          <Badge variant={task.priority === 'urgent' ? 'destructive' : 'warning'}>
            {PRIORITY_LABELS[task.priority]}
          </Badge>
        )}
        {task.assignedTo && (
          <Badge variant="outline">{memberName(byId.get(task.assignedTo))}</Badge>
        )}
        {task.condition && <Badge variant="warning">Only if: {task.condition}</Badge>}
        {task.origin === 'ai' && task.analysisId && task.sourceRef?.page && (
          <Link
            to={`/cases/${task.caseId}/ai-review/${task.analysisId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Quote className="size-3" aria-hidden />
            From the order, {task.sourceRef.unit === 'section' ? 'section' : 'page'}{' '}
            {task.sourceRef.page}
          </Link>
        )}
        <div className="ml-auto">
          {canEdit ? (
            <Select
              aria-label={`Status of ${task.title}`}
              className="h-8 w-36"
              value={task.status}
              disabled={setStatus.isPending || !online}
              onChange={(e) => setStatus.mutate(e.target.value as TaskStatus)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          ) : (
            <Badge variant="secondary">{TASK_STATUS_LABELS[task.status]}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
