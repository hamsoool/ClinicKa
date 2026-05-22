import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, GraduationCap, Lock } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import { getYearLevelLabel, resolveStudentYearLevel } from '../../lib/student-year';
import { resolveStudentSubmissionProfile, toCategoryLabel } from '../../lib/student-submission-profile';
import { useStudentRecordsQuery } from './student-records-query';

const years = [
  { level: 1, name: '1st Year', description: 'Freshman Requirements' },
  { level: 2, name: '2nd Year', description: 'Sophomore Requirements' },
  { level: 3, name: '3rd Year', description: 'Junior Requirements' },
  { level: 4, name: '4th Year', description: 'Senior Requirements' },
];

export default function StudentYearSelection() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const studentYearLevel = resolveStudentYearLevel(me);
  const submissionProfile = useMemo(() => resolveStudentSubmissionProfile(me), [me]);
  const hasYearOverride =
    (submissionProfile.category === 'returning' || submissionProfile.category === 'repeater_irregular') &&
    Boolean(submissionProfile.targetYearLevel);
  const allowedYearLevel = hasYearOverride ? Number(submissionProfile.targetYearLevel) : studentYearLevel;
  const currentYearLabel = getYearLevelLabel(allowedYearLevel);
  const { data = [], isLoading } = useStudentRecordsQuery(studentId);
  const records = data;
  const latestByYear = useMemo(() => {
    const map = new Map<number, { status: string; updatedAt?: string; submittedAt?: string }>();
    records.forEach((record) => {
      const year = Number.parseInt(String(record?.year || ''), 10);
      if (!Number.isInteger(year) || year < 1 || year > 4) return;
      const current = map.get(year);
      const currentTs = current ? new Date(current.updatedAt || current.submittedAt || 0).getTime() : -1;
      const nextTs = new Date(record?.updatedAt || record?.submittedAt || 0).getTime();
      if (!current || nextTs >= currentTs) {
        map.set(year, {
          status: String(record?.status || '').toLowerCase(),
          updatedAt: record?.updatedAt,
          submittedAt: record?.submittedAt,
        });
      }
    });
    return map;
  }, [records]);
  if (isLoading && studentId) {
    return <PortalPageSkeleton variant="year-selection" />;
  }

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

      <div className="mx-auto grid max-w-[78rem] gap-5 md:grid-cols-2 xl:gap-6">
        {years.map((year) => {
          const latestYearStatus = latestByYear.get(year.level)?.status || '';
          const isApprovedLocked = latestYearStatus === 'approved';
          const isPendingLocked = latestYearStatus === 'pending' || latestYearStatus === 'in_review' || latestYearStatus === 'resubmitted';
          const isReturned = latestYearStatus === 'returned';
          const isCurrent = year.level === allowedYearLevel;
          const isNonCurrentLocked = !isCurrent && !isApprovedLocked;
          const isLocked = isPendingLocked || isNonCurrentLocked;
          const destination = isApprovedLocked
            ? `/student/clearance?tab=medical-clearance&year=${year.level}`
            : `/student/privacy-waiver/${year.level}`;
          const cardStatusLabel = isApprovedLocked
            ? 'Approved'
            : isPendingLocked
              ? 'Pending'
              : isReturned && isCurrent
                ? 'Returned'
                : isNonCurrentLocked
                  ? 'Locked'
                : isCurrent
                  ? 'Current Year'
                  : 'Available';
          const cardHelperText = isApprovedLocked
            ? 'Already approved. Further submissions are locked.'
            : isPendingLocked
              ? 'Submission is under review. Please wait for clinic feedback.'
              : isReturned && isCurrent
                ? 'Returned by clinic staff. You may edit and resubmit.'
                : isNonCurrentLocked
                  ? `Only your ${hasYearOverride ? 'selected submission year' : 'current year level'} (${currentYearLabel}) can be submitted.`
                  : year.description;
          const statusClasses = isApprovedLocked
            ? 'bg-primary-container/20 text-on-primary-container'
            : isPendingLocked
              ? 'bg-amber-100 text-amber-800'
              : isReturned && isCurrent
                ? 'bg-error-container/70 text-on-error-container'
                : isCurrent
                  ? 'bg-primary/10 text-primary'
                  : 'bg-surface-variant text-on-surface-variant';
          const cardClasses = isLocked
            ? isCurrent
              ? 'cursor-not-allowed border-primary bg-[#1fbd6b] text-on-surface'
              : 'cursor-not-allowed border-primary/10 bg-primary/5 text-on-surface-variant'
            : isCurrent
              ? 'border-primary bg-[#1fbd6b] text-on-surface hover:border-primary/90 hover:bg-[#19b463]'
              : 'border-primary/15 bg-primary/5 text-on-surface hover:border-primary/25 hover:bg-primary/10';
          const iconClasses = isLocked
            ? isCurrent
              ? 'bg-primary/10 text-[#064e2b]'
              : 'bg-primary/10 text-primary/50'
            : isCurrent
              ? 'bg-primary/10 text-[#064e2b]'
              : 'bg-primary/10 text-primary';
          const titleClasses = isCurrent ? 'text-[#08331d]' : 'text-primary';
          const subtitleClasses = isCurrent ? 'text-[#0d5a34]' : 'text-primary/80';
          const bodyClasses = isCurrent ? 'text-[#0d5a34]' : 'text-primary/75';
          const actionClasses = isLocked
            ? isCurrent
              ? 'text-[#0b6a3d]'
              : 'text-primary/50'
            : isCurrent
              ? 'text-[#064e2b]'
              : 'text-primary';

          return (
            <button
              key={year.level}
              type="button"
              disabled={isLocked}
              onClick={() => !isLocked && navigate(destination)}
              className={`group relative flex min-h-[250px] flex-col overflow-hidden rounded-2xl border p-5 text-center shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] transition-all sm:p-6 ${cardClasses}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`inline-flex w-fit items-center rounded-b-xl rounded-t-md px-3 py-1 text-xs font-semibold ${statusClasses}`}>
                  {cardStatusLabel}
                </div>
                {isCurrent ? (
                  <div className="inline-flex w-fit items-center rounded-b-xl rounded-t-md bg-[#0a7f49] px-3 py-1 text-xs font-semibold text-white">
                    {hasYearOverride ? `${toCategoryLabel(submissionProfile.category)} Year` : 'Current Year'}
                  </div>
                ) : isLocked ? (
                  <span className="text-outline">
                    <Lock className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="text-primary opacity-70 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </div>

              <div className="mt-7 flex h-full flex-col items-center justify-center">
                <span
                  className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${iconClasses}`}
                >
                  <GraduationCap className="h-6 w-6" />
                </span>

                <div className="mt-4 space-y-2">
                  <h3 className={`text-xl font-semibold sm:text-2xl ${titleClasses}`}>{year.name}</h3>
                  {!isApprovedLocked && !isPendingLocked && !(isReturned && isCurrent) ? (
                    <p className={`text-sm font-medium ${subtitleClasses}`}>{year.description}</p>
                  ) : null}
                </div>

                <p className={`mt-4 max-w-[18rem] text-sm leading-6 ${bodyClasses}`}>{cardHelperText}</p>

                <div className="mt-auto pt-6">
                  <p className={`text-sm font-semibold ${actionClasses}`}>
                    {isPendingLocked
                      ? 'Unavailable right now'
                      : isNonCurrentLocked
                        ? hasYearOverride
                          ? 'Selected year only'
                          : 'Current year only'
                        : isApprovedLocked
                          ? 'Open clearance form'
                          : isReturned && isCurrent
                            ? 'Open returned record'
                            : 'Continue to waiver'}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
