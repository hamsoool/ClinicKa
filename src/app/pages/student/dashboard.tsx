import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FileText, Plus } from 'lucide-react';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import { toast } from 'sonner';
import { getStudentRecords } from '../../lib/api';
import { useAuth } from '../../lib/auth';

type StudentRecord = {
  id: string;
  year?: string;
  status?: string;
  submittedAt?: string;
  updatedAt?: string;
  staffNotes?: string;
};

const yearLabels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const dashboardDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const { displayName, studentId, course } = useMemo(() => {
    const name = [
      me?.student?.first_name || me?.profile.first_name || '',
      me?.student?.last_name || me?.profile.last_name || '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    return {
      displayName: name || 'Student',
      studentId: me?.student?.student_id || me?.profile.student_id || '',
      course: me?.student?.course || me?.profile.course || '',
    };
  }, [me]);
  const { data, isLoading: loading, isError, error } = useQuery({
    queryKey: ['studentRecords', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const response = await getStudentRecords(studentId);
      return (Array.isArray(response?.records) ? response.records : []) as StudentRecord[];
    },
    enabled: !!studentId,
  });

  const records = Array.isArray(data) ? data : [];

  useEffect(() => {
    if (isError && error) {
      const message = error instanceof Error ? error.message : 'Failed to load records';
      if (message.toLowerCase().includes('profile not found')) {
        toast.error('Your account is not fully set up yet. Please sign out and sign in again.');
      } else {
        toast.error(message);
      }
    }
  }, [isError, error]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'pending':
        return 'Pending Review';
      case 'resubmitted':
        return 'Resubmitted';
      case 'approved':
        return 'Approved';
      case 'returned':
        return 'Returned';
      default:
        return 'Not Started';
    }
  };

  const getStatusStyles = (status?: string) => {
    switch (status) {
      case 'approved':
        return 'bg-primary-container/20 text-on-primary-container';
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'resubmitted':
        return 'bg-orange-100 text-orange-800';
      case 'returned':
        return 'bg-error-container/70 text-on-error-container';
      default:
        return 'bg-surface-variant text-on-surface-variant';
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return dashboardDateFormatter.format(date);
  };
  const { sortedRecords, latestRecord, yearlyRecords, approvedCount, pendingCount } = useMemo(() => {
    const sorted = [...records].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.submittedAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.submittedAt || 0).getTime();
      return bTime - aTime;
    });
    const latest = sorted[0];
    const yearly = yearLabels.map((label, index) => {
      const year = index + 1;
      const record = sorted.find((item) => Number.parseInt(item.year || '', 10) === year);
      return { label, record };
    });
    const approved = sorted.filter((record) => record.status === 'approved').length;
    const pending = sorted.filter(
      (record) => record.status === 'pending' || record.status === 'resubmitted',
    ).length;
    return {
      sortedRecords: sorted,
      latestRecord: latest,
      yearlyRecords: yearly,
      approvedCount: approved,
      pendingCount: pending,
    };
  }, [records]);

  if (loading && records.length === 0) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  return (
    <div className="-mx-4 w-[calc(100%+2rem)] space-y-1 min-[340px]:-mx-5 min-[340px]:w-[calc(100%+2.5rem)] sm:mx-auto sm:w-full sm:max-w-6xl sm:space-y-8">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-3 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div>
              <h2 className="text-[1.75rem] font-bold tracking-tight text-on-surface sm:text-3xl max-[382px]:text-[1.5rem]">Welcome, {displayName}</h2>
              <p className="mt-1 text-sm text-on-surface-variant sm:text-base">
                Here is your current medical clearance status.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-on-surface-variant sm:gap-3 sm:text-sm">
              {studentId ? (
                <span className="rounded-full bg-surface-container px-3 py-1.5">
                  Student ID: <span className="font-semibold text-on-surface">{studentId}</span>
                </span>
              ) : null}
              {course ? (
                <span className="rounded-full bg-surface-container px-3 py-1.5">
                  Course: <span className="font-semibold text-on-surface">{course}</span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                Approved Records
              </p>
              <div className="mt-2 flex items-center gap-2 text-on-surface">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{approvedCount}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                Under Review
              </p>
              <div className="mt-2 flex items-center gap-2 text-on-surface">
                <Clock3 className="h-5 w-5 text-amber-600" />
                <span className="text-2xl font-bold">{pendingCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {latestRecord?.status === 'returned' && (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-base font-bold tracking-tight text-amber-900 sm:text-lg">Action Required: Correction Needed</h3>
                <p className="mt-1 text-xs text-on-surface-variant sm:text-sm">
                  Your medical record submission for <span className="font-semibold">{yearLabels[Number(latestRecord.year) - 1] || 'current year'}</span> has been returned by the clinic staff.
                </p>
              </div>
              
              {latestRecord.staffNotes && (
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900">Note from Clinic Staff:</p>
                  <p className="text-sm italic leading-relaxed text-amber-800">"{latestRecord.staffNotes}"</p>
                </div>
              )}
              
              <div className="flex pt-1">
                <button
                  onClick={() =>
                    navigate(
                      `/student/privacy-waiver/${latestRecord?.year || '1'}?edit=${encodeURIComponent(
                        latestRecord?.id || '',
                      )}`,
                    )
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 sm:w-auto"
                >
                  Update and Resubmit
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
        <div className="border-b border-outline-variant/30 bg-surface-container-lowest px-4 py-4 sm:px-6">
          <h3 className="text-lg font-semibold text-on-surface">Yearly Status Overview</h3>
        </div>
        <div className="sm:hidden">
          {yearlyRecords.map(({ label, record }) => (
            <div
              key={`mobile-${label}`}
              className="border-b border-outline-variant/20 px-4 py-3 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-medium ${record ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>{label}</p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${getStatusStyles(record?.status)}`}
                >
                  {getStatusBadge(record?.status)}
                </span>
              </div>
              <p className={`mt-1 text-xs ${record ? 'text-on-surface-variant' : 'text-on-surface-variant/60'}`}>
                Last action: {formatDate(record?.updatedAt || record?.submittedAt)}
              </p>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low text-xs uppercase tracking-[0.16em] text-on-surface-variant">
                <th className="px-4 py-3 font-semibold sm:px-6">Year Level</th>
                <th className="px-4 py-3 font-semibold sm:px-6">Status</th>
                <th className="px-4 py-3 font-semibold sm:px-6">Last Action Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {yearlyRecords.map(({ label, record }) => (
                <tr key={label} className="transition-colors hover:bg-surface-container-lowest">
                  <td className={`px-4 py-4 text-sm sm:px-6 ${record ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>
                    {label}
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold sm:px-2.5 sm:text-xs ${getStatusStyles(record?.status)}`}
                    >
                      {getStatusBadge(record?.status)}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-4 text-sm sm:px-6 ${
                      record ? 'text-on-surface-variant' : 'text-on-surface-variant/60'
                    }`}
                  >
                    {formatDate(record?.updatedAt || record?.submittedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-2 sm:gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-on-surface">Submission Status</h3>
          </div>

          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-outline">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h4 className="text-lg font-semibold text-on-surface">No Active Submissions</h4>
              <p className="mt-2 max-w-[260px] text-sm text-on-surface-variant">
                You do not have any medical documents currently under review.
              </p>
              <button
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary/90"
                onClick={() => navigate('/student/year-selection')}
              >
                <Plus className="h-4 w-4" />
                Submit Document
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-on-surface-variant">Latest submission</p>
                    <p className="text-base font-semibold text-on-surface sm:text-lg">
                      Year {latestRecord?.year || '--'} Medical Record
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyles(latestRecord?.status)}`}
                  >
                    {getStatusBadge(latestRecord?.status)}
                  </span>
                </div>
                <div className="mt-4 space-y-1 text-sm text-on-surface-variant">
                  <p>Submitted on {formatDate(latestRecord?.submittedAt)}</p>
                  {latestRecord?.updatedAt && latestRecord?.status !== 'pending' ? (
                    <p>
                      Last updated on <span className="font-medium text-on-surface">{formatDate(latestRecord.updatedAt)}</span>
                    </p>
                  ) : null}
                </div>
              </div>

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-container sm:w-auto"
                onClick={() => navigate('/student/year-selection')}
              >
                <Plus className="h-4 w-4" />
                Submit Another Record
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-on-surface">Recent Medical Record History</h3>
            <button
              className="shrink-0 text-xs font-semibold text-primary transition-colors hover:text-primary/80 sm:text-sm"
              onClick={() => navigate('/student/records')}
            >
              View All
            </button>
          </div>

          {records.length === 0 ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">No medical records found.</div>
          ) : (
            <div className="space-y-3">
              {sortedRecords.slice(0, 3).map((record) => (
                <div
                  key={record.id}
                  className="flex items-start gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container-low sm:items-center sm:gap-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      Year {record.year || '--'} Medical Record
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Submitted: {formatDate(record.submittedAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:tracking-[0.2em] ${getStatusStyles(record.status)}`}
                  >
                    {getStatusBadge(record.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
