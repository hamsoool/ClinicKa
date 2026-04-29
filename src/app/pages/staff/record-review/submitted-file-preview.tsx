import { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { ExternalLink, Expand, FileText } from 'lucide-react';

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

export const SubmittedFilePreview = memo(function SubmittedFilePreview({ title, fileUrl, alt }: Props) {
  if (!fileUrl) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/50 p-4 text-muted-foreground">
        <FileText className="h-6 w-6" />
        <span className="text-sm">No {title} file uploaded by student</span>
      </div>
    );
  }

  const previewType = getFilePreviewType(fileUrl);
  const previewTitle = `${title} preview`;
  const previewAlt = alt || title;

  const previewContent = (() => {
    switch (previewType) {
      case 'pdf':
        return <iframe src={fileUrl} title={previewTitle} className="h-[420px] w-full bg-white" />;
      case 'image':
        return <img src={fileUrl} alt={previewAlt} className="max-h-[420px] w-full bg-black/5 object-contain" />;
      default:
        return (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 bg-muted/40 p-6 text-center">
            <FileText className="h-10 w-10 text-primary" />
            <div>
              <p className="font-medium">{title} file uploaded</p>
              <p className="text-sm text-muted-foreground">Preview is not available for this file type.</p>
            </div>
          </div>
        );
    }
  })();

  return (
    <div className="mb-4 overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title} submitted file</p>
          <p className="text-xs text-muted-foreground">
            {previewType === 'pdf' ? 'PDF preview' : previewType === 'image' ? 'Image preview' : 'File attachment'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Expand className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
              <DialogHeader className="border-b px-6 py-4">
                <DialogTitle>{title} Submitted File</DialogTitle>
              </DialogHeader>
              <div className="max-h-[calc(90vh-80px)] overflow-auto bg-muted/20 p-4">
                {previewType === 'pdf' ? (
                  <iframe src={fileUrl} title={`${previewTitle} enlarged`} className="h-[75vh] w-full rounded-md bg-white" />
                ) : previewType === 'image' ? (
                  <img src={fileUrl} alt={previewAlt} className="mx-auto max-h-[75vh] w-auto max-w-full object-contain" />
                ) : (
                  <div className="flex min-h-[280px] items-center justify-center">
                    <p className="text-sm text-muted-foreground">This file type can be opened in a new tab.</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button asChild variant="ghost" size="sm">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open
            </a>
          </Button>
        </div>
      </div>
      {previewContent}
    </div>
  );
});
