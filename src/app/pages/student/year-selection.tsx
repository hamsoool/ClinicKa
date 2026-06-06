import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Lock } from 'lucide-react';
import StudentPageIntro from '../../components/student-page-intro';
import { useAuth } from '../../lib/auth';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import {
  formatAcademicYearLabel,
  getLatestRecordForAcademicYear,
  getNextSubmissionSlot,
  getSubmissionSlotLabel,
  MAX_SUBMISSION_CYCLE,
  isCurrentAcademicYearBlocked,
} from '../../lib/academic-year';
import { useAcademicYear } from '../../lib/academic-year-query';
import { useStudentRecordsQuery } from './student-records-query';

export default function StudentYearSelection() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const { data = [], isLoading: recordsLoading } = useStudentRecordsQuery(studentId, 'summary');
  const {
    academicYear: activeAcademicYear,
    academicYearLabel,
    isLoading: academicYearLoading,
  } = useAcademicYear();
  const records = data;

  const currentAcademicYearRecord = useMemo(
    () => getLatestRecordForAcademicYear(records, activeAcademicYear),
    [activeAcademicYear, records],
  );
  const nextSlot = useMemo(
    () => getNextSubmissionSlot(records, activeAcademicYear),
    [activeAcademicYear, records],
  );
  const selectedSlot = currentAcademicYearRecord?.year || (nextSlot ? String(nextSlot) : '');
  const selectedSlotLabel = getSubmissionSlotLabel(selectedSlot);
  const latestStatus = String(currentAcademicYearRecord?.status || '').toLowerCase();
  const isApproved = latestStatus === 'approved';
  const isReturned = latestStatus === 'returned';
  const isBlocked = isCurrentAcademicYearBlocked(currentAcademicYearRecord);
  const isPending = isBlocked && !isApproved;
  const canStartSubmission = Boolean(!currentAcademicYearRecord && nextSlot);
  const canOpen = Boolean(isApproved || isReturned || canStartSubmission);
  const destination = isApproved
    ? `/student/clearance?tab=medical-clearance&year=${selectedSlot || '1'}`
    : isReturned
      ? `/student/privacy-waiver/${selectedSlot || '1'}?edit=${encodeURIComponent(currentAcademicYearRecord?.id || '')}`
      : selectedSlot
        ? `/student/privacy-waiver/${selectedSlot}`
        : '/student/clearance?tab=history';

  if ((recordsLoading && studentId) || academicYearLoading) {
    return <PortalPageSkeleton variant="year-selection" />;
  }

  const statusLabel = currentAcademicYearRecord
    ? isApproved
      ? 'Approved'
      : isReturned
        ? 'Returned'
        : 'In Review'
    : nextSlot
      ? 'Open'
      : 'Complete';
  const actionLabel = isApproved
    ? 'Open medical certificate'
    : isReturned
      ? 'Edit returned record'
      : canStartSubmission
        ? 'Start medical record'
        : isPending
          ? 'Unavailable right now'
          : 'View records';
  const isActionable = canOpen && !isPending;
  const introCopy = currentAcademicYearRecord
    ? isApproved
      ? 'Your submission for this school year is already approved. Open your medical certificate to review or download it.'
      : isReturned
        ? 'Your latest medical record needs updates. Open it to review the clinic feedback and resubmit.'
        : 'Your current school year submission is already in progress. You can continue once the clinic requests changes.'
    : nextSlot
      ? `Begin your clinic submission for ${academicYearLabel}. This will be filed under ${selectedSlotLabel}.`
      : `You have already used all ${MAX_SUBMISSION_CYCLE} record cycles.`;
  const cardStyles = isActionable
    ? 'cursor-pointer border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low hover:shadow-[0_22px_60px_rgba(16,24,40,0.10)]'
    : 'cursor-not-allowed border-outline-variant/30 bg-surface-container-lowest/80';
  const actionButtonStyles = isActionable
    ? 'bg-primary text-on-primary'
    : 'bg-surface-container text-on-surface-variant';
  const summaryCardStyles = isActionable
    ? 'border-primary/10 bg-primary-container/10'
    : 'border-outline-variant/20 bg-surface-container-low';
  const pageDescription = nextSlot
    ? `Start or continue your clinic submission for ${academicYearLabel}.`
    : `All ${MAX_SUBMISSION_CYCLE} submission cycles have already been used.`;

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-5 sm:space-y-8">
      <button
        type="button"
        onClick={() => navigate('/student')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <StudentPageIntro
        title="Submit Medical Record"
        description={pageDescription}
        className="max-w-[78rem]"
      />

      <div className="mx-auto max-w-[78rem]">
        <button
          type="button"
          disabled={!canOpen || isPending}
          onClick={() => canOpen && !isPending && navigate(destination)}
          className={`group block w-full rounded-[1.75rem] border p-5 text-left shadow-[0_18px_60px_rgba(16,24,40,0.08)] transition-all duration-200 sm:p-8 ${cardStyles}`}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-primary-container/15 px-3 py-1 text-xs font-semibold text-primary">
                  {selectedSlotLabel}
                </span>
                <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">
                  {statusLabel}
                </span>
              </div>

              <div className="mt-5 flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CalendarDays className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    {academicYearLabel}
                  </p>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
                    {isApproved
                      ? 'Open your medical certificate'
                      : isReturned
                        ? 'Continue your returned submission'
                        : canStartSubmission
                          ? 'Start your medical record submission'
                          : 'Submission currently unavailable'}
                  </h1>
                </div>
              </div>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-on-surface-variant sm:text-base">
                {introCopy}
              </p>

              <span className={`mt-7 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition-colors duration-200 sm:px-5 ${actionButtonStyles}`}>
                {isPending ? <Lock className="h-4 w-4" /> : isApproved ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                {actionLabel}
              </span>
            </div>

            <div className={`rounded-2xl border p-5 sm:p-6 ${summaryCardStyles}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                Submission Details
              </p>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-sm text-on-surface-variant">School Year</dt>
                  <dd className="mt-1 text-base font-semibold text-on-surface">
                    {academicYearLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-on-surface-variant">Record Slot</dt>
                  <dd className="mt-1 text-base font-semibold text-on-surface">{selectedSlotLabel || 'Unavailable'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-on-surface-variant">Status</dt>
                  <dd className="mt-1 text-base font-semibold text-on-surface">{statusLabel}</dd>
                </div>
              </dl>

              <div className="mt-6 rounded-xl bg-surface-container-low px-4 py-3 text-sm leading-6 text-on-surface-variant">
                {nextSlot ? 'You can submit relevant requirements again next year.' : 'No additional record cycles are available.'}
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
