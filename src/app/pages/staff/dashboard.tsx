import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileWarning,
  ShieldCheck,
} from 'lucide-react';
import PortalPageIntro from '../../components/portal-page-intro';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { getRoleLabel } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { SubmissionSummaryRecord } from '../../lib/record-types';
import { loadStaffWorkspacePreferences } from './staff-workspace-preferences';
import { useStaffDashboardOverviewQuery } from './staff-workflow-query';

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

function getStatusLabel(status: SubmissionSummaryRecord['status']) {
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

function getStatusStyles(status: SubmissionSummaryRecord['status']) {
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

function getActiveReviewerMessage(
  submission: SubmissionSummaryRecord,
  currentStaffId?: string | null,
) {
  if (submission.status !== 'in_review' || !submission.reviewedByStaffId) {
    return null;
  }

  if (submission.reviewedByStaffId === String(currentStaffId || '').trim()) {
    return 'Assigned reviewer: You';
  }

  if (submission.reviewedByName) {
    return `Assigned reviewer: ${submission.reviewedByName}`;
  }

  return 'Assigned reviewer: Another clinic staff member';
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const staffRoleLabel = getRoleLabel(me?.profile?.role, me?.staff?.position);
  const staffPreferenceId = String(me?.staff?.id || me?.profile.email || '').trim();
  const workspacePreferences = useMemo(
    () => loadStaffWorkspacePreferences(staffPreferenceId, staffRoleLabel),
    [staffPreferenceId, staffRoleLabel],
  );
  const displayName =
    [me?.staff?.first_name || me?.profile.first_name || '', me?.staff?.last_name || me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    formatEmailName(me?.profile.email) ||
    staffRoleLabel;
  const currentStaffId = String(me?.staff?.id || '').trim();

  const [queueSortOrder, setQueueSortOrder] = useState<'desc' | 'asc'>(workspacePreferences.reviewSortOrder);
  const [queueTab, setQueueTab] = useState<'all' | 'pending' | 'in_review' | 'returned' | 'resubmitted'>(
    workspacePreferences.dashboardQueueTab,
  );
  const {
    data: overview,
    isLoading: overviewLoading,
    isFetching: overviewFetching,
    isError: isOverviewError,
  } = useStaffDashboardOverviewQuery();

  useEffect(() => {
    if (isOverviewError) {
      console.error('Error loading clinic dashboard');
    }
  }, [isOverviewError]);

  useEffect(() => {
    setQueueSortOrder(workspacePreferences.reviewSortOrder);
    setQueueTab(workspacePreferences.dashboardQueueTab);
  }, [workspacePreferences]);

  if (overviewLoading || !overview) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  const queueGroups = {
    pending: overview.pendingQueueItems || [],
    in_review: overview.inReviewQueueItems || [],
    returned: overview.returnedQueueItems || [],
    resubmitted: overview.resubmittedQueueItems || [],
  } as const;

  const actionQueue = [
    ...queueGroups.pending,
    ...queueGroups.in_review,
    ...queueGroups.returned,
    ...queueGroups.resubmitted,
  ];

  const sortedBySubmitted = [...actionQueue].sort((a, b) => {
    const timeA = new Date(a.submittedAt).getTime();
    const timeB = new Date(b.submittedAt).getTime();
    return queueSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });
  const pendingQueue = [...queueGroups.pending].sort((a, b) => {
    const timeA = new Date(a.submittedAt).getTime();
    const timeB = new Date(b.submittedAt).getTime();
    return queueSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });
  const inReviewQueue = [...queueGroups.in_review].sort((a, b) => {
    const timeA = new Date(a.submittedAt).getTime();
    const timeB = new Date(b.submittedAt).getTime();
    return queueSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });
  const returnedQueue = [...queueGroups.returned].sort((a, b) => {
    const timeA = new Date(a.submittedAt).getTime();
    const timeB = new Date(b.submittedAt).getTime();
    return queueSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });
  const resubmittedQueue = [...queueGroups.resubmitted].sort((a, b) => {
    const timeA = new Date(a.submittedAt).getTime();
    const timeB = new Date(b.submittedAt).getTime();
    return queueSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });
  const visibleQueue =
    queueTab === 'pending'
      ? pendingQueue
      : queueTab === 'in_review'
      ? inReviewQueue
      : queueTab === 'returned'
      ? returnedQueue
      : queueTab === 'resubmitted'
      ? resubmittedQueue
      : sortedBySubmitted;

  const summaryCards = [
    {
      label: 'Needs Action',
      value: overview.actionableRecords || 0,
      icon: ClipboardCheck,
      tone: 'text-primary',
      href: '/staff/submissions',
    },
    {
      label: 'In Review',
      value: overview.inReviewRecords || 0,
      icon: Clock3,
      tone: 'text-blue-600',
      href: '/staff/submissions?status=in_review',
    },
    {
      label: 'Returned',
      value: overview.returnedRecords || 0,
      icon: FileWarning,
      tone: 'text-rose-600',
      href: '/staff/submissions?status=returned',
    },
    {
      label: 'Cleared Records',
      value: overview.approvedRecords || 0,
      icon: ShieldCheck,
      tone: 'text-emerald-700',
      href: '/staff/records',
    },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-8">
      <PortalPageIntro
        eyebrow={(
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            Clinic Operations Portal
          </span>
        )}
        title={`Welcome, ${displayName}`}
        description="Review records by status below, then open the queue for full filtering."
        actions={
          !overviewLoading && overviewFetching ? (
            <span className="text-xs text-on-surface-variant">Refreshing queue...</span>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              type="button"
              key={card.label}
              onClick={() => navigate(card.href)}
              className="flex min-h-[8.5rem] w-full flex-col justify-between rounded-[1.35rem] border border-outline-variant/30 bg-surface-container-lowest p-3.5 text-left shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:rounded-2xl sm:p-5"
            >
              <div className="flex items-start justify-between gap-2 sm:gap-4">
                <div>
                  <p className="min-h-[2rem] text-[11px] font-semibold uppercase leading-4 tracking-[0.16em] text-on-surface-variant sm:min-h-0 sm:text-xs">
                    {card.label}
                  </p>
                  <p className="mt-2 text-[1.9rem] font-bold leading-none text-on-surface sm:mt-3 sm:text-3xl">
                    {card.value}
                  </p>
                </div>
                <div className={`rounded-[1rem] bg-surface-container p-2 sm:rounded-2xl sm:p-3 ${card.tone}`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1.25fr_0.95fr]">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Priority Review Queue</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                By default, this view starts with pending records so staff can take action quickly.
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
              {!overviewLoading && overviewFetching ? (
                <span className="text-xs text-on-surface-variant">Refreshing queue...</span>
              ) : null}
            </div>
          </div>
          <Tabs
            value={queueTab}
            onValueChange={(value) => setQueueTab(value as 'all' | 'pending' | 'in_review' | 'returned' | 'resubmitted')}
            className="mb-5"
          >
            <div className="pb-1">
              <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-2 rounded-2xl p-2 sm:max-w-xl sm:flex-nowrap sm:gap-0 sm:p-[3px]">
                <TabsTrigger value="all" className="min-h-9 flex-1 basis-[calc(50%-0.25rem)] px-3 text-xs sm:basis-0 sm:text-sm">
                  All ({overview.actionableRecords || 0})
                </TabsTrigger>
                <TabsTrigger value="pending" className="min-h-9 flex-1 basis-[calc(50%-0.25rem)] px-3 text-xs sm:basis-0 sm:text-sm">
                  Pending ({overview.pendingRecords || 0})
                </TabsTrigger>
                <TabsTrigger value="in_review" className="min-h-9 flex-1 basis-[calc(50%-0.25rem)] px-3 text-xs sm:basis-0 sm:text-sm">
                  In Review ({overview.inReviewRecords || 0})
                </TabsTrigger>
                <TabsTrigger value="returned" className="min-h-9 flex-1 basis-[calc(50%-0.25rem)] px-3 text-xs sm:basis-0 sm:text-sm">
                  Returned ({overview.returnedRecords || 0})
                </TabsTrigger>
                <TabsTrigger value="resubmitted" className="min-h-9 flex-1 basis-full px-3 text-xs sm:basis-0 sm:text-sm">
                  Resubmitted ({overview.resubmittedRecords || 0})
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
              {visibleQueue.slice(0, 4).map((submission) => (
                <button
                  key={submission.id}
                  onClick={() => navigate(`/staff/review/${submission.id}`)}
                  className="flex w-full flex-col gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 text-left transition-colors hover:bg-surface-container-low sm:flex-row sm:items-start sm:gap-4"
                >
                    <div className="flex items-start gap-4 sm:flex-1">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary sm:h-12 sm:w-12">
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
                      <p className="mt-1 break-words text-xs text-on-surface-variant">
                        {submission.studentId} | {submission.course}
                      </p>
                      {getActiveReviewerMessage(submission, currentStaffId) ? (
                        <p className="mt-2 text-xs font-medium text-sky-700">
                          {getActiveReviewerMessage(submission, currentStaffId)}
                        </p>
                      ) : null}
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
            <h2 className="text-lg font-semibold text-on-surface">Today&apos;s Focus</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Suggested order to reduce missed steps and backlogs.
            </p>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-amber-200/60 bg-amber-50/70 p-4">
              <p className="text-sm font-semibold text-amber-900">1. Review pending first</p>
              <p className="mt-1 text-sm text-amber-800">{pendingQueue.length} records are waiting for first review.</p>
            </div>
            <div className="rounded-2xl border border-orange-200/60 bg-orange-50/70 p-4">
              <p className="text-sm font-semibold text-orange-900">2. Follow up returned and resubmitted</p>
              <p className="mt-1 text-sm text-orange-800">
                {(overview.returnedRecords || 0) + (overview.resubmittedRecords || 0)} records need correction checks.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200/60 bg-sky-50/70 p-4">
              <p className="text-sm font-semibold text-sky-900">3. Continue active reviews</p>
              <p className="mt-1 text-sm text-sky-800">{overview.inReviewRecords || 0} records are currently in progress.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/staff/reports')}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
            >
              Open full reports
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
