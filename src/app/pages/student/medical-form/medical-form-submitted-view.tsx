import { memo, type RefObject } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../../components/ui/button';
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
    <div className="p-4 md:p-8">
      <div className="mx-auto w-full max-w-[100rem]">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="mb-1 text-3xl font-bold text-primary">Medical Record Submitted</h1>
            <p className="text-muted-foreground">Your medical record has been submitted and is pending review by the clinic staff.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onDownload} className="bg-primary text-white hover:bg-primary/90">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={onBack}>
              Back to Dashboard
            </Button>
          </div>
        </div>
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-10000px',
            top: '0',
            width: '816px',
            background: '#fff',
            pointerEvents: 'none',
            opacity: 0,
          }}
        >
          <MedicalRecordPreview ref={previewRef} record={previewRecord} />
        </div>
      </div>
    </div>
  );
});
