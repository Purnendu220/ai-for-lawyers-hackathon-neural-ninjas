import type { Timestamp } from 'firebase/firestore';
import { AlertTriangle, ChevronLeft, FileSearch, LoaderCircle, Quote } from 'lucide-react';
import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  describeWarning,
  formatDateOnly,
  formatInstant,
  isDateOnly,
  paths,
  type AnalysisDoc,
  type DocumentDoc,
  type SourceRef,
} from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCase } from '@/features/cases/case-context';
import { useActiveOrg } from '@/features/org/org-context';
import { useLiveDoc } from '@/lib/live';
import { BASIS_LABELS, DATE_TYPE_LABELS, PRIORITY_LABELS } from './labels';

const PdfViewer = lazy(() => import('@/features/documents/PdfViewer'));

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

function dateLabel(value: string | null): string | null {
  return value && isDateOnly(value) ? formatDateOnly(value) : null;
}

export default function ReviewPage() {
  const kase = useCase();
  const { analysisId = '' } = useParams();
  const { id: orgId } = useActiveOrg();
  const analysis = useLiveDoc<AnalysisDoc<Timestamp>>(
    VALID_ID.test(analysisId) ? paths.analysis(orgId, kase.id, analysisId) : null,
  );
  const documentId = analysis.data?.documentId;
  const document = useLiveDoc<DocumentDoc<Timestamp>>(documentId ? paths.document(orgId, kase.id, documentId) : null);
  const [page, setPage] = useState(1);
  const [highlight, setHighlight] = useState<string | null>(null);
  const viewer = useRef<HTMLDivElement>(null);

  if (analysis.loading || document.loading) {
    return <LoaderCircle className="mx-auto size-6 animate-spin text-muted-foreground" aria-label="Loading analysis" />;
  }
  const data = analysis.data;
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analysis not found</CardTitle>
          <CardDescription>It may have been replaced by a newer analysis of the same document.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const file = document.data;
  const isPdf = file?.mimeType === 'application/pdf';

  function showSource(source: SourceRef) {
    if (source.page === null) return;
    setPage(source.page);
    setHighlight(source.quote);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      viewer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const source = (ref: SourceRef) => <SourceChip source={ref} onShow={() => showSource(ref)} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to="../documents"
          relative="path"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Documents
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">AI review</h2>
          {data.mode === 'fixture' && <Badge variant="warning">Replayed test data, not a live AI result</Badge>}
          {data.status === 'superseded' && <Badge variant="outline">Replaced by a newer analysis</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {file?.fileName ?? 'Document'} · {data.pagesAnalysed} of {data.pageCount}{' '}
          {file?.sourceUnit === 'section' ? 'sections' : 'pages'} analysed
          {data.createdAt && ` · ${formatInstant(data.createdAt.toDate())}`}
        </p>
      </div>

      <div className="rounded-lg border bg-accent px-4 py-3 text-sm">
        These are AI suggestions. Nothing is added to the case until a lawyer approves it. Check each
        item against its source before relying on it.
      </div>

      {data.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          {data.warnings.map((warning) => (
            <li key={warning} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              {describeWarning(warning)}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p>{data.summary}</p>
              <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
                <dt className="text-muted-foreground">Court</dt>
                <dd>{data.caseDetails.courtName ?? '—'}</dd>
                <dt className="text-muted-foreground">Case number</dt>
                <dd>{data.caseDetails.caseNumber ?? '—'}</dd>
                <dt className="text-muted-foreground">Order date</dt>
                <dd>{dateLabel(data.caseDetails.dateOfOrder) ?? '—'}</dd>
                <dt className="text-muted-foreground">Parties</dt>
                <dd>{data.caseDetails.parties.join(', ') || '—'}</dd>
              </dl>
            </CardContent>
          </Card>

          <Section title="Court directions" count={data.directions.length}>
            {data.directions.map((d) => (
              <Item key={d.itemId} source={source(d.sourceRef)}>
                <p>{d.direction}</p>
                <div className="flex flex-wrap gap-2">
                  {d.responsibleParty && <Badge variant="outline">{d.responsibleParty}</Badge>}
                  {d.directionType === 'conditional' && (
                    <Badge variant="warning">Conditional{d.condition ? `: ${d.condition}` : ''}</Badge>
                  )}
                </div>
              </Item>
            ))}
          </Section>

          <Section title="Dates" count={data.dates.length}>
            {data.dates.map((d) => (
              <Item key={d.itemId} source={source(d.sourceRef)}>
                <p className="font-medium">{dateLabel(d.normalizedDate) ?? d.dateText}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{DATE_TYPE_LABELS[d.dateType]}</Badge>
                  {d.basis !== 'explicit' && (
                    <Badge variant="warning">
                      {BASIS_LABELS[d.basis]}: “{d.dateText}”. A lawyer must set the date.
                    </Badge>
                  )}
                </div>
              </Item>
            ))}
          </Section>

          <Section title="Proposed tasks" count={data.proposedTasks.length}>
            {data.proposedTasks.map((t) => (
              <Item key={t.itemId} source={source(t.sourceRef)}>
                <p className="font-medium">{t.title}</p>
                <p className="text-muted-foreground">{t.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{PRIORITY_LABELS[t.priority]} priority</Badge>
                  {dateLabel(t.suggestedDueDate) ? (
                    <Badge variant="outline">Due {dateLabel(t.suggestedDueDate)}</Badge>
                  ) : (
                    <Badge variant="secondary">Due date: {BASIS_LABELS[t.dueDateBasis].toLowerCase()}</Badge>
                  )}
                  {t.condition && <Badge variant="warning">Only if: {t.condition}</Badge>}
                </div>
              </Item>
            ))}
          </Section>

          <Section title="Facts" count={data.facts.length}>
            {data.facts.map((f) => (
              <Item key={f.itemId} source={source(f.sourceRef)}>
                <p>{f.fact}</p>
              </Item>
            ))}
          </Section>
        </div>

        <div ref={viewer} className="scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
          {!file ? null : isPdf ? (
            <Suspense fallback={<LoaderCircle className="mx-auto size-6 animate-spin text-muted-foreground" aria-label="Loading viewer" />}>
              <PdfViewer storagePath={file.storagePath} page={page} onPageChange={setPage} highlight={highlight} />
            </Suspense>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSearch className="size-4" aria-hidden />
                  No preview for Word files
                </CardTitle>
                <CardDescription>
                  Word documents have no fixed pages, so citations name a section of the extracted
                  text. Open the original file to check them.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">
          {title} <span className="font-normal text-muted-foreground">({count})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">None found.</p>
        ) : (
          <ul className="flex flex-col gap-3">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}

function Item({ source, children }: { source: ReactNode; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      {children}
      {source}
    </li>
  );
}

function SourceChip({ source, onShow }: { source: SourceRef; onShow: () => void }) {
  const unit = source.unit === 'section' ? 'Section' : 'Page';
  return (
    <div className="flex flex-col gap-1 border-t pt-2">
      <div className="flex flex-wrap items-center gap-2">
        {source.page !== null ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={onShow}>
            <Quote aria-hidden />
            {unit} {source.page}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No source page given</span>
        )}
        {!source.verified && (
          <Badge variant="destructive">
            <AlertTriangle aria-hidden />
            Quote not found in the document. Check this item yourself.
          </Badge>
        )}
        {source.pageCorrected && <Badge variant="secondary">Page corrected by CasePilot</Badge>}
      </div>
      {source.quote && <blockquote className="border-l-2 pl-2 text-xs text-muted-foreground italic">“{source.quote}”</blockquote>}
    </div>
  );
}
