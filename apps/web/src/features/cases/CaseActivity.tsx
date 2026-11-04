import { useInfiniteQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { formatInstant } from '@casepilot/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useActiveOrg } from '@/features/org/org-context';
import { memberName, useMembers } from '@/features/team/useMembers';
import { call } from '@/lib/callables';
import { ACTIVITY_LABELS } from '@/lib/labels';

/** Who did what on this case, from the audit log (listCaseActivity). */
export function CaseActivity({ caseId }: { caseId: string }) {
  const { id: orgId } = useActiveOrg();
  const { byId } = useMembers();
  const activity = useInfiniteQuery({
    queryKey: ['caseActivity', orgId, caseId],
    queryFn: ({ pageParam }) =>
      call('listCaseActivity', { orgId, caseId, after: pageParam, limit: 10 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  });
  const entries = activity.data?.pages.flatMap((p) => p.entries) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4" aria-hidden />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activity.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : activity.isError ? (
          <p className="text-sm text-muted-foreground">Activity is unavailable offline.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {entries.map((entry) => (
              <li key={entry.id}>
                <span className="font-medium">{memberName(byId.get(entry.actorUid))}</span>{' '}
                {ACTIVITY_LABELS[entry.action] ?? entry.action}
                {entry.at && (
                  <span className="block text-xs text-muted-foreground">
                    {formatInstant(new Date(entry.at))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {activity.hasNextPage && (
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            disabled={activity.isFetchingNextPage}
            onClick={() => void activity.fetchNextPage()}
          >
            Show more
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
