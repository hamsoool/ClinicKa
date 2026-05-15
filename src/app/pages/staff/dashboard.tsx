import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Activity,
  ArrowRight,
  ArrowUpDown,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileWarning,
  FolderOpen,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { getRoleLabel } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { MockSubmission } from '../../lib/mock-data';
import { useStaffAnalyticsQuery, useStaffSubmissionsQuery } from './staff-workflow-query';

type AnalyticsSummary = {
  totalStudents: number;
  totalSubmissions: number;
  pendingRecords: number;
  approvedRecords: number;
  returnedRecords: number;
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
    case 'in_review':
      return 'In review';
    case 'physical_exam_done':
      return 'Physical exam done';
    case 'approved':
      return 'Approved';
    case 'returned':
      return 'Returned';
    case 'resubmitted':
      return 'Resubmitted';
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
    case 'in_review':
      return 'bg-sky-100 text-sky-800';
    case 'physical_exam_done':
      return 'bg-blue-100 text-blue-800';
    case 'returned':
      return 'bg-error-container/70 text-on-error-container';
    case 'resubmitted':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-surface-variant text-on-surface-variant';
  }
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const displayName =
    [me?.staff?.first_name || me?.profile.first_name || '', me?.staff?.last_name || me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    formatEmailName(me?.profile.email) ||
    getRoleLabel(me?.profile?.role, me?.staff?.position);
  const position = getRoleLabel(me?.profile?.role, me?.staff?.position);

  const [queueSortOrder, setQueueSortOrder] = useState<'desc' | 'asc'>('desc');
  const [queueTab, setQueueTab] = useState<'all' | 'pending' | 'in_review' | 'returned' | 'resubmitted'>('all');
  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: isAnalyticsError,
  } = useStaffAnalyticsQuery();
  const {
    data: submissionsData = [],
    isLoading: submissionsLoading,
    isError: isSubmissionsError,
  } = useStaffSubmissionsQuery();
  const submissions = submissionsData as MockSubmission[];

  useEffect(() => {
    if (isAnalyticsError || isSubmissionsError) {
      console.error('Error loading clinic dashboard');
    }
  }, [isAnalyticsError, isSubmissionsError]);

  if (analyticsLoading || submissionsLoading) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  const sortedBySubmitted = [...submissions].sort((a, b) => {
    const timeA = new Date(a.submittedAt).getTime();
    const timeB = new Date(b.submittedAt).getTime();
    return queueSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });
  const actionQueue = sortedBySubmitted.filter(
    (submission) =>
      submission.status === 'pending' || submission.status === 'in_review' || submission.status === 'returned' || submission.status === 'resubmitted',
  );
  const pendingQueue = actionQueue.filter((submission) => submission.status === 'pending');
  const inReviewQueue = actionQueue.filter((submission) => submission.status === 'in_review');
  const returnedQueue = actionQueue.filter((submission) => submission.status === 'returned');
  const resubmittedQueue = actionQueue.filter((submission) => submission.status === 'resubmitted');
  const visibleQueue =
    queueTab === 'pending'
      ? pendingQueue
      : queueTab === 'in_review'
      ? inReviewQueue
      : queueTab === 'returned'
      ? returnedQueue
      : queueTab === 'resubmitted'
      ? resubmittedQueue
      : actionQueue;
  const recentApprovals = [...submissions]
    .filter((submission) => submission.status === 'approved')
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.submittedAt).getTime();
      const bTime = new Date(b.updatedAt || b.submittedAt).getTime();
      return bTime - aTime;
    });

  const departments = Array.from(new Set(submissions.map((s) => s.department || 'Other'))).sort();
  const statusByDepartment = departments.map((dept) => {
    const deptSubmissions = submissions.filter((submission) => (submission.department || 'Other') === dept);
    return {
      department: dept,
      label: dept,
      pending: deptSubmissions.filter((submission) => submission.status === 'pending').length,
      inReview: deptSubmissions.filter((submission) => submission.status === 'in_review').length,
      approved: deptSubmissions.filter((submission) => submission.status === 'approved').length,
      returned: deptSubmissions.filter((submission) => submission.status === 'returned').length,
      resubmitted: deptSubmissions.filter((submission) => submission.status === 'resubmitted').length,
    };
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const submittedToday = submissions.filter((s) => {
    const d = new Date(s.submittedAt);
    return d >= today;
  }).length;

  const submittedYesterday = submissions.filter((s) => {
    const d = new Date(s.submittedAt);
    return d >= yesterday && d < today;
  }).length;

  const getQueueNumber = (submission: MockSubmission, allSubmissions: MockSubmission[]) => {
    const submitDate = new Date(submission.submittedAt).toDateString();
    const sameDaySubmissions = allSubmissions.filter(s => new Date(s.submittedAt).toDateString() === submitDate);
    sameDaySubmissions.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    const index = sameDaySubmissions.findIndex(s => s.id === submission.id);
    return index + 1;
  };

  const summaryCards = [
    {
      label: 'Submitted Today',
      value: submittedToday,
      icon: Activity,
      tone: 'text-primary',
      detail: 'Student submissions received today',
    },
    {
      label: 'Submitted Yesterday',
      value: submittedYesterday,
      icon: Clock3,
      tone: 'text-blue-600',
      detail: 'Student submissions received yesterday',
    },
    {
      label: 'Awaiting Review',
      value: analytics?.pendingRecords || 0,
      icon: FileWarning,
      tone: 'text-amber-600',
      detail: 'Total registered students awaiting review',
    },
    {
      label: 'Cleared Records',
      value: analytics?.approvedRecords || 0,
      icon: ShieldCheck,
      tone: 'text-emerald-700',
      detail: 'Total students successfully cleared',
    },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-container/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-on-primary-container">
              <Stethoscope className="h-4 w-4" />
              Clinic Operations Portal
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
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Priority Review Queue</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Start with the most recent records that still need clinic action.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                onClick={() => setQueueSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="flex w-full items-center justify-center gap-1.5 rounded-full border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface sm:w-auto"
              >
                <ArrowUpDown className="h-3 w-3" />
                {queueSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </button>
              <button
                onClick={() => navigate('/staff/submissions')}
                className="w-full rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary/80 sm:w-auto sm:border-none sm:bg-transparent sm:px-0 sm:py-0"
              >
                Open Queue
              </button>
            </div>
          </div>
          <Tabs
            value={queueTab}
            onValueChange={(value) => setQueueTab(value as 'all' | 'pending' | 'in_review' | 'returned' | 'resubmitted')}
            className="mb-5"
          >
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <TabsList className="h-auto min-h-10 w-max min-w-full flex-wrap justify-start gap-2 rounded-2xl p-2 sm:max-w-xl sm:flex-nowrap sm:gap-0 sm:p-[3px]">
                <TabsTrigger value="all" className="min-h-9 flex-none px-3 text-xs sm:flex-1 sm:text-sm">
                  All ({actionQueue.length})
                </TabsTrigger>
                <TabsTrigger value="pending" className="min-h-9 flex-none px-3 text-xs sm:flex-1 sm:text-sm">
                  Pending ({pendingQueue.length})
                </TabsTrigger>
                <TabsTrigger value="in_review" className="min-h-9 flex-none px-3 text-xs sm:flex-1 sm:text-sm">
                  In Review ({inReviewQueue.length})
                </TabsTrigger>
                <TabsTrigger value="returned" className="min-h-9 flex-none px-3 text-xs sm:flex-1 sm:text-sm">
                  Returned ({returnedQueue.length})
                </TabsTrigger>
                <TabsTrigger value="resubmitted" className="min-h-9 flex-none px-3 text-xs sm:flex-1 sm:text-sm">
                  Resubmitted ({resubmittedQueue.length})
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>

          {visibleQueue.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low px-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="mt-4 text-lg font-semibold text-on-surface">All caught up</p>
              <p className="mt-2 max-w-sm text-sm text-on-surface-variant">
                {queueTab === 'all'
                  ? 'There are no pending, in-review, returned, or resubmitted student records right now.'
                  : `There are no ${queueTab} records right now.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleQueue.slice(0, 5).map((submission) => (
                <button
                  key={submission.id}
                  onClick={() => navigate(`/staff/review/${submission.id}`)}
                  className="flex w-full flex-col gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 text-left transition-colors hover:bg-surface-container-low sm:flex-row sm:items-start"
                >
                  <div className="flex items-start gap-4 sm:flex-1">
                    <div className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-surface-container text-primary">
                      <span className="text-[9px] font-bold leading-none uppercase tracking-widest text-on-surface-variant">Queue</span>
                      <span className="mt-1 text-lg font-black leading-none">#{getQueueNumber(submission, submissions)}</span>
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
                      <p className="mt-1 break-words text-xs text-on-surface-variant">
                        {submission.studentId} | {submission.course}
                      </p>
                      <p className="mt-2 text-sm text-on-surface-variant">
                        Submitted {formatDate(submission.submittedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-end sm:w-auto">
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-on-surface-variant" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-on-surface">Department Status Overview</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Track where approvals and follow-ups are concentrated.
            </p>
          </div>
          <div className="space-y-3">
            {statusByDepartment.map((row) => (
              <div key={row.department} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-on-surface">{row.label}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-on-surface-variant">
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">{row.pending} pending</span>
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800">{row.inReview} in review</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">{row.approved} approved</span>
                    <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">{row.returned} returned</span>
                    <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-800">{row.resubmitted} resubmitted</span>
                  </div>
                </div>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-variant/50">
                  {row.pending + row.inReview + row.approved + row.returned + row.resubmitted > 0 ? (
                    <>
                      <div
                        className="bg-amber-400"
                        style={{
                          width: `${(row.pending / (row.pending + row.inReview + row.approved + row.returned + row.resubmitted)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-sky-400"
                        style={{
                          width: `${(row.inReview / (row.pending + row.inReview + row.approved + row.returned + row.resubmitted)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-emerald-500"
                        style={{
                          width: `${(row.approved / (row.pending + row.inReview + row.approved + row.returned + row.resubmitted)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-rose-400"
                        style={{
                          width: `${(row.returned / (row.pending + row.inReview + row.approved + row.returned + row.resubmitted)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-orange-400"
                        style={{
                          width: `${(row.resubmitted / (row.pending + row.inReview + row.approved + row.returned + row.resubmitted)) * 100}%`,
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
    </div>
  );
}
