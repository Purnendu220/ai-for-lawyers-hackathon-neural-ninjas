import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { can, EVENT_TYPES, type EventType } from '@casepilot/shared';
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
import { Input, Select } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { useActiveOrg } from '@/features/org/org-context';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { useOnline } from '@/pwa/online';

export function EventDialog({ caseId, trigger }: { caseId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {open && <EventForm caseId={caseId} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EventForm({ caseId, onDone }: { caseId: string; onDone: () => void }) {
  const { id: orgId, org, member } = useActiveOrg();
  const online = useOnline();
  const verifies = can(member.role, 'event.verify', org.policy);
  const [type, setType] = useState<EventType>('hearing');
  const [title, setTitle] = useState('');
  const [dateOnly, setDateOnly] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return setError('Enter a title.');
    setSaving(true);
    try {
      await call('createEvent', {
        orgId,
        caseId,
        fields: { type, title: title.trim(), dateOnly: dateOnly || null },
      });
      toast.success('Added to the timeline.');
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
        <DialogTitle>Add to the timeline</DialogTitle>
        <DialogDescription>
          {verifies
            ? 'A date you enter counts as verified.'
            : 'A lawyer confirms the date before it counts as verified.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="event-type">Type</Label>
          <Select
            id="event-type"
            value={type}
            onChange={(e) => setType(e.target.value as EventType)}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="event-date">Date</Label>
          <Input
            id="event-date"
            type="date"
            value={dateOnly}
            onChange={(e) => setDateOnly(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="event-title">Title</Label>
        <Input
          id="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Final arguments"
        />
      </div>
      <FieldError>{error}</FieldError>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !online}>
          Add
        </Button>
      </DialogFooter>
    </form>
  );
}
