import type { Timestamp } from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCheck,
  ChevronLeft,
  FileSearch,
  LoaderCircle,
  Quote,
} from 'lucide-react';
import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  can,
  describeWarning,
  formatDateOnly,
  formatInstant,
  isDateOnly,
  paths,
  type AnalysisDoc,
  type DocumentDoc,
  type ReviewDecision,
  type SourceRef,
} from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import { useCase } from '@/features/cases/case-context';
import { useActiveOrg } from '@/features/org/org-context';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { useLiveDoc } from '@/lib/live';
import { useOnline } from '@/pwa/online';
import { ItemReview } from './ItemReview';
import { SummaryText } from './SummaryText';
import { BASIS_LABELS, DATE_TYPE_LABELS, PRIORITY_LABELS } from './labels';
import { itemWarnings, type ReviewItem } from './review-logic';

const PdfViewer = lazy(() => import('@/features/documents/PdfViewer'));

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

function dateLabel(value: string | null | undefined): string | null {
  return value && isDateOnly(value) ? formatDateOnly(value) : null;
}

export default function ReviewPage() {
  const kase = useCase();
  const { analysisId = '' } = useParams();
  const { id: orgId, org, member } = useActiveOrg();
  const online = useOnline();
  const analysis = useLiveDoc<AnalysisDoc<Timestamp>>(
    VALID_ID.test(analysisId) ? paths.analysis(orgId, kase.id, analysisId) : null,
  );
  const documentId = analysis.data?.documentId;
  const document = useLiveDoc<DocumentDoc<Timestamp>>(
    documentId ? paths.document(orgId, kase.id, documentId) : null,
  );
  const [page, setPage] = useState(1);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const viewer = useRef<HTMLDivElement>(null);

  if (analysis.loading || document.loading) {
    return (
      <LoaderCircle
        className="mx-auto size-6 animate-spin text-muted-foreground"
        aria-label="Loading analysis"
      />
    );
  }
  const data = analysis.data;
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analysis not found</CardTitle>
          <CardDescription>
            It may have been replaced by a newer analysis of the same document.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const file = document.data;
  const isPdf = file?.mimeType === 'application/pdf';
  const canReview =
    can(member.role, 'ai.review', org.policy) &&
    data.status !== 'superseded' &&
    kase.status !== 'archived';

  const entries: ReviewItem[] = [
    ...data.directions.map((item) => ({ kind: 'direction' as const, item })),
    ...data.dates.map((item) => ({ kind: 'date' as const, item })),
    ...data.proposedTasks.map((item) => ({ kind: 'task' as const, item })),
    ...data.facts.map((item) => ({ kind: 'fact' as const, item })),
  ];
  const pending = entries.filter((e) => e.item.decision === 'pending');
  const bulkable = pending.filter((e) => itemWarnings(e).length === 0);

  async function decide(decisions: ReviewDecision[]) {
    try {
      const result = await call(
        'reviewAnalysis',
        { orgId, caseId: kase.id, analysisId, decisions },
        { timeout: 120_000 },
      );
      if (result.applied === 0) toast.info('These items were already reviewed.');
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  async function approveBulk() {
    setBulkBusy(true);
    try {
      await decide(bulkable.map((e) => ({ itemId: e.item.itemId, action: 'approve' as const })));
      toast.success(`${bulkable.length} items approved.`);
      setBulkOpen(false);
    } catch {
      // decide() already showed the error.
    } finally {
      setBulkBusy(false);
    }
  }

  function showSource(source: SourceRef) {
    if (source.page === null) return;
    setPage(source.page);
    setHighlight(source.quote);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      viewer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const card = (entry: ReviewItem, content: ReactNode) => (
    <li key={entry.item.itemId} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      {content}
      <SourceChip source={entry.item.sourceRef} onShow={() => showSource(entry.item.sourceRef)} />
      <ItemReview entry={entry} canReview={canReview} onDecide={(decision) => decide([decision])} />
    </li>
  );
  const of = <K extends ReviewItem['kind']>(kind: K) =>
    entries.filter((e): e is Extract<ReviewItem, { kind: K }> => e.kind === kind);

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
          {data.mode === 'fixture' && (
            <Badge variant="warning">Replayed analysis, not a live AI result</Badge>
          )}
          {data.status === 'superseded' && (
            <Badge variant="outline">Replaced by a newer analysis</Badge>
          )}
          {data.status === 'reviewed' && <Badge variant="success">Review complete</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {file?.fileName ?? 'Document'} · {data.pagesAnalysed} of {data.pageCount}{' '}
          {file?.sourceUnit === 'section' ? 'sections' : 'pages'} analysed
          {data.createdAt && ` · ${formatInstant(data.createdAt.toDate())}`} ·{' '}
          {entries.length - pending.length} of {entries.length} items reviewed
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-accent px-4 py-3 text-sm">
        <span>
          These are AI suggestions. Only what a lawyer approves is added to the case. Check each
          item against its source.
        </span>
        {canReview && bulkable.length > 0 && (
          <Button size="sm" disabled={!online} onClick={() => setBulkOpen(true)}>
            <CheckCheck aria-hidden />
            Approve {bulkable.length} without warnings
          </Button>
        )}
      </div>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {bulkable.length} items?</DialogTitle>
            <DialogDescription>
              These items have a verified quote and no conditions or dates to work out. Approved
              tasks and dates are added to the case. Items with warnings stay for you to review one
              by one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button disabled={bulkBusy} onClick={() => void approveBulk()}>
              Approve {bulkable.length} items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <SummaryText analysis={data} />
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
            {of('direction').map((entry) => {
              const d = entry.item;
              return card(
                entry,
                <>
                  <p>{d.edits?.text ?? d.direction}</p>
                  <div className="flex flex-wrap gap-2">
                    {d.responsibleParty && <Badge variant="outline">{d.responsibleParty}</Badge>}
                    {d.directionType === 'conditional' && (
                      <Badge variant="warning">
                        Conditional{d.condition ? `: ${d.condition}` : ''}
                      </Badge>
                    )}
                  </div>
                </>,
              );
            })}
          </Section>

          <Section title="Dates" count={data.dates.length}>
            {of('date').map((entry) => {
              const d = entry.item;
              const confirmed = d.edits?.date !== undefined ? d.edits.date : d.normalizedDate;
              return card(
                entry,
                <>
                  <p className="font-medium">{dateLabel(confirmed) ?? d.dateText}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{DATE_TYPE_LABELS[d.dateType]}</Badge>
                    {d.basis !== 'explicit' && (
                      <Badge variant="warning">
                        {BASIS_LABELS[d.basis]}: “{d.dateText}”. A lawyer must set the date.
                      </Badge>
                    )}
                  </div>
                </>,
              );
            })}
          </Section>

          <Section title="Proposed tasks" count={data.proposedTasks.length}>
            {of('task').map((entry) => {
              const t = entry.item;
              const due = t.edits?.date !== undefined ? t.edits.date : t.suggestedDueDate;
              return card(
                entry,
                <>
                  <p className="font-medium">{t.edits?.title ?? t.title}</p>
                  <p className="text-muted-foreground">{t.edits?.description ?? t.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {PRIORITY_LABELS[t.edits?.priority ?? t.priority]} priority
                    </Badge>
                    {dateLabel(due) ? (
                      <Badge variant="outline">Due {dateLabel(due)}</Badge>
                    ) : (
                      <Badge variant="secondary">
                        Due date: {BASIS_LABELS[t.dueDateBasis].toLowerCase()}
                      </Badge>
                    )}
                    {t.condition && <Badge variant="warning">Only if: {t.condition}</Badge>}
                  </div>
                </>,
              );
            })}
          </Section>

          <Section title="Facts" count={data.facts.length}>
            {of('fact').map((entry) =>
              card(entry, <p>{entry.item.edits?.text ?? entry.item.fact}</p>),
            )}
          </Section>
        </div>

        <div ref={viewer} className="scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
          {!file ? null : isPdf ? (
            <Suspense
              fallback={
                <LoaderCircle
                  className="mx-auto size-6 animate-spin text-muted-foreground"
                  aria-label="Loading viewer"
                />
              }
            >
              <PdfViewer
                storagePath={file.storagePath}
                page={page}
                onPageChange={setPage}
                highlight={highlight}
              />
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

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
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
      {source.quote && (
        <blockquote className="border-l-2 pl-2 text-xs text-muted-foreground italic">
          “{source.quote}”
        </blockquote>
      )}
    </div>
  );
}
