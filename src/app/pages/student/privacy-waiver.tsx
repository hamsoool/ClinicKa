import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, ChevronRight, FileText, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import StudentPageIntro from '../../components/student-page-intro';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../lib/auth';
import { getYearLevelLabel, isCurrentSubmissionYear, resolveStudentYearLevel } from '../../lib/student-year';
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
  const canAccessSelectedYear = isCurrentSubmissionYear(me, year);
  const currentYearLabel = getYearLevelLabel(resolveStudentYearLevel(me));
  const yearLabel = useMemo(() => {
    return getYearLevelLabel(year);
  }, [year]);

  useEffect(() => {
    if (canAccessSelectedYear) return;

    toast.error(`Only your current year level (${currentYearLabel}) can open the submission waiver.`);
    navigate('/student/year-selection', { replace: true });
  }, [canAccessSelectedYear, currentYearLabel, navigate]);

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
        description={`Review and accept the privacy consent for your ${yearLabel} medical record before continuing to the submission form.`}
      />

      <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
        <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight text-on-surface">Consent and Privacy Notice</CardTitle>
              <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
                This explains why the clinic collects your information, how it is protected, and the rights you keep as a student.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-container/20 px-3 py-1.5 text-sm font-medium text-on-primary-container">
              <BadgeCheck className="h-4 w-4" />
              Required before submission
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-on-surface">What you are consenting to</p>
                    <p className="text-sm text-on-surface-variant">
                      Your information is used only for your clinic record, review, and related student health services.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 text-sm leading-7 text-on-surface">
                  <p>{DATA_PRIVACY_CONSENT_BODY}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-on-surface">Your rights as a data subject</p>
                    <p className="text-sm text-on-surface-variant">
                      You may ask questions, request access, or raise concerns through the proper Gordon College office.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 text-sm leading-7 text-on-surface">
                  <p>{DATA_PRIVACY_RIGHTS_NOTICE}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                    <ChevronRight className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-on-surface">Before you continue</p>
                    <p className="text-sm text-on-surface-variant">Confirm this waiver, then proceed to the full medical form.</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
                    <p className="text-sm font-medium text-on-surface">1. Review the consent details</p>
                    <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                      Read how Gordon College Clinic stores and uses your personal and medical information.
                    </p>
                  </div>
                  <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
                    <p className="text-sm font-medium text-on-surface">2. Tick the acknowledgment box</p>
                    <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                      This unlocks the medical form for your selected year level.
                    </p>
                  </div>
                  <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
                    <p className="text-sm font-medium text-on-surface">3. Continue to the record form</p>
                    <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                      Your progress in the next step is saved automatically while you complete it.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-2xl border p-5 transition-colors ${
                  dataPrivacyConsent
                    ? 'border-primary/20 bg-primary-container/10'
                    : 'border-amber-200/80 bg-amber-50/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="dataPrivacyConsent"
                    checked={dataPrivacyConsent}
                    onCheckedChange={(checked) => setDataPrivacyConsent(checked === true)}
                    className="mt-1"
                  />
                  <div className="space-y-2">
                    <Label htmlFor="dataPrivacyConsent" className="text-sm font-medium leading-6 text-on-surface">
                      {DATA_PRIVACY_CONSENT_ACKNOWLEDGEMENT}
                    </Label>
                    <p className={`text-sm ${dataPrivacyConsent ? 'text-on-primary-container' : 'text-amber-800'}`}>
                      {dataPrivacyConsent ? 'Consent recorded. You can now continue to the medical form.' : 'Please confirm this waiver to proceed to the medical form.'}
                    </p>
                  </div>
                </div>
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
