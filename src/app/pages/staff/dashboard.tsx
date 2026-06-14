import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
} from 'lucide-react';
import PortalPageIntro from '../../components/portal-page-intro';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import ListPagination from '../../components/list-pagination';
import SubmissionDashboardCards from '../../components/submission-dashboard-cards';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { getActiveAjaxRefetchInterval } from '../../lib/ajax-refresh';
import { getRoleLabel, getSubmissionReportSummaries } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { StudentAccountSummary, SubmissionRecord, SubmissionSummaryRecord } from '../../lib/record-types';
import { getYearLevelLabel } from '../../lib/student-year';
import { loadStaffWorkspacePreferences } from './staff-workspace-preferences';
import { useStaffDashboardOverviewQuery } from './staff-workflow-query';

const DASHBOARD_QUEUE_PAGE_SIZE = 20;
const DASHBOARD_CHART_REFRESH_INTERVAL_MS = 60_000;

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

function formatSubmittedYearLevel(value?: string) {
  const normalizedValue = String(value || '').trim();
  return normalizedValue ? getYearLevelLabel(normalizedValue) : 'Year Level --';
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

  const [queueSortOrder, setQueueSortOrder] = useState<'desc' | 'asc'>(workspacePreferences.reviewSortOrder);
  const [queueTab, setQueueTab] = useState<'all' | 'pending' | 'returned' | 'resubmitted'>(
    workspacePreferences.dashboardQueueTab === 'in_review' ? 'pending' : workspacePreferences.dashboardQueueTab,
  );
  const [queuePage, setQueuePage] = useState(1);
  const {
    data: overview,
    isLoading: overviewLoading,
    isFetching: overviewFetching,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useStaffDashboardOverviewQuery();
  const {
    data: reportData = { submissions: [] as SubmissionRecord[], registeredStudents: [] as StudentAccountSummary[] },
    isError: reportSubmissionsError,
    isLoading: reportSubmissionsLoading,
  } = useQuery({
    queryKey: ['staffDashboardSubmissionCharts'],
    queryFn: async () => {
      const response = await getSubmissionReportSummaries();
      return {
        submissions: Array.isArray(response?.submissions) ? response.submissions : [],
        registeredStudents: Array.isArray(response?.registeredStudents) ? response.registeredStudents : [],
      };
    },
    staleTime: 45_000,
    gcTime: 8 * 60_000,
    refetchInterval: () => getActiveAjaxRefetchInterval(DASHBOARD_CHART_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (isOverviewError) {
      console.error('Error loading clinic dashboard');
    }
  }, [isOverviewError]);

  useEffect(() => {
    setQueueSortOrder(workspacePreferences.reviewSortOrder);
    setQueueTab(workspacePreferences.dashboardQueueTab === 'in_review' ? 'pending' : workspacePreferences.dashboardQueueTab);
  }, [workspacePreferences]);

  useEffect(() => {
    setQueuePage(1);
  }, [queueSortOrder, queueTab]);

  const queueGroups = {
    pending: overview?.pendingQueueItems || [],
    in_review: overview?.inReviewQueueItems || [],
    returned: overview?.returnedQueueItems || [],
    resubmitted: overview?.resubmittedQueueItems || [],
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
  const pendingQueue = [...queueGroups.pending, ...queueGroups.in_review].sort((a, b) => {
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
      : queueTab === 'returned'
      ? returnedQueue
      : queueTab === 'resubmitted'
      ? resubmittedQueue
      : sortedBySubmitted;
  const queueTotalPages = Math.max(1, Math.ceil(visibleQueue.length / DASHBOARD_QUEUE_PAGE_SIZE));
  const paginatedQueue = visibleQueue.slice(
    (queuePage - 1) * DASHBOARD_QUEUE_PAGE_SIZE,
    queuePage * DASHBOARD_QUEUE_PAGE_SIZE,
  );

  useEffect(() => {
    if (queuePage > queueTotalPages) {
      setQueuePage(queueTotalPages);
    }
  }, [queuePage, queueTotalPages]);

  if (overviewLoading || !overview) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[100rem] space-y-5 sm:space-y-8">
      <PortalPageIntro
        eyebrow={(
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            Clinic Operations Portal
          </span>
        )}
        title={`Welcome, ${displayName}`}
      />

      <SubmissionDashboardCards
        isError={reportSubmissionsError}
        isLoading={reportSubmissionsLoading}
        registeredStudents={reportData.registeredStudents}
        submissions={reportData.submissions}
      />

      <div className="grid min-w-0 gap-5 sm:gap-6">
        <div className="box-border flex w-full min-w-0 flex-col rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Submission Queue</h2>
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
              <button
                onClick={() => setQueueSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[18px] border border-outline-variant/50 bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface md:w-auto"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {queueSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </button>
              <button
                onClick={() => navigate('/staff/submissions')}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-[18px] bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 md:w-auto"
              >
                Open Queue
              </button>
              <button
                type="button"
                onClick={() => {
                  void refetchOverview();
                }}
                disabled={overviewFetching}
                aria-label="Refresh queue"
                title="Refresh queue"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-[18px] border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              >
                <RefreshCw className={`h-4 w-4 ${overviewFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <Tabs
            value={queueTab}
            onValueChange={(value) => setQueueTab(value as 'all' | 'pending' | 'returned' | 'resubmitted')}
            className="mb-5"
          >
            <div className="pb-1">
              <TabsList className="grid h-auto min-h-10 w-full grid-cols-2 gap-2 rounded-[18px] p-2 md:grid-cols-4">
                <TabsTrigger value="pending" className="h-full min-h-10 px-3 text-center text-xs leading-tight whitespace-normal md:text-sm">
                  Pending ({(overview.pendingRecords || 0) + (overview.inReviewRecords || 0)})
                </TabsTrigger>
                <TabsTrigger value="returned" className="h-full min-h-10 px-3 text-center text-xs leading-tight whitespace-normal md:text-sm">
                  Returned ({overview.returnedRecords || 0})
                </TabsTrigger>
                <TabsTrigger value="resubmitted" className="h-full min-h-10 px-3 text-center text-xs leading-tight whitespace-normal md:text-sm">
                  Resubmitted ({overview.resubmittedRecords || 0})
                </TabsTrigger>
                <TabsTrigger value="all" className="h-full min-h-10 px-3 text-center text-xs leading-tight whitespace-normal md:text-sm">
                  All Action Needed ({overview.actionableRecords || 0})
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>

          {visibleQueue.length === 0 ? (
            <div className="flex min-h-56 flex-1 flex-col items-center justify-center rounded-[18px] border border-dashed border-outline-variant/40 bg-surface-container-low px-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="mt-4 text-lg font-semibold text-on-surface">All caught up</p>
              <p className="mt-2 max-w-sm text-sm text-on-surface-variant">
                {queueTab === 'all'
                  ? 'There are no pending, in-review, returned, or resubmitted records that need staff attention right now.'
                  : `There are no ${queueTab.replace('_', ' ')} records right now.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="space-y-3">
                {paginatedQueue.map((submission) => (
                  <button
                    key={submission.id}
                    onClick={() => navigate(`/staff/review/${submission.id}`)}
                    className="box-border flex w-full min-w-0 flex-col gap-3 rounded-[18px] border border-outline-variant/20 bg-surface-container-lowest p-4 text-left transition-colors hover:bg-surface-container-low md:flex-row md:items-start md:gap-4"
                  >
                    <div className="flex items-start gap-4 md:flex-1">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[18px] bg-surface-container text-primary sm:h-12 sm:w-12">
                        <ClipboardCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-on-surface">
                            {submission.firstName} {submission.lastName}
                          </p>
                          {submission.status !== 'in_review' ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getStatusStyles(submission.status)}`}
                            >
                              {getStatusLabel(submission.status)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 break-words text-xs text-on-surface-variant">
                          {submission.studentId} | {formatSubmittedYearLevel(submission.studentYearLevel)} | {submission.course}
                        </p>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          Submitted {formatDate(submission.submittedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full items-center justify-end md:w-auto">
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-on-surface-variant" />
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-auto">
                <ListPagination
                  currentPage={queuePage}
                  totalPages={queueTotalPages}
                  totalItems={visibleQueue.length}
                  pageSize={DASHBOARD_QUEUE_PAGE_SIZE}
                  pageSizeOptions={[DASHBOARD_QUEUE_PAGE_SIZE]}
                  itemLabel="submissions"
                  onPageChange={setQueuePage}
                  onPageSizeChange={() => undefined}
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
