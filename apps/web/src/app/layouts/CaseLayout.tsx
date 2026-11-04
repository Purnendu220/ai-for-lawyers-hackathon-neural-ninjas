import { useMutation } from '@tanstack/react-query';
import type { Timestamp } from 'firebase/firestore';
import { ArchiveRestore, ChevronLeft, LoaderCircle } from 'lucide-react';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { toast } from 'sonner';
import { can, paths, type CaseDoc } from '@casepilot/shared';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CaseContext } from '@/features/cases/case-context';
import { CaseStatusBadge } from '@/features/cases/CaseStatusBadge';
import { useActiveOrg } from '@/features/org/org-context';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { useLiveDoc } from '@/lib/live';
import { cn } from '@/lib/utils';
import { useOnline } from '@/pwa/online';

const TABS = [
  { to: 'overview', label: 'Overview' },
  { to: 'documents', label: 'Documents' },
  { to: 'timeline', label: 'Timeline' },
  { to: 'tasks', label: 'Tasks' },
  { to: 'copilot', label: 'Copilot' },
];

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Loads the case live and shares it with the tabs below it (see useCase). */
export function CaseLayout() {
  const { caseId = '' } = useParams();
  const { id: orgId, org, member } = useActiveOrg();
  const online = useOnline();
  const live = useLiveDoc<CaseDoc<Timestamp>>(
    VALID_ID.test(caseId) ? paths.case(orgId, caseId) : null,
  );
  const restore = useMutation({
    mutationFn: () => call('archiveCase', { orgId, caseId, archived: false }),
    onSuccess: () => toast.success('Case restored.'),
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (live.loading) {
    return (
      <div className="flex justify-center py-12" role="status">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Loading case" />
      </div>
    );
  }

  if (!live.data) {
    return (
      <Card className="mx-auto w-full max-w-xl">
        <CardHeader>
          <CardTitle>Case not found</CardTitle>
          <CardDescription>
            It may have been removed, or it belongs to a workspace you are not in.
          </CardDescription>
        </CardHeader>
        <div className="px-6">
          <Button asChild variant="outline">
            <Link to="/cases">Back to cases</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const kase = live.data;
  const context: CaseContext = { kase };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to="/cases"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Cases
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{kase.title}</h1>
            <p className="text-sm text-muted-foreground">
              {[kase.caseNumber, kase.courtName].filter(Boolean).join(' · ') || 'No case number or court yet'}
            </p>
          </div>
          <CaseStatusBadge status={kase.status} />
        </div>
      </div>

      {kase.status === 'archived' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted px-4 py-3 text-sm">
          This case is archived. It is read-only until restored.
          {can(member.role, 'case.write', org.policy) && (
            <Button
              size="sm"
              variant="outline"
              disabled={restore.isPending || !online}
              onClick={() => restore.mutate()}
            >
              <ArchiveRestore aria-hidden />
              Restore
            </Button>
          )}
        </div>
      )}

      <nav aria-label="Case sections" className="-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground',
                  isActive && 'border-primary text-foreground',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet context={context} />
    </div>
  );
}
