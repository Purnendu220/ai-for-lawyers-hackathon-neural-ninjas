import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  assignableRoles,
  INVITABLE_ROLES,
  INVITATION_TTL_DAYS,
  InviteMemberInput,
  ROLE_LABELS,
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
import { Input, Select } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { useActiveOrg } from '@/features/org/org-context';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { useOnline } from '@/pwa/online';
import { copyLink, invitationLink } from './invite-links';

const InviteForm = InviteMemberInput.omit({ orgId: true });
type InviteForm = { email: string; role: (typeof INVITABLE_ROLES)[number] };


export function InviteDialog() {
  const { id: orgId, member } = useActiveOrg();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<{ email: string; link: string } | null>(null);
  const roles = INVITABLE_ROLES.filter((r) => assignableRoles(member.role, null).includes(r));
  const form = useForm<InviteForm>({
    resolver: zodResolver(InviteForm),
    defaultValues: { email: '', role: roles.includes('lawyer') ? 'lawyer' : (roles[0] ?? 'viewer') },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email, role }) => {
    try {
      const { inviteId, existing } = await call('inviteMember', { orgId, email, role });
      setSent({ email, link: invitationLink(orgId, inviteId) });
      if (existing) toast.info('This person already had a pending invitation. Here is the same link.');
    } catch (error) {
      form.setError('root', { message: errorMessage(error) });
    }
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSent(null);
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={!online}>
          <UserPlus aria-hidden />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sent ? 'Share this invitation' : 'Invite a team member'}</DialogTitle>
          <DialogDescription>
            {sent
              ? `Send this link to ${sent.email}. It works for ${INVITATION_TTL_DAYS} days, and only for someone signed in with that email address.`
              : 'CasePilot creates a private link for you to share. Nothing is emailed automatically.'}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex gap-2">
            <Input readOnly value={sent.link} aria-label="Invitation link" onFocus={(e) => e.target.select()} />
            <Button type="button" variant="outline" onClick={() => copyLink(sent.link)}>
              <Copy aria-hidden />
              Copy
            </Button>
          </div>
        ) : (
          <form id="invite-form" onSubmit={onSubmit} noValidate className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                aria-invalid={!!errors.email}
                {...form.register('email')}
              />
              <FieldError>{errors.email?.message}</FieldError>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select id="invite-role" {...form.register('role')}>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </div>
            <FieldError>{errors.root?.message}</FieldError>
          </form>
        )}

        <DialogFooter>
          {sent ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <Button type="submit" form="invite-form" disabled={isSubmitting || !online}>
              {isSubmitting ? 'Creating link…' : 'Create invitation link'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
