import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Download, Loader2, Printer, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface InlinePdfViewerProps {
  title: string;
  fileName: string;
  documentKey: string;
  createBlob: () => Promise<Blob>;
  fallbackContent?: ReactNode;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getDocumentStyleMarkup() {
  return Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'))
    .map((node) => {
      if (node instanceof HTMLLinkElement) {
        const href = new URL(node.getAttribute('href') || node.href, document.baseURI).href;
        return `<link rel="stylesheet" href="${href}">`;
      }
      return `<style>${node.textContent || ''}</style>`;
    })
    .join('\n');
}

export default function InlinePdfViewer({ title, fileName, documentKey, createBlob, fallbackContent }: InlinePdfViewerProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    setLoading(true);
    setError('');

    createBlob()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      })
      .catch((generationError) => {
        console.error('Failed to generate inline PDF:', generationError);
        if (!cancelled) {
          setPdfUrl('');
          setError(
            fallbackContent
              ? 'PDF preview could not be generated on this device. Showing the rendered document preview instead.'
              : 'Failed to generate PDF preview. Please refresh and try again.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [createBlob, documentKey, reloadToken]);

  const handlePrint = () => {
    try {
      if (pdfUrl) {
        const frameWindow = frameRef.current?.contentWindow;
        if (!frameWindow) throw new Error('PDF frame is not ready.');
        frameWindow.focus();
        frameWindow.print();
        return;
      }

      const fallbackElement = fallbackRef.current;
      if (!fallbackElement) throw new Error('Rendered preview is not ready.');
      const printWindow = window.open('', '_blank');
      if (!printWindow) throw new Error('The print page was blocked.');
      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
<html>
<head>
  <base href="${escapeHtml(document.baseURI)}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fileName)}</title>
  ${getDocumentStyleMarkup()}
  <style>
    @page { margin: 0; }
    html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .inline-pdf-fallback-print-root { display: flex; justify-content: center; width: 100%; }
  </style>
</head>
<body>
  <div class="inline-pdf-fallback-print-root">${fallbackElement.innerHTML}</div>
</body>
</html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 150);
    } catch (printError) {
      console.error('Failed to print inline PDF:', printError);
      setError('Unable to open the print dialog from this browser. Use the rendered preview below or download the PDF if available.');
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant/50 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-neutral-900 px-3 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{fileName}</p>
          <p className="text-xs text-white/70">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 px-3"
            onClick={handlePrint}
            disabled={(!pdfUrl && !fallbackContent) || loading}
            title="Print PDF"
          >
            <Printer className="h-4 w-4" />
          </Button>
          {pdfUrl && !loading ? (
            <Button asChild variant="secondary" size="sm" className="h-9 px-3" title="Download PDF">
              <a href={pdfUrl} download={fileName}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button type="button" variant="secondary" size="sm" className="h-9 px-3" disabled title="Download PDF">
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div
          className={
            fallbackContent
              ? 'border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'
              : 'border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {error}
        </div>
      ) : null}

      <div className="relative min-h-[70vh] bg-neutral-800">
        {loading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-900 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Preparing PDF preview...</p>
          </div>
        ) : null}
        {pdfUrl ? (
          <iframe
            ref={frameRef}
            title={title}
            src={`${pdfUrl}#toolbar=1&navpanes=1&view=FitH`}
            className="h-[70vh] min-h-[620px] w-full border-0 bg-neutral-800"
          />
        ) : fallbackContent && error ? (
          <div className="h-[70vh] min-h-[620px] overflow-auto bg-neutral-800 p-3">
            <div ref={fallbackRef} className="mx-auto w-max bg-white">
              {fallbackContent}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[70vh] items-center justify-center px-4 text-center text-sm text-white/80">
            PDF preview is not available.
          </div>
        )}
      </div>
    </div>
  );
}
