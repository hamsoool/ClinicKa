import { memo, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Download, FileText } from 'lucide-react';
import { normalizeStorageFileUrl } from '../lib/api';

type Props = {
  title: string;
  fileUrl?: string;
  alt?: string;
  fileName?: string;
  mimeType?: string;
};

function getFilePreviewType(fileUrl?: string, fileName?: string, mimeType?: string): 'pdf' | 'image' | 'other' {
  if (!fileUrl) return 'other';

  const normMime = String(mimeType || '').toLowerCase();
  if (normMime.includes('pdf')) return 'pdf';
  if (normMime.includes('image')) return 'image';

  const normName = String(fileName || '').toLowerCase();
  if (normName.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(normName)) return 'image';

  const normalizedUrl = fileUrl.split('?')[0].toLowerCase();
  if (normalizedUrl.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(normalizedUrl)) return 'image';

  try {
    const urlObj = new URL(fileUrl, 'http://dummy.local');
    const qMime = (urlObj.searchParams.get('mime') || '').toLowerCase();
    if (qMime.includes('pdf')) return 'pdf';
    if (qMime.includes('image')) return 'image';

    const qName = (urlObj.searchParams.get('name') || urlObj.searchParams.get('filename') || '').toLowerCase();
    if (qName.endsWith('.pdf')) return 'pdf';
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(qName)) return 'image';
  } catch {
    // Ignore URL parse error
  }

  return 'other';
}

function getDownloadFileName(title: string, extension: string) {
  const safeBase = String(title || 'file')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'file';
  return `${safeBase}.${extension}`;
}

function buildPdfPreviewUrl(fileUrl: string, view: 'Fit' | 'FitH' | 'FitV' = 'Fit') {
  const hashParams = new URLSearchParams({
    page: '1',
    toolbar: '0',
    navpanes: '0',
    scrollbar: '0',
    view,
  });
  return `${fileUrl}#${hashParams.toString()}`;
}

export const SubmittedFilePreview = memo(function SubmittedFilePreview({
  title,
  fileUrl: rawFileUrl,
  alt,
  fileName,
  mimeType,
}: Props) {
  const fileUrl = useMemo(() => normalizeStorageFileUrl(rawFileUrl), [rawFileUrl]);

  if (!fileUrl) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-outline-variant/50 bg-muted/30 p-5 text-muted-foreground">
        <FileText className="h-6 w-6 shrink-0 opacity-60" />
        <div className="min-w-0">
          <p className="text-sm font-medium">No {title} file uploaded yet</p>
          <p className="text-xs text-muted-foreground/80">A file will appear here once submitted.</p>
        </div>
      </div>
    );
  }

  const initialType = getFilePreviewType(fileUrl, fileName, mimeType);
  const [previewType, setPreviewType] = useState<'pdf' | 'image' | 'other'>(initialType);

  useEffect(() => {
    const directType = getFilePreviewType(fileUrl, fileName, mimeType);
    if (directType !== 'other') {
      setPreviewType(directType);
      return;
    }

    let active = true;
    fetch(fileUrl, { method: 'HEAD' })
      .then((res) => {
        if (!active) return;
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('pdf')) {
          setPreviewType('pdf');
        } else if (contentType.includes('image')) {
          setPreviewType('image');
        } else {
          // Probe via Image load fallback
          const img = new Image();
          img.onload = () => {
            if (active) setPreviewType('image');
          };
          img.onerror = () => {
            if (active) setPreviewType('other');
          };
          img.src = fileUrl;
        }
      })
      .catch(() => {
        if (!active) return;
        const img = new Image();
        img.onload = () => {
          if (active) setPreviewType('image');
        };
        img.onerror = () => {
          if (active) setPreviewType('other');
        };
        img.src = fileUrl;
      });

    return () => {
      active = false;
    };
  }, [fileUrl, fileName, mimeType]);

  const previewTitle = `${title} preview`;
  const previewAlt = alt || title;
  const pdfPreviewUrl = previewType === 'pdf' ? buildPdfPreviewUrl(fileUrl) : fileUrl;

  const handleDownloadOriginal = () => {
    const basePath = fileUrl.split('?')[0];
    let ext = (basePath.split('.').pop() || '').toLowerCase();

    // If no clean extension was in the URL path (e.g. UUID), use fileName or previewType
    if (!ext || ext.length > 5 || ext.includes('/')) {
      if (fileName && fileName.includes('.')) {
        ext = (fileName.split('.').pop() || '').toLowerCase();
      } else if (previewType === 'pdf') {
        ext = 'pdf';
      } else if (previewType === 'image') {
        ext = 'png';
      } else {
        ext = 'file';
      }
    }

    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = getDownloadFileName(title, ext);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const previewContent = (() => {
    switch (previewType) {
      case 'pdf':
        return (
          <div className="bg-muted/20 p-4">
            <object
              data={pdfPreviewUrl}
              type="application/pdf"
              aria-label={previewTitle}
              className="mx-auto h-[65vh] min-h-[600px] w-full rounded-md border bg-white shadow-sm"
            >
              <iframe src={pdfPreviewUrl} title={previewTitle} className="h-[65vh] min-h-[600px] w-full rounded-md bg-white" />
            </object>
          </div>
        );
      case 'image':
        return (
          <DialogTrigger asChild>
            <button
              type="button"
              className="group relative block w-full cursor-zoom-in bg-black/5 p-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={`Open ${title} full image`}
            >
              <img
                src={fileUrl}
                alt={previewAlt}
                className="mx-auto max-h-[420px] w-auto max-w-full rounded-md object-contain shadow-sm transition-transform duration-200 group-hover:scale-[1.01]"
              />
              <span className="mt-2 inline-block text-xs text-muted-foreground group-hover:text-foreground">
                Click to expand / view full screen
              </span>
            </button>
          </DialogTrigger>
        );
      default:
        return (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 bg-muted/30 p-6 text-center">
            <FileText className="h-10 w-10 text-primary" />
            <div>
              <p className="font-semibold text-foreground">{title} document attached</p>
              <p className="text-xs text-muted-foreground mt-0.5">Use the download button above to inspect this file.</p>
            </div>
          </div>
        );
    }
  })();

  return (
    <Dialog>
      <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/50 bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <p className="min-w-0 truncate text-sm font-bold text-foreground">{title}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={handleDownloadOriginal}
            >
              <Download className="h-3.5 w-3.5" />
              Download Original
            </Button>
          </div>
        </div>
        {previewContent}
      </div>
      {previewType === 'image' ? (
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center justify-between pr-8">
              <span>{title}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold"
                onClick={handleDownloadOriginal}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(94vh-80px)] overflow-auto bg-black/5 p-4 flex items-center justify-center">
            <img src={fileUrl} alt={previewAlt} className="mx-auto max-h-[82vh] w-auto max-w-full rounded object-contain shadow-lg" />
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
});
export default SubmittedFilePreview;
