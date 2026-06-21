import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import StudentPageIntro from '../../components/student-page-intro';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../lib/auth';
import {
  getLatestRecordForAcademicYear,
  getNextSubmissionSlot,
  getSubmissionSlotLabel,
  normalizeSubmissionSlot,
} from '../../lib/academic-year';
import { useAcademicYear } from '../../lib/academic-year-query';
import { useStudentRecordsQuery } from './student-records-query';
import {
  DATA_PRIVACY_CONSENT_ACKNOWLEDGEMENT,
  DATA_PRIVACY_CONSENT_BODY,
  DATA_PRIVACY_RIGHTS_NOTICE,
} from './medical-form/constants';

export default function StudentPrivacyWaiver() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const { year } = useParams();
  const [searchParams] = useSearchParams();
  const [dataPrivacyConsent, setDataPrivacyConsent] = useState(false);
  const canContinue = dataPrivacyConsent;
  const editSubmissionId = searchParams.get('edit');
  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const { data: records = [], isLoading: recordsLoading } = useStudentRecordsQuery(studentId, 'summary');
  const { academicYear: activeAcademicYear, isLoading: academicYearLoading } = useAcademicYear();
  const selectedSlot = normalizeSubmissionSlot(year);
  const currentAcademicYearRecord = getLatestRecordForAcademicYear(records, activeAcademicYear);
  const expectedSlot = getNextSubmissionSlot(records, activeAcademicYear);
  const editRecord = editSubmissionId
    ? records.find((record) => String(record.id || '') === editSubmissionId)
    : null;
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
    <div className="mx-auto w-full max-w-[100rem] space-y-8">
      <button
        type="button"
        onClick={() => navigate('/student/year-selection')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Year Selection
      </button>

      <StudentPageIntro
        title="Data Privacy Waiver"
      />

      <Card className="overflow-hidden rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest">
        <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold tracking-tight text-on-surface">Consent and Privacy Notice</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {/* Stacked details */}
          <div className="space-y-6">
            <div className="rounded-[22px] border border-outline-variant/30 bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-bold text-lg text-on-surface">What you are consenting to</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your information is used only for your clinic record, review, and related student health services.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/50 p-5 text-sm leading-relaxed text-on-surface-variant font-medium">
                <p className="leading-7">{DATA_PRIVACY_CONSENT_BODY}</p>
              </div>
            </div>

            <div className="rounded-[22px] border border-outline-variant/30 bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                  <FileText className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-bold text-lg text-on-surface">Your rights as a data subject</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You may ask questions, request access, or raise concerns through the proper Gordon College office.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/50 p-5 text-sm leading-relaxed text-on-surface-variant font-medium">
                <p className="leading-7">{DATA_PRIVACY_RIGHTS_NOTICE}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-outline-variant/30 bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                <ChevronRight className="h-6 w-6" />
              </span>
              <div>
                <p className="font-bold text-lg text-on-surface">Before you continue</p>
                <p className="text-xs text-muted-foreground mt-0.5">Confirm this waiver, then proceed to the full medical form.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="group relative rounded-xl border border-outline-variant/20 bg-surface-container-low/30 p-5 transition-all duration-300 hover:border-primary/20 hover:bg-surface-container-low/60">
                <div className="absolute top-4 right-4 text-xs font-bold text-primary/30 group-hover:text-primary/50 transition-colors">
                  STEP 01
                </div>
                <p className="text-sm font-bold text-on-surface">Review the consent details</p>
                <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                  Read how Gordon College Clinic stores and uses your personal and medical information.
                </p>
              </div>
              <div className="group relative rounded-xl border border-outline-variant/20 bg-surface-container-low/30 p-5 transition-all duration-300 hover:border-primary/20 hover:bg-surface-container-low/60">
                <div className="absolute top-4 right-4 text-xs font-bold text-primary/30 group-hover:text-primary/50 transition-colors">
                  STEP 02
                </div>
                <p className="text-sm font-bold text-on-surface">Continue to the record form</p>
                <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                  Your progress in the next step is saved automatically while you complete it.
                </p>
              </div>
            </div>
          </div>

          <div
            className={`group relative rounded-[22px] border p-6 transition-all duration-300 ${
              dataPrivacyConsent
                ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-teal-50/30 shadow-[0_4px_16px_rgba(16,185,129,0.04)]'
                : 'border-amber-200 bg-gradient-to-br from-amber-50/60 to-orange-50/20 shadow-[0_4px_16px_rgba(245,158,11,0.02)]'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <Checkbox
                  id="dataPrivacyConsent"
                  checked={dataPrivacyConsent}
                  onCheckedChange={(checked) => setDataPrivacyConsent(checked === true)}
                  className="h-5 w-5 rounded-md transition-all duration-300"
                />
              </div>
              <div className="space-y-2.5">
                <Label
                  htmlFor="dataPrivacyConsent"
                  className={`text-sm font-bold leading-relaxed cursor-pointer transition-colors ${
                    dataPrivacyConsent ? 'text-emerald-950' : 'text-amber-950'
                  }`}
                >
                  {DATA_PRIVACY_CONSENT_ACKNOWLEDGEMENT}
                </Label>
                <p
                  className={`text-xs font-medium leading-relaxed transition-colors ${
                    dataPrivacyConsent ? 'text-emerald-800' : 'text-amber-800'
                  }`}
                >
                  {dataPrivacyConsent
                    ? 'Consent recorded. You can now continue to the medical form.'
                    : 'Please confirm this waiver to proceed to the medical form.'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t border-outline-variant/30 bg-surface-container-low px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={() => navigate('/student/profile')}>
            Go to Profile
          </Button>
          <Button
            type="button"
            disabled={!canContinue}
            onClick={() =>
              navigate(`/student/medical-form/${year}?consent=1${editSubmissionId ? `&edit=${encodeURIComponent(editSubmissionId)}` : ''}`)
            }
          >
            Continue to Medical Form
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
