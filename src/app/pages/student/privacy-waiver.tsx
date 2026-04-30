import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileCheck2, PenLine, ShieldCheck, XCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { getStudentProfileAssets } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function StudentPrivacyWaiver() {
  const navigate = useNavigate();
  const { year } = useParams();
  const { me } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const profileId = me?.student?.profile_id || me?.profile.id || '';

  useEffect(() => {
    if (!studentId || !profileId) {
      setHasPhoto(false);
      setHasSignature(false);
      setLoadingAssets(false);
      return;
    }

    let active = true;
    setLoadingAssets(true);

    const loadAssets = async () => {
      try {
        const assets = await getStudentProfileAssets(studentId, profileId);
        if (!active) return;
        setHasPhoto(Boolean(assets.photoUrl));
        setHasSignature(Boolean(assets.signatureUrl));
      } catch {
        if (!active) return;
        setHasPhoto(false);
        setHasSignature(false);
      } finally {
        if (active) {
          setLoadingAssets(false);
        }
      }
    };

    void loadAssets();

    return () => {
      active = false;
    };
  }, [profileId, studentId]);

  const profileReady = hasPhoto && hasSignature;
  const canContinue = accepted && profileReady && !loadingAssets;
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

      <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-on-surface">Data Privacy Waiver</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              Review and accept this waiver before proceeding to the {yearLabel} medical record form.
            </p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
        <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
          <CardTitle>Privacy Consent</CardTitle>
          <CardDescription>
            This consent is required before you can submit your medical record.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 text-sm leading-7 text-on-surface">
            I am willing to disclose my personal information with the Gordon College clinic. I have the right to
            access my personal data in a timely manner within five days of request. The clinic respects patient privacy
            and is accountable for protecting my personal information.
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
            <Checkbox id="privacyConsent" checked={accepted} onCheckedChange={(checked) => setAccepted(checked === true)} />
            <label htmlFor="privacyConsent" className="text-sm leading-6 text-on-surface">
              I have read and understood the Data Privacy Waiver, and I consent to the collection and use of my
              personal information for clinic record processing.
            </label>
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
            <div className="mb-4 flex items-center gap-3">
              <FileCheck2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-on-surface">Profile Requirements Check</p>
                <p className="text-sm text-on-surface-variant">
                  Your 1x1 photo and signature are now managed from the Profile tab.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-outline-variant/20 bg-white/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className={`h-5 w-5 ${hasPhoto ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium text-on-surface">1x1 Student Photo</span>
                </div>
                <span className={`text-sm ${hasPhoto ? 'text-green-700' : 'text-amber-700'}`}>
                  {loadingAssets ? 'Checking...' : hasPhoto ? 'Ready' : 'Missing'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-outline-variant/20 bg-white/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <PenLine className={`h-5 w-5 ${hasSignature ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium text-on-surface">Student Signature</span>
                </div>
                <span className={`text-sm ${hasSignature ? 'text-green-700' : 'text-amber-700'}`}>
                  {loadingAssets ? 'Checking...' : hasSignature ? 'Ready' : 'Missing'}
                </span>
              </div>
            </div>

            {!loadingAssets && !profileReady ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  Upload your 1x1 photo and signature in the Profile tab before continuing with record submission.
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t border-outline-variant/30 bg-surface-container-low px-6 py-4">
          <Button type="button" variant="outline" onClick={() => navigate('/student/profile')}>
            Go to Profile
          </Button>
          <Button
            type="button"
            disabled={!canContinue}
            onClick={() => navigate(`/student/medical-form/${year}?privacy=accepted`)}
          >
            Continue to Medical Form
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
