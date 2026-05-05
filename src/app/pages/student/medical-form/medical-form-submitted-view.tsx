import { memo, type RefObject } from 'react';
import { Download, Eye } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import MedicalRecordPreview from '../../../components/medical-record-preview';
import type { SubmissionPreviewRecord } from './types';

type Props = {
  previewRef: RefObject<HTMLDivElement>;
  previewRecord: SubmissionPreviewRecord;
  onDownload: () => void;
  onBack: () => void;
};

export const MedicalFormSubmittedView = memo(function MedicalFormSubmittedView({
  previewRef,
  previewRecord,
  onDownload,
  onBack,
}: Props) {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="mb-1 text-3xl font-bold text-primary">Medical Record Submitted</h1>
            <p className="text-muted-foreground">Your medical record has been submitted and is pending review by the clinic staff.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onDownload} className="bg-primary text-on-primary hover:bg-primary/90">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={onBack}>
              Back to Dashboard
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <CardTitle>Medical Record Form Preview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-lg border bg-white p-4">
              <MedicalRecordPreview ref={previewRef} record={previewRecord} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
