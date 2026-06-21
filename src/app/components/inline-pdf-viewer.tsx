import '../lib/pdf-polyfills';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Document as PdfDocument, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure the PDF.js worker locally to prevent version mismatch errors
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
import { Download, Loader2, Printer, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from './ui/button';
import { createPdfFromElement } from '../lib/dom-pdf-export';
import type { DomPdfPageFormat } from '../lib/dom-pdf-export';

interface InlinePdfViewerProps {
  title: string;
  fileName: string;
  documentKey: string;
  pageFormat: DomPdfPageFormat;
  sourceContent: ReactNode;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPrintPageSize(pageFormat: DomPdfPageFormat) {
  return pageFormat === 'legal' ? 'legal' : 'A4';
}

export default function InlinePdfViewer({
  title,
  fileName,
  documentKey,
  pageFormat,
  sourceContent,
}: InlinePdfViewerProps) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(() => new Set());
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const element = viewerRef.current;
    if (!element) return;

    if (typeof ResizeObserver === 'undefined') {
      setContainerWidth(element.clientWidth);
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');
    setPdfBlob(null);
    setNumPages(0);
    setRenderedPages(new Set());

    const generate = async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const blob = await createPdfFromElement(sourceRef.current, { pageFormat, scale: 1.5 });
      if (cancelled) return;
      setPdfBlob(blob);
    };

    generate()
      .catch((generationError) => {
        console.error('Failed to generate inline PDF:', generationError);
        if (!cancelled) {
          setError('Failed to generate PDF preview. Refresh and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentKey, pageFormat, reloadToken]);

  const pageWidth = useMemo(() => {
    const availableWidth = Math.max(280, containerWidth - 32);
    return Math.round(Math.min(availableWidth, 900) * zoom);
  }, [containerWidth, zoom]);

  const isFullyRendered = numPages > 0 && renderedPages.size >= numPages;

  const handlePrint = useCallback(async () => {
    try {
      setActionLoading(true);
      setActionMessage('Generating print files...');
      
      const highResBlob = await createPdfFromElement(sourceRef.current, { pageFormat, scale: 4 });
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const url = URL.createObjectURL(highResBlob);

      if (isMobile) {
        const printWindow = window.open(url, '_blank');
        if (!printWindow) throw new Error('Could not open print window.');
      } else {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.pointerEvents = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);

        iframe.onload = () => {
          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } catch (err) {
              console.error('Error triggering iframe print:', err);
            }
          }, 300);
        };

        if (iframe.contentWindow) {
          iframe.contentWindow.addEventListener('afterprint', () => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
          });
        } else {
          setTimeout(() => {
            if (iframe.parentNode) {
              document.body.removeChild(iframe);
            }
            URL.revokeObjectURL(url);
          }, 10000);
        }
      }
    } catch (printError) {
      console.error('Failed to print PDF:', printError);
      setError('Failed to trigger printer dialog. Please download the PDF and print it directly.');
    } finally {
      setActionLoading(false);
      setActionMessage('');
    }
  }, [pageFormat]);

  const handleDownload = useCallback(async () => {
    try {
      setActionLoading(true);
      setActionMessage('Generating PDF...');
      
      const highResBlob = await createPdfFromElement(sourceRef.current, { pageFormat, scale: 4 });
      const url = URL.createObjectURL(highResBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 150);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      setError('Failed to generate PDF download. Please try again.');
    } finally {
      setActionLoading(false);
      setActionMessage('');
    }
  }, [fileName, pageFormat]);

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant/50 bg-white shadow-sm">
      <div
        aria-hidden="true"
        ref={sourceRef}
        style={{
          position: 'absolute',
          left: '-100000px',
          top: 0,
          zIndex: -1,
          width: 'max-content',
          height: 'auto',
          overflow: 'visible',
          background: '#fff',
          pointerEvents: 'none',
        }}
      >
        {sourceContent}
      </div>

      <div className="flex flex-col gap-3 border-b border-white/10 bg-primary px-3 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{fileName}</p>
          <p className="text-xs text-white/70">{title}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 gap-1.5 px-3"
            onClick={handleDownload}
            disabled={!pdfBlob || loading || actionLoading}
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs sm:hidden">Download</span>
          </Button>
          {/* Print button — hidden on mobile since it doesn't work on most Android browsers */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="hidden h-9 px-3 sm:inline-flex"
            onClick={handlePrint}
            disabled={!pdfBlob || loading || actionLoading}
            title="Print PDF"
          >
            <Printer className="h-4 w-4" />
          </Button>
          {/* Refresh button */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 px-3"
            onClick={() => setReloadToken((value) => value + 1)}
            disabled={loading}
            title="Refresh PDF"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {/* Zoom controls — hidden on very small screens to prevent overflow */}
          <div className="hidden items-center gap-2 sm:flex">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 px-3"
              onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.1).toFixed(2))))}
              disabled={loading}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="min-w-12 text-center text-xs font-semibold">{Math.round(zoom * 100)}%</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 px-3"
              onClick={() => setZoom((value) => Math.min(1.6, Number((value + 0.1).toFixed(2))))}
              disabled={loading}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div ref={viewerRef} className="relative min-h-[70vh] bg-neutral-800">
        {loading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-900/90 text-white">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Preparing PDF preview...</p>
          </div>
        ) : null}

        {actionLoading ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-neutral-950/70 text-white backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-neutral-900/90 p-5 shadow-2xl border border-white/5 animate-in fade-in zoom-in-95 duration-200">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium">{actionMessage}</p>
            </div>
          </div>
        ) : null}

        {pdfBlob ? (
          <div ref={pagesRef} className="h-[70vh] min-h-[620px] overflow-auto bg-neutral-800 px-3 py-4">
            <PdfDocument
              file={pdfBlob}
              loading={<p className="py-10 text-center text-sm text-white/80">Loading PDF pages...</p>}
              error={<p className="py-10 text-center text-sm text-red-200">PDF preview could not be opened.</p>}
              onLoadSuccess={({ numPages: nextNumPages }) => {
                setNumPages(nextNumPages);
                setRenderedPages(new Set());
              }}
              onLoadError={(loadError) => {
                console.error('Failed to load generated PDF:', loadError);
                setError('Generated PDF could not be loaded. Refresh and try again.');
              }}
            >
              {Array.from({ length: numPages }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <div key={pageNumber} className="mb-4 flex justify-center last:mb-0">
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      loading={<div className="h-96 w-full max-w-[720px] animate-pulse rounded bg-neutral-700" />}
                      onRenderSuccess={() => {
                        setRenderedPages((current) => {
                          const next = new Set(current);
                          next.add(pageNumber);
                          return next;
                        });
                      }}
                    />
                  </div>
                );
              })}
            </PdfDocument>
          </div>
        ) : !loading ? (
          <div className="flex min-h-[70vh] items-center justify-center px-4 text-center text-sm text-white/80">
            PDF preview is not available.
          </div>
        ) : null}
      </div>
    </div>
  );
}
