import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Upload } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import StudentPageIntro from '../../components/student-page-intro';
import { useAuth } from '../../lib/auth';
import {
  formatAcademicYearLabel,
  getLatestRecordForAcademicYear,
  getNextSubmissionSlot,
  getRecordAcademicYear,
  getSubmissionSlotLabel,
  normalizeSubmissionSlot,
} from '../../lib/academic-year';
import { useAcademicYear } from '../../lib/academic-year-query';
import { MedicalFormStepContent } from './medical-form/medical-form-step-content';
import { useStudentMedicalForm } from './medical-form/use-student-medical-form';
import { useStudentRecordsQuery } from './student-records-query';

export default function StudentMedicalForm() {
  const navigate = useNavigate();
  const { year } = useParams();
  const [searchParams] = useSearchParams();
  const { me } = useAuth();
  const editSubmissionId = searchParams.get('edit');
  const hasDataPrivacyConsent = searchParams.get('consent') === '1';
  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const { data: records = [], isLoading: recordsLoading } = useStudentRecordsQuery(studentId, 'summary');
  const { academicYear: activeAcademicYear, isLoading: academicYearLoading } = useAcademicYear();
  const selectedSlot = normalizeSubmissionSlot(year);
  const currentAcademicYearRecord = getLatestRecordForAcademicYear(records, activeAcademicYear);
  const expectedSlot = getNextSubmissionSlot(records, activeAcademicYear);
  const editRecord = editSubmissionId
    ? records.find((record) => String(record.id || '') === editSubmissionId)
    : null;
  const formAcademicYear = editRecord ? getRecordAcademicYear(editRecord, activeAcademicYear) : activeAcademicYear;
  const currentAcademicYearStatus = String(currentAcademicYearRecord?.status || '').toLowerCase();
  const canOpenCurrentAcademicYearRecord = !currentAcademicYearRecord || currentAcademicYearStatus === 'returned';
  const canAccessSelectedYear = Boolean(
    selectedSlot &&
      (editRecord
        ? String(editRecord.status || '').toLowerCase() === 'returned' &&
          String(editRecord.year || '') === String(selectedSlot)
        : canOpenCurrentAcademicYearRecord &&
          String(currentAcademicYearRecord?.year || expectedSlot || '') === String(selectedSlot)),
  );

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
    isEmergencyAddressSameAsStudent,
    updateEmergencyAddressSync,
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
    if (recordsLoading || academicYearLoading) return;
    if (canAccessSelectedYear) return;

    toast.error(`This school year submission is filed under ${expectedSlot ? getSubmissionSlotLabel(expectedSlot) : 'the next available record slot'}.`);
    navigate('/student/year-selection', { replace: true });
  }, [academicYearLoading, canAccessSelectedYear, expectedSlot, navigate, recordsLoading]);

  if (recordsLoading || academicYearLoading) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

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
          title={`${formatAcademicYearLabel(formAcademicYear)} Medical Record Form`}
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
                isEmergencyAddressSameAsStudent={isEmergencyAddressSameAsStudent}
                onEmergencyAddressSyncChange={updateEmergencyAddressSync}
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
                  loading={uploading}
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
