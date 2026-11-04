import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import {
  TASK_PRIORITIES,
  WORKSPACE_FEATURES,
  type ReviewDecision,
  type ReviewEdits,
  type TaskPriority,
} from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { useActiveOrg } from '@/features/org/org-context';
import { memberName, useMembers } from '@/features/team/useMembers';
import { useOnline } from '@/pwa/online';
import { PRIORITY_LABELS } from './labels';
import { DECISION_LABELS, KIND_RESULT, type ReviewItem } from './review-logic';

type ItemReviewProps = {
  entry: ReviewItem;
  canReview: boolean;
  onDecide: (decision: ReviewDecision) => Promise<void>;
};

/** Decision controls for one AI item, or the decision once it has been made. */
export function ItemReview({ entry, canReview, onDecide }: ItemReviewProps) {
  const { kind, item } = entry;
  const { byId } = useMembers();
  const online = useOnline();
  const [mode, setMode] = useState<'idle' | 'edit' | 'confirm-date'>('idle');
  const [busy, setBusy] = useState(false);

  async function decide(decision: ReviewDecision) {
    setBusy(true);
    try {
      await onDecide(decision);
      setMode('idle');
    } catch {
      // The page has already shown the error; the form stays open so nothing typed is lost.
    } finally {
      setBusy(false);
    }
  }

  if (item.decision !== 'pending') {
    const result = item.decision !== 'rejected' ? KIND_RESULT[kind] : undefined;
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={item.decision === 'rejected' ? 'outline' : 'success'}>
          {DECISION_LABELS[item.decision]}
        </Badge>
        {result && <span>{result}</span>}
        {item.decidedBy && <span>by {memberName(byId.get(item.decidedBy))}</span>}
      </div>
    );
  }
  if (!canReview) return null;

  const disabled = busy || !online;
  if (mode === 'edit') {
    return (
      <EditForm
        entry={entry}
        disabled={disabled}
        onCancel={() => setMode('idle')}
        onSave={(edits) => decide({ itemId: item.itemId, action: 'edit', edits })}
      />
    );
  }
  if (mode === 'confirm-date' && kind === 'date') {
    return (
      <ConfirmDate
        dateText={entry.item.dateText}
        disabled={disabled}
        onCancel={() => setMode('idle')}
        onApprove={(date) =>
          decide({ itemId: item.itemId, action: 'approve', edits: date ? { date } : undefined })
        }
      />
    );
  }

  // A date the order doesn't state outright is confirmed (or left open) before approval.
  const approve = () =>
    kind === 'date' && !entry.item.normalizedDate
      ? setMode('confirm-date')
      : void decide({ itemId: item.itemId, action: 'approve' });

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={disabled} onClick={approve}>
        <Check aria-hidden />
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => setMode('edit')}>
        <Pencil aria-hidden />
        Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={disabled}
        onClick={() => void decide({ itemId: item.itemId, action: 'reject' })}
      >
        <X aria-hidden />
        Reject
      </Button>
    </div>
  );
}

function ConfirmDate({
  dateText,
  disabled,
  onApprove,
  onCancel,
}: {
  dateText: string;
  disabled: boolean;
  onApprove: (date: string | null) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState('');
  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
      <p>
        The order says “{dateText}”. Work out the actual date, or add it to the timeline as “date to
        be confirmed”.
      </p>
      <Label htmlFor="confirm-date" className="sr-only">
        Date
      </Label>
      <Input
        id="confirm-date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-48"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={disabled || !date} onClick={() => onApprove(date)}>
          Approve with this date
        </Button>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onApprove(null)}>
          Add without a date
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function initialText(entry: ReviewItem): string {
  if (entry.kind === 'fact') return entry.item.fact;
  if (entry.kind === 'direction') return entry.item.direction;
  return '';
}

function initialDate(entry: ReviewItem): string {
  if (entry.kind === 'task') return entry.item.suggestedDueDate ?? '';
  if (entry.kind === 'date') return entry.item.normalizedDate ?? '';
  return '';
}

function EditForm({
  entry,
  disabled,
  onSave,
  onCancel,
}: {
  entry: ReviewItem;
  disabled: boolean;
  onSave: (edits: ReviewEdits) => void;
  onCancel: () => void;
}) {
  const { org } = useActiveOrg();
  const { members } = useMembers();
  const assignees = members.filter((m) => m.status === 'active' && m.role !== 'viewer');
  const canAssign = WORKSPACE_FEATURES[org.workspaceType].taskAssignment;
  const id = entry.item.itemId;

  const [text, setText] = useState(() => initialText(entry));
  const [title, setTitle] = useState(entry.kind === 'task' ? entry.item.title : '');
  const [description, setDescription] = useState(
    entry.kind === 'task' ? entry.item.description : '',
  );
  const [priority, setPriority] = useState<TaskPriority>(
    entry.kind === 'task' ? entry.item.priority : 'medium',
  );
  const [date, setDate] = useState(() => initialDate(entry));
  const [assignedTo, setAssignedTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (entry.kind === 'fact' || entry.kind === 'direction') {
      if (!text.trim()) return setError('Enter the text.');
      return onSave({ text: text.trim() });
    }
    if (entry.kind === 'date') {
      return onSave({ date: date || null, ...(title.trim() ? { text: title.trim() } : {}) });
    }
    if (!title.trim()) return setError('Enter a title.');
    return onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      date: date || null,
      assignedTo: assignedTo || null,
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3 rounded-md bg-muted p-3"
      noValidate
    >
      {(entry.kind === 'fact' || entry.kind === 'direction') && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-text`}>{entry.kind === 'fact' ? 'Fact' : 'Direction'}</Label>
          <Textarea id={`${id}-text`} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      )}
      {entry.kind === 'task' && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-title`}>Task</Label>
            <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-description`}>Details</Label>
            <Textarea
              id={`${id}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-priority`}>Priority</Label>
            <Select
              id={`${id}-priority`}
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
              <Label htmlFor={`${id}-assignee`}>Assign to</Label>
              <Select
                id={`${id}-assignee`}
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Nobody yet</option>
                {assignees.map((m) => (
                  <option key={m.id} value={m.id}>
                    {memberName(m)}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </>
      )}
      {entry.kind === 'date' && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-title`}>Title on the timeline (optional)</Label>
          <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      )}
      {(entry.kind === 'task' || entry.kind === 'date') && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-date`}>{entry.kind === 'task' ? 'Due date' : 'Date'}</Label>
          <Input
            id={`${id}-date`}
            type="date"
            className="w-48"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      )}
      <FieldError>{error}</FieldError>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={disabled}>
          Save and approve
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
