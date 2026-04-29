import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertCircle, CheckCircle2, Clock3, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getStudentRecords } from '../../lib/api';
import { useAuth } from '../../lib/auth';

type StudentRecord = {
  id: string;
  year?: string;
  status?: string;
  submittedAt?: string;
  updatedAt?: string;
};

const yearLabels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const displayName = [
    me?.student?.first_name || me?.profile.first_name || '',
    me?.student?.last_name || me?.profile.last_name || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Student';
  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const course = me?.student?.course || me?.profile.course || '';
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
    }
    if (studentId) {
      loadRecords();
    }
  }, [studentId]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await getStudentRecords();
      setRecords((data.records || []) as StudentRecord[]);
    } catch (error) {
      console.error('Error loading records:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to load records';
      if (message.toLowerCase().includes('profile not found')) {
        toast.error('Your account is not fully set up yet. Please sign out and sign in again.');
        return;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'pending':
        return 'Pending Review';
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

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const sortedRecords = [...records].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.submittedAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.submittedAt || 0).getTime();
    return bTime - aTime;
  });

  const latestRecord = sortedRecords[0];
  const yearlyRecords = yearLabels.map((label, index) => {
    const year = index + 1;
    const record = sortedRecords.find((item) => Number.parseInt(item.year || '', 10) === year);
    return { label, record };
  });
  const approvedCount = sortedRecords.filter((record) => record.status === 'approved').length;
  const pendingCount = sortedRecords.filter((record) => record.status === 'pending').length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-on-surface">Welcome, {displayName}</h2>
              <p className="mt-1 text-base text-on-surface-variant">
                Here is your current medical clearance status.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-on-surface-variant">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                Approved Records
              </p>
              <div className="mt-2 flex items-center gap-2 text-on-surface">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{approvedCount}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 shadow-sm">
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

      <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
        <div className="border-b border-outline-variant/30 bg-surface-container-lowest px-6 py-4">
          <h3 className="text-lg font-semibold text-on-surface">Yearly Status Overview</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low text-xs uppercase tracking-[0.16em] text-on-surface-variant">
                <th className="px-6 py-3 font-semibold">Year Level</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Last Action Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {yearlyRecords.map(({ label, record }) => (
                <tr key={label} className="transition-colors hover:bg-surface-container-lowest">
                  <td className={`px-6 py-4 text-sm ${record ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>
                    {label}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyles(record?.status)}`}
                    >
                      {getStatusBadge(record?.status)}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-4 text-sm ${
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

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-on-surface">Submission Status</h3>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">Loading status...</div>
          ) : records.length === 0 ? (
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
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-on-surface-variant">Latest submission</p>
                    <p className="text-lg font-semibold text-on-surface">
                      Year {latestRecord?.year || '--'} Medical Record
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyles(latestRecord?.status)}`}
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
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-container"
                onClick={() => navigate('/student/year-selection')}
              >
                <Plus className="h-4 w-4" />
                Submit Another Record
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-on-surface">Recent Medical Record History</h3>
            <button
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
              onClick={() => navigate('/student/records')}
            >
              View All
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">Loading records...</div>
          ) : records.length === 0 ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">No medical records found.</div>
          ) : (
            <div className="space-y-3">
              {sortedRecords.slice(0, 3).map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container-low"
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
                    className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${getStatusStyles(record.status)}`}
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
