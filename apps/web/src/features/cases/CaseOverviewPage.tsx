import { useMutation } from '@tanstack/react-query';
import { Archive, CalendarClock, FileText, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  can,
  formatDateOnly,
  formatInstant,
  ROLE_LABELS,
  WORKSPACE_FEATURES,
  type CaseFormValues,
} from '@casepilot/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useActiveOrg } from '@/features/org/org-context';
import { memberName, useMembers } from '@/features/team/useMembers';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { useOnline } from '@/pwa/online';
import { useCase } from './case-context';
import { CaseForm } from './CaseForm';
import type { Case } from './useCases';

function toFormValues(kase: Case): CaseFormValues {
  return {
    title: kase.title,
    caseNumber: kase.caseNumber ?? '',
    courtName: kase.courtName ?? '',
    matterType: kase.matterType ?? '',
    caseType: kase.caseType ?? '',
    clientName: kase.clientName ?? '',
    opposingParty: kase.opposingParty ?? '',
    assignedLawyerIds: kase.assignedLawyerIds,
    status: kase.status === 'archived' ? 'active' : kase.status,
  };
}

export default function CaseOverviewPage() {
  const kase = useCase();
  const { id: orgId, org, member } = useActiveOrg();
  const { byId } = useMembers();
  const [editing, setEditing] = useState(false);
  const canWrite = can(member.role, 'case.write', org.policy) && kase.status !== 'archived';
  const features = WORKSPACE_FEATURES[org.workspaceType];
  const matterLabel = features.matterTypes.find((m) => m.value === kase.matterType)?.label ?? kase.matterType;

  if (editing && canWrite) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit case</CardTitle>
        </CardHeader>
        <CardContent>
          <CaseForm
            mode="edit"
            submitLabel="Save changes"
            defaultValues={toFormValues(kase)}
            onSubmit={async ({ status, ...fields }) => {
              await call('updateCase', { orgId, caseId: kase.id, fields, status });
              toast.success('Case updated.');
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </CardContent>
      </Card>
    );
  }

  const details: [string, string | null | undefined][] = [
    ['Case number', kase.caseNumber],
    ['Court', kase.courtName],
    ['Jurisdiction', kase.jurisdiction],
    ['Matter type', matterLabel],
    ['Case type', kase.caseType],
    ['Client', kase.clientName],
    ['Opposing party', kase.opposingParty],
    ['Created', kase.createdAt ? `${formatInstant(kase.createdAt.toDate())} by ${memberName(byId.get(kase.createdBy))}` : null],
    ['Last updated', kase.updatedAt ? formatInstant(kase.updatedAt.toDate()) : null],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle>Details</CardTitle>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" aria-hidden />
              Next hearing
            </CardTitle>
            <CardDescription>
              {kase.nextHearingDateOnly
                ? formatDateOnly(kase.nextHearingDateOnly)
                : 'No verified hearing yet. Hearing dates appear once a lawyer confirms them.'}
            </CardDescription>
          </CardHeader>
        </Card>

        {features.taskAssignment && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assigned team</CardTitle>
            </CardHeader>
            <CardContent>
              {kase.assignedLawyerIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody is assigned.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {kase.assignedLawyerIds.map((uid) => {
                    const assignee = byId.get(uid);
                    return (
                      <li key={uid} className="flex justify-between gap-2">
                        <span className="truncate">{memberName(assignee)}</span>
                        {assignee && (
                          <span className="text-muted-foreground">{ROLE_LABELS[assignee.role]}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden />
              Court directions
            </CardTitle>
            <CardDescription>
              Directions from reviewed court orders appear here.{' '}
              <Link to="../documents" relative="path" className="text-primary underline-offset-4 hover:underline">
                Upload an order
              </Link>
            </CardDescription>
          </CardHeader>
        </Card>

        {canWrite && <ArchiveCard orgId={orgId} kase={kase} />}
      </div>
    </div>
  );
}

function ArchiveCard({ orgId, kase }: { orgId: string; kase: Case }) {
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const archive = useMutation({
    mutationFn: () => call('archiveCase', { orgId, caseId: kase.id, archived: true }),
    onSuccess: () => {
      setOpen(false);
      toast.success('Case archived.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Archive</CardTitle>
        <CardDescription>
          Archived cases leave the active list and become read-only. You can restore them later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={!online}>
              <Archive aria-hidden />
              Archive case
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive this case?</DialogTitle>
              <DialogDescription>
                “{kase.title}” becomes read-only and leaves the active list. Nothing is deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button disabled={archive.isPending} onClick={() => archive.mutate()}>
                Archive case
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
