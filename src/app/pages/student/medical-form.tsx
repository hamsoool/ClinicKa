import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Upload } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import StudentPageIntro from '../../components/student-page-intro';
import { useAuth } from '../../lib/auth';
import { getYearLevelLabel, resolveStudentYearLevel } from '../../lib/student-year';
import { resolveStudentSubmissionProfile } from '../../lib/student-submission-profile';
import { MedicalFormStepContent } from './medical-form/medical-form-step-content';
import { useStudentMedicalForm } from './medical-form/use-student-medical-form';

export default function StudentMedicalForm() {
  const navigate = useNavigate();
  const { year } = useParams();
  const [searchParams] = useSearchParams();
  const { me } = useAuth();
  const editSubmissionId = searchParams.get('edit');
  const hasDataPrivacyConsent = searchParams.get('consent') === '1';
  const submissionProfile = resolveStudentSubmissionProfile(me);
  const allowedYearLevel =
    (submissionProfile.category === 'returning' || submissionProfile.category === 'repeater_irregular') &&
    submissionProfile.targetYearLevel
      ? submissionProfile.targetYearLevel
      : resolveStudentYearLevel(me);
  const canAccessSelectedYear = Number.parseInt(String(year || ''), 10) === allowedYearLevel;
  const currentYearLabel = getYearLevelLabel(allowedYearLevel);

  const {
    step,
    setStep,
    totalSteps,
    formData,
    uploading,
    submitted,
    canProceed,
    canSubmit,
    submitBlockers,
    hasRequiredProfileFields,
    hasProfilePhoto,
    hasProfileSignature,
    profileAssetsLoading,
    hasCbcFile,
    hasUrinalysisFile,
    hasXrayFile,
    labResultAccept,
    labResultMaxFileSizeLabel,
    labResultAutoOptimizeThresholdLabel,
    updateField,
    updateEmergencyContact,
    updateMedicalCondition,
    updateLabFile,
    requiresCbcFile,
    requiresUrinalysisFile,
    requiresXrayFile,
    submit,
  } = useStudentMedicalForm({ year, me, editSubmissionId, initialDataPrivacyConsent: hasDataPrivacyConsent });

  useEffect(() => {
    if (!submitted) return;
    navigate('/student/year-selection', { replace: true });
  }, [navigate, submitted]);

  useEffect(() => {
    if (canAccessSelectedYear) return;

    toast.error(`Only your current year level (${currentYearLabel}) can open the medical form.`);
    navigate('/student/year-selection', { replace: true });
  }, [canAccessSelectedYear, currentYearLabel, navigate]);

  if (!canAccessSelectedYear) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-[100rem]">
      <div className="flex w-full flex-col gap-5">
        <Button variant="ghost" onClick={() => navigate('/student/year-selection')} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Year Selection
        </Button>

        <StudentPageIntro
          title={`Year ${year} Medical Record Form`}
          description="Complete each section carefully. Your progress is saved automatically while you work."
        />

        <div className="space-y-2">
          <div className="flex flex-col gap-1 text-sm font-medium text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
            <span>Submission progress</span>
            <span>Step {step} of {totalSteps}</span>
          </div>
          <Progress value={(step / totalSteps) * 100} className="h-2" />
        </div>

        <Card className="border-border/70 bg-white/90 shadow-[0_20px_60px_rgba(16,24,40,0.08)]">
          <CardContent className="flex flex-col px-4 py-5 sm:px-5 sm:py-6 md:px-8 md:py-8 xl:px-10">
            <div>
              <MedicalFormStepContent
                step={step}
                formData={formData}
                onFieldChange={updateField}
                onEmergencyContactChange={updateEmergencyContact}
                onMedicalConditionChange={updateMedicalCondition}
                hasRequiredProfileFields={hasRequiredProfileFields}
                hasProfilePhoto={hasProfilePhoto}
                hasProfileSignature={hasProfileSignature}
                profileAssetsLoading={profileAssetsLoading}
                hasCbcFile={hasCbcFile}
                hasUrinalysisFile={hasUrinalysisFile}
                hasXrayFile={hasXrayFile}
                requiresCbcFile={requiresCbcFile}
                requiresUrinalysisFile={requiresUrinalysisFile}
                requiresXrayFile={requiresXrayFile}
                labResultAccept={labResultAccept}
                labResultMaxFileSizeLabel={labResultMaxFileSizeLabel}
                labResultAutoOptimizeThresholdLabel={labResultAutoOptimizeThresholdLabel}
                submitBlockers={submitBlockers}
                onGoToProfile={() => navigate('/student/profile')}
                onLabFileChange={updateLabFile}
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
                  disabled={!canProceed || !canSubmit || uploading}
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
