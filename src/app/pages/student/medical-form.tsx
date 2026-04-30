import { useCallback, useRef } from 'react';
import { ArrowLeft, ArrowRight, Upload } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
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
  const { me } = useAuth();
  const previewRef = useRef<HTMLDivElement>(null);

  const {
    step,
    setStep,
    totalSteps,
    formData,
    uploading,
    submitted,
    canProceed,
    previewRecord,
    updateField,
    updateEmergencyContact,
    updateMedicalCondition,
    updateMeasurement,
    handleFileChange,
    getBmiCategory,
    submit,
  } = useStudentMedicalForm({ year, me });

  const downloadPdf = useCallback(() => {
    if (!previewRef.current) return;

    const content = previewRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=816,height=1260');
    if (!printWindow) {
      toast.error('Please allow pop-ups to download');
      return;
    }

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Medical Record - ${formData.firstName} ${formData.lastName}</title>
      <style>
        @page { size: 8.5in 13in; margin: 0.5in; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    </head><body>${content}
      <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
    </body></html>`);

    printWindow.document.close();
    toast.success('Medical record PDF downloading...');
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
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/student/year-selection')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Year Selection
        </Button>

        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-primary">Year {year} Medical Record Form</h1>
          <p className="text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
        </div>

        <div className="mb-8">
          <Progress value={(step / totalSteps) * 100} className="h-2" />
        </div>

        <Card>
          <CardContent className="pt-6">
            <MedicalFormStepContent
              step={step}
              formData={formData}
              onFieldChange={updateField}
              onEmergencyContactChange={updateEmergencyContact}
              onMedicalConditionChange={updateMedicalCondition}
              onMeasurementChange={updateMeasurement}
              onFileChange={handleFileChange}
              getBmiCategory={getBmiCategory}
            />

            <div className="mt-8 flex justify-between border-t pt-6">
              <Button variant="outline" onClick={() => setStep((value) => Math.max(1, value - 1))} disabled={step === 1}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              {step < totalSteps ? (
                <Button onClick={() => setStep((value) => value + 1)} disabled={!canProceed}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={!canProceed || uploading} className="bg-primary hover:bg-primary/90">
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
