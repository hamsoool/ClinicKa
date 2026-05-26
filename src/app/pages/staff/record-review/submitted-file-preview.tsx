import { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';

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

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildSingleImagePdf(jpegBytes: Uint8Array, width: number, height: number) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 24;
  const usableW = pageWidth - margin * 2;
  const usableH = pageHeight - margin * 2;
  const ratio = Math.min(usableW / width, usableH / height, 1);
  const drawW = Math.max(1, Math.floor(width * ratio));
  const drawH = Math.max(1, Math.floor(height * ratio));
  const x = Math.floor((pageWidth - drawW) / 2);
  const y = Math.floor((pageHeight - drawH) / 2);

  const content = `q\n${drawW} 0 0 ${drawH} ${x} ${y} cm\n/Im0 Do\nQ`;
  const objects: Uint8Array[] = [];
  const textEncoder = new TextEncoder();

  const pushObj = (s: string) => objects.push(textEncoder.encode(s));

  pushObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  pushObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  pushObj(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
  );
  pushObj(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  objects.push(jpegBytes);
  pushObj('\nendstream\nendobj\n');
  pushObj(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  let size = 0;
  const chunks: Uint8Array[] = [];
  const pushChunk = (c: Uint8Array) => {
    chunks.push(c);
    size += c.length;
  };

  pushChunk(textEncoder.encode('%PDF-1.4\n'));
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(size);
    pushChunk(obj);
  }
  const xrefStart = size;
  const xrefHeader = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`];
  for (let i = 1; i < offsets.length; i += 1) {
    xrefHeader.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  xrefHeader.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
  pushChunk(textEncoder.encode(xrefHeader.join('')));

  return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
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

  const handleDownloadImageAsPdf = async () => {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Failed to load image (${response.status})`);
      const blob = await response.blob();

      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Invalid image'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 1200;
      canvas.height = img.naturalHeight || img.height || 800;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64 = jpegDataUrl.split(',')[1];
      const jpegBytes = base64ToUint8Array(base64);
      const pdfBlob = buildSingleImagePdf(jpegBytes, canvas.width, canvas.height);

      const link = document.createElement('a');
      link.href = URL.createObjectURL(pdfBlob);
      link.download = getDownloadFileName(title, 'pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      URL.revokeObjectURL(objectUrl);
      toast.success('Image PDF downloaded');
    } catch (error) {
      console.error('Failed to download image as PDF:', error);
      toast.error('Failed to create PDF from image');
    }
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
              className="mx-auto h-[70vh] min-h-[720px] w-full max-w-[900px] rounded-md border bg-white"
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
              <img src={fileUrl} alt={previewAlt} className="max-h-[420px] w-full object-contain" />
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
              Download {previewType === 'pdf' ? 'PDF' : 'Original'}
            </Button>
            {previewType === 'image' ? (
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleDownloadImageAsPdf}>
                <Download className="mr-2 h-4 w-4" />
                Download as PDF
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm" className="w-full sm:w-auto">
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </a>
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
