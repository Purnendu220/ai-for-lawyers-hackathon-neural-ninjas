import { useMutation } from '@tanstack/react-query';
import { FileText, LoaderCircle, RotateCw, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { can, describeWarning, formatInstant } from '@casepilot/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCase } from '@/features/cases/case-context';
import { useActiveOrg } from '@/features/org/org-context';
import { memberName, useMembers } from '@/features/team/useMembers';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useOnline } from '@/pwa/online';
import { ProcessingStatus } from './ProcessingStatus';
import { ACCEPTED_FILES, formatBytes, uploadDocument, uploadProblem } from './upload';
import { useDocuments, type CaseDocument } from './useDocuments';

type InFlight = { key: string; name: string; progress: number };

export default function DocumentsPage() {
  const kase = useCase();
  const { id: orgId, org, member } = useActiveOrg();
  const online = useOnline();
  const documents = useDocuments(kase.id);
  const canUpload = can(member.role, 'doc.upload', org.policy) && kase.status !== 'archived';
  const [uploads, setUploads] = useState<InFlight[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function start(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const problem = uploadProblem(file);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        continue;
      }
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      setUploads((current) => [...current, { key, name: file.name, progress: 0 }]);
      const setProgress = (progress: number) =>
        setUploads((current) => current.map((u) => (u.key === key ? { ...u, progress } : u)));
      try {
        await uploadDocument(orgId, kase.id, file, setProgress);
      } catch (error) {
        toast.error(`${file.name}: ${errorMessage(error)}`);
      } finally {
        setUploads((current) => current.filter((u) => u.key !== key));
      }
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (canUpload && online) void start(event.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-6">
      {canUpload && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed bg-card p-8 text-center transition-colors',
            dragging && 'border-primary bg-accent',
          )}
        >
          <Upload className="size-8 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">Upload a court order</p>
            <p className="text-sm text-muted-foreground">PDF or Word (.docx), up to 15 MB. Drag files here or choose them.</p>
          </div>
          <Button type="button" disabled={!online} onClick={() => input.current?.click()}>
            Choose files
          </Button>
          <input
            ref={input}
            type="file"
            accept={ACCEPTED_FILES}
            multiple
            className="sr-only"
            aria-label="Choose files to upload"
            onChange={(event) => {
              if (event.target.files) void start(event.target.files);
              event.target.value = '';
            }}
          />
          {!online && <p className="text-sm text-muted-foreground">Connect to the internet to upload.</p>}
        </div>
      )}

      {uploads.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Uploads in progress">
          {uploads.map((u) => (
            <li key={u.key} className="rounded-lg border bg-card p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">{u.name}</span>
                <span className="text-muted-foreground">{Math.round(u.progress * 100)}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${u.progress * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Each upload is checked, read and analysed. AI findings wait for a lawyer's review before
            anything is added to the case.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.loading ? (
            <LoaderCircle className="mx-auto size-6 animate-spin text-muted-foreground" aria-label="Loading documents" />
          ) : documents.data?.length ? (
            <ul className="divide-y">
              {documents.data.map((document) => (
                <DocumentRow key={document.id} document={document} />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No documents yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentRow({ document }: { document: CaseDocument }) {
  const kase = useCase();
  const { id: orgId, org, member } = useActiveOrg();
  const { byId } = useMembers();
  const online = useOnline();
  const canRerun = can(member.role, 'ai.rerun', org.policy) && kase.status !== 'archived';
  const rerun = useMutation({
    mutationFn: () => call('analyzeDocument', { orgId, caseId: kase.id, documentId: document.id }),
    onSuccess: () => toast.success('Analysis started.'),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const status = document.processingStatus;

  return (
    <li className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="truncate font-medium">{document.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(document.sizeBytes)}
            {document.pageCount !== null &&
              ` · ${document.pageCount} ${document.sourceUnit === 'section' ? 'sections' : document.pageCount === 1 ? 'page' : 'pages'}`}
            {' · '}
            {memberName(byId.get(document.uploadedBy))}
            {document.uploadedAt && ` · ${formatInstant(document.uploadedAt.toDate())}`}
          </p>
          {document.errorMessage && (status === 'failed' || status === 'rejected') && (
            <p className="mt-1 text-sm text-destructive">{document.errorMessage}</p>
          )}
          {document.duplicateOfDocumentId && (
            <p className="mt-1 text-sm text-muted-foreground">This is the same file as an earlier upload.</p>
          )}
          {document.warnings.map((warning) => (
            <p key={warning} className="mt-1 text-sm text-warning">
              {describeWarning(warning)}
            </p>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <ProcessingStatus status={status} />
        {status === 'ready' && document.latestAnalysisId && (
          <Button asChild size="sm">
            <Link to={`../ai-review/${document.latestAnalysisId}`} relative="path">
              Review
            </Link>
          </Button>
        )}
        {canRerun && (status === 'failed' || status === 'ready') && (
          <Button size="sm" variant="outline" disabled={rerun.isPending || !online} onClick={() => rerun.mutate()}>
            <RotateCw aria-hidden />
            {status === 'failed' ? 'Retry' : 'Analyse again'}
          </Button>
        )}
      </div>
    </li>
  );
}
