import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Activity,
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileWarning,
  FolderOpen,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { getAnalytics, getSubmissions } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { MockSubmission } from '../../lib/mock-data';

type AnalyticsSummary = {
  totalStudents: number;
  totalSubmissions: number;
  pendingRecords: number;
  approvedRecords: number;
  returnedRecords: number;
};

const yearLabels: Record<string, string> = {
  '1': '1st Year',
  '2': '2nd Year',
  '3': '3rd Year',
  '4': '4th Year',
};

function formatEmailName(email?: string | null) {
  if (!email) return '';

  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value?: string) {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}

function getStatusLabel(status: MockSubmission['status']) {
  switch (status) {
    case 'pending':
      return 'Pending review';
    case 'physical_exam_done':
      return 'Physical exam done';
    case 'approved':
      return 'Approved';
    case 'returned':
      return 'Returned';
    default:
      return status;
  }
}

function getStatusStyles(status: MockSubmission['status']) {
  switch (status) {
    case 'approved':
      return 'bg-primary-container/20 text-on-primary-container';
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'physical_exam_done':
      return 'bg-blue-100 text-blue-800';
    case 'returned':
      return 'bg-error-container/70 text-on-error-container';
    default:
      return 'bg-surface-variant text-on-surface-variant';
  }
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [submissions, setSubmissions] = useState<MockSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName =
    [me?.staff?.first_name || me?.profile.first_name || '', me?.staff?.last_name || me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    formatEmailName(me?.profile.email) ||
    'Clinic Nurse / Doctor';
  const position = me?.staff?.position || 'Clinic Nurse / Doctor';

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [analyticsData, submissionsData] = await Promise.all([getAnalytics(), getSubmissions()]);
        setAnalytics(analyticsData as AnalyticsSummary);
        setSubmissions((submissionsData.submissions || []) as MockSubmission[]);
      } catch (error) {
        console.error('Error loading clinic dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-on-surface-variant">Loading clinic dashboard...</div>
      </div>
    );
  }

  const sortedBySubmitted = [...submissions].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
  const actionQueue = sortedBySubmitted.filter(
    (submission) => submission.status === 'pending' || submission.status === 'returned',
  );
  const recentApprovals = [...submissions]
    .filter((submission) => submission.status === 'approved')
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.submittedAt).getTime();
      const bTime = new Date(b.updatedAt || b.submittedAt).getTime();
      return bTime - aTime;
    });
  const statusByYear = ['1', '2', '3', '4'].map((year) => {
    const yearlySubmissions = submissions.filter((submission) => String(submission.year) === year);
    return {
      year,
      label: yearLabels[year],
      pending: yearlySubmissions.filter((submission) => submission.status === 'pending').length,
      approved: yearlySubmissions.filter((submission) => submission.status === 'approved').length,
      returned: yearlySubmissions.filter((submission) => submission.status === 'returned').length,
    };
  });
  const courseLoad = Object.entries(
    submissions.reduce<Record<string, number>>((acc, submission) => {
      const course = submission.course || 'Unassigned Course';
      acc[course] = (acc[course] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([course, count]) => ({ course, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const summaryCards = [
    {
      label: 'Students Monitored',
      value: analytics?.totalStudents || 0,
      icon: Users,
      tone: 'text-primary',
      detail: 'Unique students with clinic records',
    },
    {
      label: 'Awaiting Review',
      value: analytics?.pendingRecords || 0,
      icon: Clock3,
      tone: 'text-amber-600',
      detail: 'Submissions ready for nurse or doctor action',
    },
    {
      label: 'Cleared Records',
      value: analytics?.approvedRecords || 0,
      icon: ShieldCheck,
      tone: 'text-emerald-700',
      detail: 'Approved medical clearances released',
    },
    {
      label: 'Returned Cases',
      value: analytics?.returnedRecords || 0,
      icon: FileWarning,
      tone: 'text-rose-700',
      detail: 'Records waiting for student revision',
    },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-container/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-on-primary-container">
              <Stethoscope className="h-4 w-4" />
              Clinic Nurse / Doctor Portal
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-on-surface">Welcome, {displayName}</h1>
              <p className="mt-2 max-w-2xl text-base text-on-surface-variant">
                Review student submissions, release clearances, and keep the clinic workflow moving with the same streamlined experience students use.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-on-surface-variant">
              <span className="rounded-full bg-surface-container px-3 py-1.5">
                Role: <span className="font-semibold text-on-surface">{position}</span>
              </span>
              <span className="rounded-full bg-surface-container px-3 py-1.5">
                Total submissions: <span className="font-semibold text-on-surface">{analytics?.totalSubmissions || 0}</span>
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => navigate('/staff/submissions')}
              className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 text-left shadow-sm transition-colors hover:bg-surface-container"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                Review Queue
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-on-surface">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{actionQueue.length}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-on-surface-variant" />
              </div>
            </button>
            <button
              onClick={() => navigate('/staff/certificates')}
              className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 text-left shadow-sm transition-colors hover:bg-surface-container"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                Ready Certificates
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-on-surface">
                  <Award className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{recentApprovals.length}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-on-surface-variant" />
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                    {card.label}
                  </p>
                  <p className="mt-3 text-3xl font-bold text-on-surface">{card.value}</p>
                </div>
                <div className={`rounded-2xl bg-surface-container p-3 ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-sm text-on-surface-variant">{card.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Priority Review Queue</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Start with the most recent records that still need clinic action.
              </p>
            </div>
            <button
              onClick={() => navigate('/staff/submissions')}
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Open Queue
            </button>
          </div>

          {actionQueue.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low px-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="mt-4 text-lg font-semibold text-on-surface">All caught up</p>
              <p className="mt-2 max-w-sm text-sm text-on-surface-variant">
                There are no pending or returned student records right now.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {actionQueue.slice(0, 5).map((submission) => (
                <button
                  key={submission.id}
                  onClick={() => navigate(`/staff/review/${submission.id}`)}
                  className="flex w-full items-start gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 text-left transition-colors hover:bg-surface-container-low"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-on-surface">
                        {submission.firstName} {submission.lastName}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getStatusStyles(submission.status)}`}
                      >
                        {getStatusLabel(submission.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {submission.studentId} | {submission.course} | {yearLabels[String(submission.year)] || `Year ${submission.year}`}
                    </p>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      Submitted {formatDate(submission.submittedAt)}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-on-surface-variant" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-on-surface">Year-Level Status Overview</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Track where approvals and follow-ups are concentrated.
            </p>
          </div>
          <div className="space-y-3">
            {statusByYear.map((row) => (
              <div key={row.year} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-on-surface">{row.label}</p>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span>{row.pending} pending</span>
                    <span>|</span>
                    <span>{row.approved} approved</span>
                    <span>|</span>
                    <span>{row.returned} returned</span>
                  </div>
                </div>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-variant/50">
                  {row.pending + row.approved + row.returned > 0 ? (
                    <>
                      <div
                        className="bg-amber-400"
                        style={{
                          width: `${(row.pending / (row.pending + row.approved + row.returned)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-emerald-500"
                        style={{
                          width: `${(row.approved / (row.pending + row.approved + row.returned)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-rose-400"
                        style={{
                          width: `${(row.returned / (row.pending + row.approved + row.returned)) * 100}%`,
                        }}
                      />
                    </>
                  ) : (
                    <div className="w-full bg-surface-variant/50" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Recent Clearances</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Recently approved submissions ready for records and certificate release.
              </p>
            </div>
            <button
              onClick={() => navigate('/staff/records')}
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              View Records
            </button>
          </div>

          {recentApprovals.length === 0 ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">
              No approved records yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentApprovals.slice(0, 4).map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container-low"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {submission.firstName} {submission.lastName}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Released {formatDate(submission.updatedAt || submission.submittedAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary-container/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-primary-container">
                    Approved
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Course Load Snapshot</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                The busiest programs by clinic submission volume.
              </p>
            </div>
            <button
              onClick={() => navigate('/staff/reports')}
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Open Reports
            </button>
          </div>

          {courseLoad.length === 0 ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">
              No submission data available yet.
            </div>
          ) : (
            <div className="space-y-4">
              {courseLoad.map((course) => {
                const total = submissions.length || 1;
                const width = Math.max((course.count / total) * 100, 8);

                return (
                  <div key={course.course} className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <p className="font-medium text-on-surface">{course.course}</p>
                      <p className="text-on-surface-variant">{course.count}</p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => navigate('/staff/submissions')}
              className="flex items-center justify-between rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-4 text-left transition-colors hover:bg-surface-container"
            >
              <div>
                <p className="text-sm font-semibold text-on-surface">Open Review Queue</p>
                <p className="mt-1 text-xs text-on-surface-variant">Process pending cases</p>
              </div>
              <Activity className="h-5 w-5 text-primary" />
            </button>
            <button
              onClick={() => navigate('/staff/certificates')}
              className="flex items-center justify-between rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-4 text-left transition-colors hover:bg-surface-container"
            >
              <div>
                <p className="text-sm font-semibold text-on-surface">Release Certificates</p>
                <p className="mt-1 text-xs text-on-surface-variant">Generate clearance copies</p>
              </div>
              <FolderOpen className="h-5 w-5 text-primary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
