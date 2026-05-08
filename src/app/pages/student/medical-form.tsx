import { useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Upload } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { useAuth } from '../../lib/auth';
import { MedicalFormStepContent } from './medical-form/medical-form-step-content';
import { MedicalFormSubmittedView } from './medical-form/medical-form-submitted-view';
import { useStudentMedicalForm } from './medical-form/use-student-medical-form';

export default function StudentMedicalForm() {
  const navigate = useNavigate();
  const { year } = useParams();
  const [searchParams] = useSearchParams();
  const { me } = useAuth();
  const previewRef = useRef<HTMLDivElement>(null);
  const privacyAccepted = searchParams.get('privacy') === 'accepted';
  const editSubmissionId = searchParams.get('edit');

  useEffect(() => {
    if (!year || privacyAccepted) return;
    const editQuery = editSubmissionId ? `?edit=${encodeURIComponent(editSubmissionId)}` : '';
    navigate(`/student/privacy-waiver/${year}${editQuery}`, { replace: true });
  }, [editSubmissionId, navigate, privacyAccepted, year]);

  const {
    step,
    setStep,
    totalSteps,
    formData,
    uploading,
    submitted,
    canProceed,
    canSubmit,
    previewRecord,
    updateField,
    updateEmergencyContact,
    updateMedicalCondition,
    updateMeasurement,
    handleFileChange,
    getBmiCategory,
    maxBirthdate,
    submit,
  } = useStudentMedicalForm({ year, me, privacyAccepted, editSubmissionId });

  const downloadPdf = useCallback(async () => {
    if (!previewRef.current) return;
    try {
      const element = previewRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [330.2, 215.9], // Long bond: 8.5in x 13in
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const imgData = canvas.toDataURL('image/png');

      if (imgHeight <= usableHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
      } else {
        const fullCanvas = canvas;
        const pageSliceHeightPx = Math.floor((usableHeight * fullCanvas.width) / usableWidth);
        let renderedPx = 0;
        let pageIndex = 0;

        while (renderedPx < fullCanvas.height) {
          const sliceHeightPx = Math.min(pageSliceHeightPx, fullCanvas.height - renderedPx);
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = fullCanvas.width;
          pageCanvas.height = sliceHeightPx;
          const ctx = pageCanvas.getContext('2d');
          if (!ctx) break;
          ctx.drawImage(
            fullCanvas,
            0,
            renderedPx,
            fullCanvas.width,
            sliceHeightPx,
            0,
            0,
            fullCanvas.width,
            sliceHeightPx,
          );

          const sliceData = pageCanvas.toDataURL('image/png');
          const sliceHeightMm = (sliceHeightPx * usableWidth) / fullCanvas.width;

          if (pageIndex > 0) pdf.addPage();
          pdf.addImage(sliceData, 'PNG', margin, margin, usableWidth, sliceHeightMm);

          renderedPx += sliceHeightPx;
          pageIndex += 1;
        }
      }

      const safeFirstName = String(formData.firstName || 'Student').trim().replace(/\s+/g, '_');
      const safeLastName = String(formData.lastName || 'Record').trim().replace(/\s+/g, '_');
      pdf.save(`medical_record_${safeLastName}_${safeFirstName}.pdf`);
      toast.success('Medical record PDF downloaded');
    } catch {
      toast.error('Failed to download PDF. Please try again.');
    }
  }, [formData.firstName, formData.lastName]);

  if (submitted) {
    return (
      <MedicalFormSubmittedView
        previewRef={previewRef}
        previewRecord={previewRecord}
        onDownload={downloadPdf}
        onBack={() => navigate('/student')}
      />
    );
  }

  return (
    <div className="min-h-screen px-4 py-4 md:px-8 md:py-6">
      <div className="flex w-full flex-col gap-5">
        <Button variant="ghost" onClick={() => navigate('/student/year-selection')} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Year Selection
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-primary md:text-4xl">Year {year} Medical Record Form</h1>
          <p className="text-lg text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
        </div>

        <div>
          <Progress value={(step / totalSteps) * 100} className="h-2" />
        </div>

        <Card className="border-border/70 bg-white/90 shadow-[0_20px_60px_rgba(16,24,40,0.08)] lg:min-h-[calc(100vh-15.5rem)]">
          <CardContent className="flex h-full flex-col px-5 py-6 md:px-8 md:py-8 xl:px-10">
            <div className="flex-1">
              <MedicalFormStepContent
                step={step}
                formData={formData}
                onFieldChange={updateField}
                onEmergencyContactChange={updateEmergencyContact}
                onMedicalConditionChange={updateMedicalCondition}
                onMeasurementChange={updateMeasurement}
                onFileChange={handleFileChange}
                getBmiCategory={getBmiCategory}
                maxBirthdate={maxBirthdate}
              />
            </div>

            <div className="mt-10 flex flex-col gap-2 border-t border-border/70 pt-6 sm:flex-row sm:justify-between sm:gap-3">
              <Button
                variant="outline"
                onClick={() => setStep((value) => Math.max(1, value - 1))}
                disabled={step === 1}
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              {step < totalSteps ? (
                <Button onClick={() => setStep((value) => value + 1)} disabled={!canProceed} className="w-full sm:w-auto">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={submit}
                  disabled={!canProceed || uploading || !formData.submissionConfirmed}
                  className="w-full bg-primary hover:bg-primary/90 sm:w-auto"
                >
                  {uploading ? 'Submitting...' : 'Submit Medical Record'}
                  {!uploading && <Upload className="ml-2 h-4 w-4" />}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
