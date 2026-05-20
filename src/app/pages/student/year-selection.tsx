import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, GraduationCap, Lock } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import StudentPageIntro from '../../components/student-page-intro';
import { useStudentRecordsQuery } from './student-records-query';

const years = [
  { level: 1, name: '1st Year', description: 'Freshman Requirements' },
  { level: 2, name: '2nd Year', description: 'Sophomore Requirements' },
  { level: 3, name: '3rd Year', description: 'Junior Requirements' },
  { level: 4, name: '4th Year', description: 'Senior Requirements' },
];

function getStudentYearLevel(studentId: string) {
  const now = new Date();
  const enrollmentYear = studentId ? Number.parseInt(studentId.slice(0, 4), 10) : now.getFullYear();
  const academicYearOffset = now.getMonth() >= 6 ? 1 : 0;

  if (Number.isNaN(enrollmentYear)) {
    return 1;
  }

  return Math.min(4, Math.max(1, now.getFullYear() - enrollmentYear + academicYearOffset));
}

export default function StudentYearSelection() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const studentYearLevel = me?.student?.year_level || getStudentYearLevel(studentId);
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
    return <PortalPageSkeleton variant="table" />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-8">
      <button
        type="button"
        onClick={() => navigate('/student')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <StudentPageIntro
        title="Select Year Level"
        description="Choose the academic year corresponding to the medical records you are preparing to submit. Your progress is automatically saved."
        className="max-w-3xl"
      />

      <div className="grid gap-3 sm:gap-6 sm:grid-cols-2">
        {years.map((year) => {
          const isFutureYearLocked = year.level > studentYearLevel;
          const latestYearStatus = latestByYear.get(year.level)?.status || '';
          const isApprovedLocked = latestYearStatus === 'approved';
          const isPendingLocked = latestYearStatus === 'pending' || latestYearStatus === 'in_review' || latestYearStatus === 'resubmitted';
          const isInReview = latestYearStatus === 'in_review';
          const isReturned = latestYearStatus === 'returned';
          const isLocked = isFutureYearLocked || isApprovedLocked || isPendingLocked;
          const isCurrent = year.level === studentYearLevel;

          return (
            <button
              key={year.level}
              type="button"
              disabled={isLocked}
              onClick={() => !isLocked && navigate(`/student/privacy-waiver/${year.level}`)}
              className={`group relative flex min-h-[130px] flex-col items-center justify-center overflow-hidden rounded-[1.25rem] p-5 text-center transition-all duration-300 sm:min-h-[220px] sm:p-8 lg:min-h-[240px] lg:p-10 ${
                isLocked
                  ? 'cursor-not-allowed bg-surface-container-high text-on-surface-variant/60'
                  : isCurrent
                    ? 'border-2 border-primary bg-primary-container text-on-primary-container shadow-[0_4px_6px_-2px_rgba(16,24,40,0.03)]'
                    : 'border border-outline-variant bg-surface-container-lowest text-on-surface shadow-[0_4px_6px_-2px_rgba(16,24,40,0.03)] hover:-translate-y-1 hover:shadow-lg'
              }`}
            >
              {isApprovedLocked ? (
                <span className="absolute left-0 top-0 rounded-br-xl bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                  Already Approved
                </span>
              ) : isPendingLocked ? (
                <span className={`absolute left-0 top-0 rounded-br-xl px-3 py-1 text-xs font-semibold text-white ${isInReview ? 'bg-sky-600' : 'bg-amber-600'}`}>
                  {isInReview ? 'In Review' : 'Pending Review'}
                </span>
              ) : isReturned ? (
                <span className="absolute left-0 top-0 rounded-br-xl bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                  Returned
                </span>
              ) : null}
              {isCurrent ? (
                <span className="absolute right-0 top-0 rounded-bl-xl bg-primary px-3 py-1 text-xs font-semibold text-white">
                  Current Year
                </span>
              ) : null}

              {isLocked ? (
                <span className={`absolute right-4 text-outline ${isCurrent ? 'top-10' : 'top-4'}`}>
                  <Lock className="h-4 w-4" />
                </span>
              ) : !isCurrent ? (
                <span className="absolute right-4 top-4 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  <ArrowRight className="h-4 w-4" />
                </span>
              ) : null}

              <GraduationCap
                className={`mb-2 h-7 w-7 transition-transform duration-300 group-hover:scale-110 sm:mb-4 sm:h-10 sm:w-10 ${
                  isLocked
                    ? 'text-outline'
                    : isCurrent
                      ? 'text-on-primary-container'
                      : 'text-on-surface-variant'
                }`}
              />
              <h3
                className={`text-xl font-semibold sm:text-2xl ${
                  isLocked
                    ? 'text-on-surface-variant'
                    : isCurrent
                      ? 'text-on-primary-container'
                      : 'text-on-surface'
                }`}
              >
                {year.name}
              </h3>
              <p
                className={`mt-1 text-xs sm:mt-2 sm:text-sm ${
                  isLocked
                    ? 'text-outline'
                    : isCurrent
                      ? 'text-on-primary-container/80'
                      : 'text-on-surface-variant'
                }`}
              >
                {isApprovedLocked
                  ? 'Already approved. Further submissions are locked.'
                  : isPendingLocked
                    ? 'Submission is under review. Please wait for clinic feedback.'
                    : isReturned
                      ? 'Returned by clinic staff. You may edit and resubmit.'
                      : year.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
