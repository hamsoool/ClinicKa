import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, FileText, Lock } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import {
  formatAcademicYearLabel,
  getDefaultAcademicYear,
  getLatestRecordForAcademicYear,
  getNextSubmissionSlot,
  getRecordAcademicYear,
  getSubmissionSlotLabel,
  isCurrentAcademicYearBlocked,
  normalizeAcademicYear,
} from '../../lib/academic-year';
import { useActiveAcademicYearSettingsQuery } from '../../lib/academic-year-query';
import { useStudentRecordsQuery } from './student-records-query';

const slotNumbers = [1, 2, 3, 4] as const;

export default function StudentYearSelection() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const { data = [], isLoading: recordsLoading } = useStudentRecordsQuery(studentId, 'summary');
  const { data: academicYearSettings, isLoading: academicYearLoading } = useActiveAcademicYearSettingsQuery();
  const activeAcademicYear = normalizeAcademicYear(academicYearSettings?.academicYear || getDefaultAcademicYear());
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

  const slotRecords = useMemo(() => {
    const sorted = [...records].sort(
      (a, b) =>
        new Date(b.updatedAt || b.submittedAt || 0).getTime() -
        new Date(a.updatedAt || a.submittedAt || 0).getTime(),
    );
    return slotNumbers.map((slot) => ({
      slot,
      record: sorted.find((record) => String(record.year || '') === String(slot)) || null,
    }));
  }, [records]);

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
  const helperText = currentAcademicYearRecord
    ? isApproved
      ? 'This school year is already approved.'
      : isReturned
        ? 'Clinic staff returned this school year record for correction.'
        : 'This school year record is already submitted.'
    : nextSlot
      ? 'Start this school year submission.'
      : 'All four year levels have already been used.';
  const actionLabel = isApproved
    ? 'Open clearance form'
    : isReturned
      ? 'Edit returned record'
      : canStartSubmission
        ? 'Continue to waiver'
        : isPending
          ? 'Unavailable right now'
          : 'View records';

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

      <div className="mx-auto grid max-w-[78rem] gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <button
          type="button"
          disabled={!canOpen || isPending}
          onClick={() => canOpen && !isPending && navigate(destination)}
          className={`group relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border p-5 text-left shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] transition-all sm:p-6 ${
            canOpen && !isPending
              ? 'border-primary bg-[#1fbd6b] text-[#08331d] hover:border-primary/90 hover:bg-[#19b463]'
              : 'cursor-not-allowed border-primary/10 bg-primary/5 text-on-surface-variant'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex w-fit items-center rounded-b-xl rounded-t-md bg-white/25 px-3 py-1 text-xs font-semibold text-[#08331d]">
              {statusLabel}
            </div>
            <div className="inline-flex w-fit items-center rounded-b-xl rounded-t-md bg-[#0a7f49] px-3 py-1 text-xs font-semibold text-white">
              {selectedSlotLabel}
            </div>
          </div>

          <div className="mt-8 flex h-full flex-col justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-[#064e2b]">
              <CalendarDays className="h-6 w-6" />
            </span>
            <div className="mt-5 space-y-2">
              <h3 className="text-2xl font-semibold sm:text-3xl">{formatAcademicYearLabel(activeAcademicYear)}</h3>
              <p className="text-sm font-medium text-[#0d5a34]">Medical Record Submission</p>
            </div>
            <p className="mt-4 max-w-[26rem] text-sm leading-6 text-[#0d5a34]">{helperText}</p>
            <div className="mt-auto flex items-center gap-2 pt-6 text-sm font-semibold text-[#064e2b]">
              {isPending ? <Lock className="h-4 w-4" /> : isApproved ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              {actionLabel}
            </div>
          </div>
        </button>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-on-surface">Year Levels</h3>
              <p className="text-sm text-on-surface-variant">{formatAcademicYearLabel(activeAcademicYear)}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {slotRecords.map(({ slot, record }) => {
              const isCurrentAcademicYear = record && getRecordAcademicYear(record) === activeAcademicYear;
              return (
                <div
                  key={slot}
                  className={`rounded-xl border px-4 py-3 ${
                    isCurrentAcademicYear
                      ? 'border-primary/30 bg-primary-container/10'
                      : 'border-outline-variant/20 bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-on-surface">{getSubmissionSlotLabel(slot)}</p>
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                      {record ? String(record.status || 'Submitted') : slot === nextSlot ? 'Next' : '--'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {record ? formatAcademicYearLabel(getRecordAcademicYear(record)) : slot === nextSlot ? formatAcademicYearLabel(activeAcademicYear) : '--'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
