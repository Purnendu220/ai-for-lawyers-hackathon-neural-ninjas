import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  WORKSPACE_FEATURES,
  type TaskPriority,
  type TaskStatus,
} from '@casepilot/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { useActiveOrg } from '@/features/org/org-context';
import { memberName, useMembers } from '@/features/team/useMembers';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/labels';
import { useOnline } from '@/pwa/online';
import type { Task } from './useTasks';

type TaskDialogProps = {
  caseId: string;
  /** Edit this task; omit to create one. */
  task?: Task;
  trigger: ReactNode;
};

export function TaskDialog({ caseId, task, trigger }: TaskDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {open && <TaskForm caseId={caseId} task={task} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({ caseId, task, onDone }: { caseId: string; task?: Task; onDone: () => void }) {
  const { id: orgId, org, member } = useActiveOrg();
  const { members } = useMembers();
  const online = useOnline();
  const canAssign = WORKSPACE_FEATURES[org.workspaceType].taskAssignment;
  const isParalegal = member.role === 'paralegal';
  const assignees = members.filter(
    (m) => m.status === 'active' && m.role !== 'viewer' && (!isParalegal || m.id === member.id),
  );

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [dueDateOnly, setDueDateOnly] = useState(task?.dueDateOnly ?? '');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? (isParalegal ? member.id : ''));
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'open');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return setError('Enter a title.');
    setSaving(true);
    setError(null);
    const fields = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDateOnly: dueDateOnly || null,
      assignedTo: assignedTo || null,
    };
    try {
      if (task) {
        const changes = Object.fromEntries(
          Object.entries({ ...fields, status }).filter(
            ([key, value]) => (task as unknown as Record<string, unknown>)[key] !== value,
          ),
        );
        if (Object.keys(changes).length > 0) {
          await call('updateTask', { orgId, caseId, taskId: task.id, changes });
        }
        toast.success('Task updated.');
      } else {
        await call('createTask', { orgId, caseId, fields });
        toast.success('Task added.');
      }
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="grid gap-4"
      noValidate
    >
      <DialogHeader>
        <DialogTitle>{task ? 'Edit task' : 'New task'}</DialogTitle>
        {task?.origin === 'ai' && (
          <DialogDescription>Added from an AI suggestion that a lawyer approved.</DialogDescription>
        )}
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="task-title">Task</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={!title.trim() && !!error}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="task-description">Details</Label>
        <Textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="task-due">Due date</Label>
          <Input
            id="task-due"
            type="date"
            value={dueDateOnly}
            onChange={(e) => setDueDateOnly(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="task-priority">Priority</Label>
          <Select
            id="task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
        </div>
        {canAssign && (
          <div className="grid gap-1.5">
            <Label htmlFor="task-assignee">Assigned to</Label>
            <Select
              id="task-assignee"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={isParalegal}
            >
              {!isParalegal && <option value="">Nobody yet</option>}
              {assignees.map((m) => (
                <option key={m.id} value={m.id}>
                  {memberName(m)}
                </option>
              ))}
            </Select>
          </div>
        )}
        {task && (
          <div className="grid gap-1.5">
            <Label htmlFor="task-status">Status</Label>
            <Select
              id="task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <FieldError>{error}</FieldError>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !online}>
          {task ? 'Save' : 'Add task'}
        </Button>
      </DialogFooter>
    </form>
  );
}
