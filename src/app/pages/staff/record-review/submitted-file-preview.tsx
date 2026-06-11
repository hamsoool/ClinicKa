import { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Download, FileText } from 'lucide-react';

type Props = {
  title: string;
  fileUrl?: string;
  alt?: string;
};

function getFilePreviewType(fileUrl: string) {
  const normalizedUrl = fileUrl.split('?')[0].toLowerCase();

  if (normalizedUrl.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(normalizedUrl)) return 'image';

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

export const SubmittedFilePreview = memo(function SubmittedFilePreview({ title, fileUrl, alt }: Props) {
  if (!fileUrl) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/50 p-4 text-muted-foreground">
        <FileText className="h-6 w-6" />
        <span className="text-sm">No {title} file uploaded yet</span>
      </div>
    );
  }

  const previewType = getFilePreviewType(fileUrl);
  const previewTitle = `${title} preview`;
  const previewAlt = alt || title;
  const pdfPreviewUrl = previewType === 'pdf' ? buildPdfPreviewUrl(fileUrl) : fileUrl;

  const handleDownloadOriginal = () => {
    const basePath = fileUrl.split('?')[0];
    const ext = (basePath.split('.').pop() || 'file').toLowerCase();
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
              className="mx-auto h-[70vh] min-h-[720px] w-full max-w-[900px] rounded-md border bg-white shadow-[3px_5px_30px_rgba(0,0,0,0.16)]"
            >
              <iframe src={pdfPreviewUrl} title={previewTitle} className="h-[70vh] min-h-[720px] w-full rounded-md bg-white" />
            </object>
          </div>
        );
      case 'image':
        return (
          <DialogTrigger asChild>
            <button
              type="button"
              className="block w-full cursor-zoom-in bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={`Open ${title} full image`}
            >
              <img src={fileUrl} alt={previewAlt} className="max-h-[420px] w-full object-contain drop-shadow-[3px_5px_30px_rgba(0,0,0,0.16)]" />
            </button>
          </DialogTrigger>
        );
      default:
        return (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 bg-muted/40 p-6 text-center">
            <FileText className="h-10 w-10 text-primary" />
            <div>
              <p className="font-medium">{title} file uploaded</p>
            </div>
          </div>
        );
    }
  })();

  return (
    <Dialog>
      <div className="mb-4 overflow-hidden rounded-lg border">
        <div className="flex flex-col gap-3 border-b bg-muted/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p className="min-w-0 truncate text-sm font-semibold">{title} file</p>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleDownloadOriginal}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
        {previewContent}
      </div>
      {previewType === 'image' ? (
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{title} File</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(92vh-80px)] overflow-auto bg-muted/20 p-4">
            <img src={fileUrl} alt={previewAlt} className="mx-auto max-h-[80vh] w-auto max-w-full object-contain" />
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
});
