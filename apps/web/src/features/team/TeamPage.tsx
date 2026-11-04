import { useMutation } from '@tanstack/react-query';
import { collection, query, where, type Timestamp } from 'firebase/firestore';
import { Copy, LoaderCircle, UserX, UserCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  assignableRoles,
  can,
  formatInstant,
  paths,
  ROLE_LABELS,
  WORKSPACE_FEATURES,
  type InvitationDoc,
  type Role,
} from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { useActiveOrg } from '@/features/org/org-context';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { db } from '@/lib/firebase';
import { useLiveQuery } from '@/lib/live';
import { useOnline } from '@/pwa/online';
import { copyLink, invitationLink } from './invite-links';
import { InviteDialog } from './InviteDialog';
import { memberName, useMembers, type Member } from './useMembers';

export default function TeamPage() {
  const { id: orgId, org, member: me } = useActiveOrg();
  const canManage = can(me.role, 'member.manage', org.policy);
  const teamInvites = WORKSPACE_FEATURES[org.workspaceType].teamInvites;
  const { members, loading } = useMembers();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        {canManage && teamInvites && <InviteDialog />}
      </div>

      {!teamInvites && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solo workspace</CardTitle>
            <CardDescription>
              A solo workspace has one member. To work with colleagues,{' '}
              <Link to="/onboarding" className="text-primary underline-offset-4 hover:underline">
                create a law firm or corporate workspace
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoaderCircle className="mx-auto size-6 animate-spin text-muted-foreground" aria-label="Loading members" />
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <MemberRow key={m.id} member={m} isMe={m.id === me.id} canManage={canManage} orgId={orgId} myRole={me.role} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage && teamInvites && <PendingInvitations orgId={orgId} />}
    </div>
  );
}

function MemberRow({
  member,
  isMe,
  canManage,
  orgId,
  myRole,
}: {
  member: Member;
  isMe: boolean;
  canManage: boolean;
  orgId: string;
  myRole: Role;
}) {
  const online = useOnline();
  const roles = assignableRoles(myRole, member.role);
  const manageable = canManage && !isMe && roles.length > 0;
  const update = useMutation({
    mutationFn: (change: { role?: Role; status?: 'active' | 'suspended' }) =>
      call('updateMember', { orgId, uid: member.id, ...change }),
    onSuccess: () => toast.success('Member updated.'),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const busy = update.isPending || !online;

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
        {memberName(member).charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          {memberName(member)}
          {isMe && <Badge variant="secondary">You</Badge>}
          {member.status === 'suspended' && <Badge variant="destructive">Suspended</Badge>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>
      {manageable ? (
        <div className="flex items-center gap-2">
          <Select
            aria-label={`Role for ${memberName(member)}`}
            className="w-36"
            value={member.role}
            disabled={busy}
            onChange={(e) => update.mutate({ role: e.target.value as Role })}
          >
            {[...new Set([member.role, ...roles])].map((role) => (
              <option key={role} value={role} disabled={!roles.includes(role)}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
          {member.status === 'active' ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => update.mutate({ status: 'suspended' })}>
              <UserX aria-hidden />
              Suspend
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => update.mutate({ status: 'active' })}>
              <UserCheck aria-hidden />
              Reactivate
            </Button>
          )}
        </div>
      ) : (
        <Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
      )}
    </li>
  );
}

function PendingInvitations({ orgId }: { orgId: string }) {
  const online = useOnline();
  const pendingQuery = useMemo(
    () => query(collection(db(), paths.invitations(orgId)), where('status', '==', 'pending')),
    [orgId],
  );
  const pending = useLiveQuery<InvitationDoc<Timestamp>>(pendingQuery);
  const revoke = useMutation({
    mutationFn: (inviteId: string) => call('revokeInvitation', { orgId, inviteId }),
    onSuccess: () => toast.success('Invitation withdrawn.'),
    onError: (error) => toast.error(errorMessage(error)),
  });

  // Expiry is judged against the time the list was opened.
  const [openedAt] = useState(Date.now);
  const invitations = [...(pending.data ?? [])].sort(
    (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
        <CardDescription>Links you have created that nobody has used yet.</CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          <ul className="divide-y">
            {invitations.map((invitation) => {
              const expired = invitation.expiresAt.toMillis() < openedAt;
              return (
                <li key={invitation.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABELS[invitation.role]} ·{' '}
                      {expired ? 'Expired' : `Expires ${formatInstant(invitation.expiresAt.toDate())}`}
                    </p>
                  </div>
                  {!expired && (
                    <Button size="sm" variant="outline" onClick={() => copyLink(invitationLink(orgId, invitation.id))}>
                      <Copy aria-hidden />
                      Copy link
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revoke.isPending || !online}
                    onClick={() => revoke.mutate(invitation.id)}
                  >
                    <X aria-hidden />
                    Withdraw
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
