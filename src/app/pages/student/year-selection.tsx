import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, GraduationCap, Lock } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { getStudentRecords } from '../../lib/api';
import { PortalPageSkeleton } from '../../components/project-skeletons';

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
  const { data, isLoading } = useQuery({
    queryKey: ['studentRecords', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const response = await getStudentRecords(studentId);
      return Array.isArray(response?.records) ? response.records : [];
    },
    enabled: !!studentId,
  });
  const records = Array.isArray(data) ? data : [];
  const approvedYears = new Set(
    records
      .filter((record) => record?.status === 'approved')
      .map((record) => Number.parseInt(String(record?.year || ''), 10))
      .filter((year) => Number.isInteger(year) && year >= 1 && year <= 4),
  );

  if (isLoading && studentId) {
    return <PortalPageSkeleton variant="table" />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <button
        type="button"
        onClick={() => navigate('/student')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Select Year Level</h1>
        <p className="mt-2 text-base text-on-surface-variant">
          Choose the academic year corresponding to the medical records you are preparing to submit.
          Your progress is automatically saved.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {years.map((year) => {
          const isFutureYearLocked = year.level > studentYearLevel;
          const isApprovedLocked = approvedYears.has(year.level);
          const isLocked = isFutureYearLocked || isApprovedLocked;
          const isCurrent = year.level === studentYearLevel;

          return (
            <button
              key={year.level}
              type="button"
              disabled={isLocked}
              onClick={() => !isLocked && navigate(`/student/privacy-waiver/${year.level}`)}
              className={`group relative flex min-h-[240px] flex-col items-center justify-center overflow-hidden rounded-[1.25rem] p-10 text-center transition-all duration-300 ${
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
              ) : null}
              {isCurrent ? (
                <span className="absolute right-0 top-0 rounded-bl-xl bg-primary px-3 py-1 text-xs font-semibold text-on-primary">
                  Current Year
                </span>
              ) : null}

              {isLocked ? (
                <span className="absolute right-4 top-4 text-outline">
                  <Lock className="h-4 w-4" />
                </span>
              ) : !isCurrent ? (
                <span className="absolute right-4 top-4 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  <ArrowRight className="h-4 w-4" />
                </span>
              ) : null}

              <GraduationCap
                className={`mb-4 h-10 w-10 transition-transform duration-300 group-hover:scale-110 ${
                  isLocked
                    ? 'text-outline'
                    : isCurrent
                      ? 'text-on-primary-container'
                      : 'text-on-surface-variant'
                }`}
              />
              <h3
                className={`text-2xl font-semibold ${
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
                className={`mt-2 text-sm ${
                  isLocked
                    ? 'text-outline'
                    : isCurrent
                      ? 'text-on-primary-container/80'
                      : 'text-on-surface-variant'
                }`}
              >
                {isApprovedLocked ? 'Already approved. Further submissions are locked.' : year.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
