import { collection, query, where, type Timestamp } from 'firebase/firestore';
import { FileText } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { paths, type AnalysisDoc } from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useActiveOrg } from '@/features/org/org-context';
import { db } from '@/lib/firebase';
import { useLiveQuery } from '@/lib/live';

/** Directions a lawyer approved in an AI review, newest order first. */
export function CourtDirections({ caseId }: { caseId: string }) {
  const { id: orgId } = useActiveOrg();
  const reviewedQuery = useMemo(
    () =>
      query(
        collection(db(), paths.analyses(orgId, caseId)),
        where('status', 'in', ['in_review', 'reviewed']),
      ),
    [orgId, caseId],
  );
  const analyses = useLiveQuery<AnalysisDoc<Timestamp>>(reviewedQuery);

  const directions = [...(analyses.data ?? [])]
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
    .flatMap((analysis) =>
      analysis.directions
        .filter((d) => d.decision === 'approved' || d.decision === 'edited')
        .map((direction) => ({ analysisId: analysis.id, direction })),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4" aria-hidden />
          Court directions
        </CardTitle>
        {directions.length === 0 && (
          <CardDescription>
            Directions appear here once a lawyer approves them in an AI review.{' '}
            <Link to="../documents" relative="path" className="text-primary underline-offset-4 hover:underline">
              Upload an order
            </Link>
          </CardDescription>
        )}
      </CardHeader>
      {directions.length > 0 && (
        <CardContent>
          <ul className="flex flex-col gap-3 text-sm">
            {directions.map(({ analysisId, direction }) => (
              <li key={`${analysisId}-${direction.itemId}`} className="flex flex-col gap-1">
                <p>{direction.edits?.text ?? direction.direction}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {direction.directionType === 'conditional' && <Badge variant="warning">Conditional</Badge>}
                  <Link
                    to={`../ai-review/${analysisId}`}
                    relative="path"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    {direction.sourceRef.unit === 'section' ? 'Section' : 'Page'} {direction.sourceRef.page ?? '?'} of
                    the order
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
