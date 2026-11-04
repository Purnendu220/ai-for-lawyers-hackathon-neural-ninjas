import { Briefcase, LoaderCircle, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  can,
  CASE_STATUS_LABELS,
  CASE_STATUSES,
  formatDateOnly,
  WORKSPACE_FEATURES,
  type CaseStatus,
} from '@casepilot/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { useActiveOrg } from '@/features/org/org-context';
import { memberName, useMembers } from '@/features/team/useMembers';
import { CaseStatusBadge } from './CaseStatusBadge';
import { useCases, type Case } from './useCases';

type StatusFilter = 'open' | CaseStatus;

const PAGE_SIZE = 25;

function matches(kase: Case, search: string): boolean {
  if (!search) return true;
  return [kase.title, kase.caseNumber, kase.clientName, kase.opposingParty, kase.courtName].some(
    (value) => value?.toLowerCase().includes(search),
  );
}

export default function CasesPage() {
  const { org, member } = useActiveOrg();
  const cases = useCases();
  const { byId, assignable } = useMembers();
  const showLawyerFilter = WORKSPACE_FEATURES[org.workspaceType].taskAssignment;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [court, setCourt] = useState('');
  const [lawyer, setLawyer] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const all = useMemo(() => cases.data ?? [], [cases.data]);
  const courts = useMemo(
    () => [...new Set(all.map((c) => c.courtName).filter((name): name is string => !!name))].sort(),
    [all],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (c) =>
        (status === 'open'
          ? c.status === 'active' || c.status === 'pending'
          : c.status === status) &&
        (!court || c.courtName === court) &&
        (!lawyer || c.assignedLawyerIds.includes(lawyer)) &&
        matches(c, q),
    );
  }, [all, search, status, court, lawyer]);

  // Every filter change starts again from the first page.
  const filterChange =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setLimit(PAGE_SIZE);
    };

  const clearFilters = () => {
    setSearch('');
    setStatus('open');
    setCourt('');
    setLawyer('');
    setLimit(PAGE_SIZE);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        {can(member.role, 'case.write', org.policy) && (
          <Button asChild>
            <Link to="/cases/new">New case</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Search title, number, party…"
            aria-label="Search cases"
            value={search}
            onChange={(e) => filterChange(setSearch)(e.target.value)}
          />
        </div>
        <Select
          aria-label="Status"
          value={status}
          onChange={(e) => filterChange(setStatus)(e.target.value as StatusFilter)}
        >
          <option value="open">Active and pending</option>
          {CASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CASE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Court"
          value={court}
          onChange={(e) => filterChange(setCourt)(e.target.value)}
        >
          <option value="">All courts</option>
          {courts.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        {showLawyerFilter && (
          <Select
            aria-label="Assigned lawyer"
            value={lawyer}
            onChange={(e) => filterChange(setLawyer)(e.target.value)}
          >
            <option value="">Anyone assigned</option>
            {assignable.map((m) => (
              <option key={m.id} value={m.id}>
                {memberName(m)}
              </option>
            ))}
          </Select>
        )}
      </div>

      {cases.loading ? (
        <div className="flex justify-center py-12" role="status">
          <LoaderCircle
            className="size-6 animate-spin text-muted-foreground"
            aria-label="Loading cases"
          />
        </div>
      ) : cases.error ? (
        <p className="text-sm text-destructive">
          We couldn't load cases. Check your connection and try again.
        </p>
      ) : all.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Briefcase className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">No cases yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create a case, then upload its court orders to get a reviewable action plan.
            </p>
            {can(member.role, 'case.write', org.policy) && (
              <Button asChild>
                <Link to="/cases/new">Create your first case</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
          No cases match these filters.
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'case' : 'cases'}
          </p>
          <ul className="flex flex-col gap-3">
            {filtered.slice(0, limit).map((c) => (
              <li key={c.id}>
                <Link
                  to={`/cases/${c.id}/overview`}
                  className="block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[c.caseNumber, c.courtName].filter(Boolean).join(' · ') ||
                          'No case number or court yet'}
                      </p>
                    </div>
                    <CaseStatusBadge status={c.status} />
                  </div>
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <div>
                      <dt className="inline text-muted-foreground">Next hearing: </dt>
                      <dd className="inline">
                        {c.nextHearingDateOnly ? formatDateOnly(c.nextHearingDateOnly) : '—'}
                      </dd>
                    </div>
                    {showLawyerFilter && (
                      <div className="min-w-0">
                        <dt className="inline text-muted-foreground">Assigned: </dt>
                        <dd className="inline">
                          {c.assignedLawyerIds.map((uid) => memberName(byId.get(uid))).join(', ') ||
                            '—'}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
          {filtered.length > limit && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setLimit(limit + PAGE_SIZE)}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
