import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { getBlob, ref } from 'firebase/storage';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { storage } from '@/lib/firebase';

// Bundled by Vite; the service worker caches it on first use instead of precaching it.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
}

/** Document text is untrusted: it is escaped before the text layer renders it as HTML. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

type PdfViewerProps = {
  storagePath: string;
  page: number;
  onPageChange: (page: number) => void;
  /** Text to highlight on the current page: the citation the reviewer clicked. */
  highlight: string | null;
};

/**
 * Shows a case PDF fetched with getBlob, so every read is checked by Storage rules and no
 * download URL is ever created (docs/ARCHITECTURE.md §4.3). The file stays in memory only.
 */
export default function PdfViewer({ storagePath, page, onPageChange, highlight }: PdfViewerProps) {
  const [file, setFile] = useState<{ path: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [width, setWidth] = useState(600);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getBlob(ref(storage, storagePath)).then(
      (blob) => {
        if (!cancelled) setFile({ path: storagePath, blob });
      },
      () => {
        if (!cancelled) setError("Couldn't open this file. Check your connection and try again.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const needle = useMemo(() => (highlight ? normalize(highlight) : ''), [highlight]);
  const renderText = useMemo(
    () =>
      ({ str }: { str: string }) => {
        const piece = normalize(str);
        const marked = needle.length >= 8 && piece.length >= 4 && needle.includes(piece);
        return marked ? `<mark>${escapeHtml(str)}</mark>` : escapeHtml(str);
      },
    [needle],
  );

  const blob = file?.path === storagePath ? file.blob : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <Button size="icon" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
        </Button>
        <span aria-live="polite">
          Page {page}
          {pageCount > 0 && ` of ${pageCount}`}
        </span>
        <Button
          size="icon"
          variant="outline"
          aria-label="Next page"
          disabled={pageCount > 0 && page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <div ref={container} className="min-h-96 overflow-hidden rounded-lg border bg-white [&_mark]:bg-yellow-300/60 [&_mark]:text-transparent">
        {error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : !blob ? (
          <div className="flex justify-center p-12">
            <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Loading document" />
          </div>
        ) : (
          <Document
            file={blob}
            onLoadSuccess={({ numPages }) => setPageCount(numPages)}
            onLoadError={() => setError("This PDF couldn't be displayed.")}
            loading={null}
          >
            <Page pageNumber={page} width={width} customTextRenderer={renderText} renderAnnotationLayer={false} />
          </Document>
        )}
      </div>
    </div>
  );
}
