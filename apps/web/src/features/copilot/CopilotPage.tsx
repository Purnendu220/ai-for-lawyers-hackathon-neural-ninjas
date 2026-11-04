import { collection, orderBy, query, type Timestamp } from 'firebase/firestore';
import {
  AlertTriangle,
  FileSearch,
  LoaderCircle,
  Quote,
  SendHorizontal,
  Sparkles,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { can, formatInstant, paths, type CopilotSource, type MessageDoc } from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { useCase } from '@/features/cases/case-context';
import { useDocuments } from '@/features/documents/useDocuments';
import { useActiveOrg } from '@/features/org/org-context';
import { memberName, useMembers } from '@/features/team/useMembers';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { db } from '@/lib/firebase';
import { useLiveQuery, type WithId } from '@/lib/live';
import { useOnline } from '@/pwa/online';

const PdfViewer = lazy(() => import('@/features/documents/PdfViewer'));

const SUGGESTIONS = [
  'What did the court direct each party to do?',
  'When is the next hearing?',
  'Which deadlines depend on something else happening first?',
  'What did the court say about costs?',
];

type Message = WithId<MessageDoc<Timestamp>>;

export default function CopilotPage() {
  const kase = useCase();
  const { id: orgId, org, member } = useActiveOrg();
  const online = useOnline();
  const documents = useDocuments(kase.id);
  const canAsk = can(member.role, 'copilot.ask', org.policy);
  const messagesQuery = useMemo(
    () => query(collection(db(), paths.messages(orgId, kase.id)), orderBy('createdAt', 'asc')),
    [orgId, kase.id],
  );
  const messages = useLiveQuery<MessageDoc<Timestamp>>(messagesQuery);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CopilotSource | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLDivElement>(null);

  const count = messages.data?.length ?? 0;
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [count, pending]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || pending) return;
    setPending(trimmed);
    setQuestion('');
    try {
      await call(
        'askCaseCopilot',
        { orgId, caseId: kase.id, question: trimmed },
        { timeout: 120_000 },
      );
    } catch (error) {
      toast.error(errorMessage(error));
      setQuestion(trimmed);
    } finally {
      setPending(null);
    }
  }

  function showSource(source: CopilotSource) {
    setViewing(source);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      viewer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const viewedDocument = documents.data?.find((d) => d.id === viewing?.documentId);
  const latest = messages.data?.at(-1);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <p className="rounded-lg border bg-accent px-4 py-3 text-sm">
          Answers come only from this case's analysed documents, with the page they rely on.
          CasePilot does not give legal advice or search case law.
        </p>

        {messages.loading ? (
          <LoaderCircle
            className="mx-auto size-6 animate-spin text-muted-foreground"
            aria-label="Loading questions"
          />
        ) : (
          <ol className="flex flex-col gap-4" aria-live="polite">
            {(messages.data ?? []).map((m) => (
              <MessageItem key={m.id} message={m} onShowSource={showSource} />
            ))}
            {pending && (
              <li className="flex flex-col gap-2">
                <Bubble text={pending} />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Searching the case documents…
                </div>
              </li>
            )}
          </ol>
        )}
        <div ref={end} />

        {canAsk && !pending && (
          <div className="flex flex-wrap gap-2">
            {(count === 0 ? SUGGESTIONS : (latest?.followUpQuestions ?? [])).map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                className="h-auto py-1.5 text-left whitespace-normal"
                disabled={!online}
                onClick={() => void ask(s)}
              >
                <Sparkles aria-hidden />
                {s}
              </Button>
            ))}
          </div>
        )}

        {canAsk ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(question);
            }}
          >
            <Textarea
              aria-label="Ask about this case"
              placeholder="Ask about this case's documents…"
              className="min-h-11"
              value={question}
              maxLength={1000}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void ask(question);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Ask"
              disabled={!online || !!pending || question.trim().length < 3}
            >
              <SendHorizontal />
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your role can read answers but not ask questions.
          </p>
        )}
        {!online && (
          <p className="text-sm text-muted-foreground">Connect to the internet to ask questions.</p>
        )}
      </div>

      <div ref={viewer} className="scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
        {viewing && viewedDocument?.mimeType === 'application/pdf' ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{viewing.fileName}</p>
            <Suspense
              fallback={
                <LoaderCircle
                  className="mx-auto size-6 animate-spin text-muted-foreground"
                  aria-label="Loading viewer"
                />
              }
            >
              <PdfViewer
                storagePath={viewedDocument.storagePath}
                page={viewing.page}
                onPageChange={(page) => setViewing({ ...viewing, page })}
                highlight={viewing.quote}
              />
            </Suspense>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSearch className="size-4" aria-hidden />
                {viewing ? 'No preview for Word files' : 'Sources'}
              </CardTitle>
              <CardDescription>
                {viewing
                  ? `${viewing.fileName}, section ${viewing.page}. Open the original file to read it.`
                  : 'Click a source under an answer to open the document at that page.'}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}

function Bubble({ text, by, at }: { text: string; by?: string; at?: Date }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
      <p className="whitespace-pre-wrap">{text}</p>
      {(by || at) && (
        <p className="mt-1 text-xs opacity-70">
          {by}
          {by && at && ' · '}
          {at && formatInstant(at)}
        </p>
      )}
    </div>
  );
}

function MessageItem({
  message,
  onShowSource,
}: {
  message: Message;
  onShowSource: (s: CopilotSource) => void;
}) {
  const { byId } = useMembers();
  return (
    <li className="flex flex-col gap-2">
      <Bubble
        text={message.question}
        by={memberName(byId.get(message.createdBy))}
        at={message.createdAt?.toDate()}
      />
      <div className="max-w-[95%] rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm">
        <div className="mb-2 flex flex-wrap gap-2">
          {message.insufficientEvidence && (
            <Badge variant="secondary">The documents don't establish this</Badge>
          )}
          {message.unsupported && (
            <Badge variant="destructive">
              <AlertTriangle aria-hidden />
              Not linked to the documents. Treat with caution.
            </Badge>
          )}
          {message.mode === 'fixture' && (
            <Badge variant="warning">Test mode, not a live AI answer</Badge>
          )}
        </div>
        {/* Plain text only: model output is never rendered as HTML or as clickable links. */}
        <p className="whitespace-pre-wrap">{message.answer}</p>
        {message.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-2">
            {message.sources.map((source) => (
              <Button
                key={source.chunkId}
                size="sm"
                variant="ghost"
                className="h-auto px-2 py-1 text-left text-xs whitespace-normal"
                onClick={() => onShowSource(source)}
                title={source.quote ?? undefined}
              >
                <Quote aria-hidden />
                {source.fileName}, {source.unit} {source.page}
                {!source.verified && <span className="text-warning"> · quote not found</span>}
              </Button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
