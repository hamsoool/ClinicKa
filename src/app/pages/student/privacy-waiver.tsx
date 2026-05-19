import { useMemo, useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import StudentPageIntro from '../../components/student-page-intro';
import { Label } from '../../components/ui/label';
import {
  DATA_PRIVACY_CONSENT_ACKNOWLEDGEMENT,
  DATA_PRIVACY_CONSENT_BODY,
  DATA_PRIVACY_RIGHTS_NOTICE,
} from './medical-form/constants';

export default function StudentPrivacyWaiver() {
  const navigate = useNavigate();
  const { year } = useParams();
  const [searchParams] = useSearchParams();
  const [dataPrivacyConsent, setDataPrivacyConsent] = useState(false);
  const canContinue = dataPrivacyConsent;
  const editSubmissionId = searchParams.get('edit');
  const yearLabel = useMemo(() => {
    switch (year) {
      case '1':
        return '1st Year';
      case '2':
        return '2nd Year';
      case '3':
        return '3rd Year';
      case '4':
        return '4th Year';
      default:
        return `Year ${year || ''}`.trim();
    }
  }, [year]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <button
        type="button"
        onClick={() => navigate('/student/year-selection')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Year Selection
      </button>

      <StudentPageIntro
        title="Before You Continue"
        description={`Make sure your profile requirements are complete before proceeding to the ${yearLabel} medical record form.`}
      />

      <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
        <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
          <CardTitle>Profile Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-on-surface">Privacy Consent</p>
                <p className="text-sm text-on-surface-variant">
                  This consent is required before you can continue to the medical record form.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/70 p-5 text-sm leading-7 text-emerald-950">
                <p>{DATA_PRIVACY_CONSENT_BODY}</p>
              </div>

              <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/70 p-5 text-sm leading-7 text-emerald-950">
                <p>{DATA_PRIVACY_RIGHTS_NOTICE}</p>
              </div>

              <div
                className={`rounded-[1.25rem] border p-4 ${
                  dataPrivacyConsent ? 'border-emerald-200 bg-emerald-50/70' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="dataPrivacyConsent"
                    checked={dataPrivacyConsent}
                    onCheckedChange={(checked) => setDataPrivacyConsent(checked === true)}
                    className="mt-1"
                  />
                  <Label htmlFor="dataPrivacyConsent" className="text-sm font-normal leading-6 text-on-surface">
                    {DATA_PRIVACY_CONSENT_ACKNOWLEDGEMENT}
                  </Label>
                </div>
              </div>
            </div>
          </div>

        </CardContent>
        <CardFooter className="flex items-center justify-between border-t border-outline-variant/30 bg-surface-container-low px-6 py-4">
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
