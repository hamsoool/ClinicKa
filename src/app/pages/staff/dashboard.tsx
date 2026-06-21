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
import { getRoleLabel, getSubmissionReportSummaries, isDoctorPosition } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { StudentAccountSummary, SubmissionRecord, SubmissionSummaryRecord } from '../../lib/record-types';
import { getYearLevelLabel } from '../../lib/student-year';
import { loadStaffWorkspacePreferences } from './staff-workspace-preferences';
import { useStaffDashboardOverviewQuery } from './staff-workflow-query';

const DASHBOARD_QUEUE_PAGE_SIZE = 20;
const DASHBOARD_RECENT_ACTIONS_PAGE_SIZE = 10;
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
    case 'in_review':
      return 'In Review';
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
    case 'in_review':
      return 'bg-amber-100 text-amber-800';
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

function abbreviateCourse(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return 'Unspecified';

  const parenMatch = raw.match(/\(([A-Za-z]{2,10})\)\s*$/);
  if (parenMatch?.[1]) return parenMatch[1].toUpperCase();

  const normalized = raw.toLowerCase().replace(/\./g, '');
  const known: Array<[string, string]> = [
    ['bachelor of science in information technology', 'BSIT'],
    ['bs information technology', 'BSIT'],
    ['bachelor of science in computer science', 'BSCS'],
    ['bs computer science', 'BSCS'],
    ['bachelor of science in nursing', 'BSN'],
    ['bs nursing', 'BSN'],
    ['bachelor of science in business administration', 'BSBA'],
    ['bs business administration', 'BSBA'],
    ['bachelor of science in psychology', 'BSPsych'],
    ['bs psychology', 'BSPsych'],
    ['bachelor of science in hospitality management', 'BSHM'],
    ['bs hospitality management', 'BSHM'],
    ['bachelor of secondary education', 'BSEd'],
    ['bachelor of elementary education', 'BEEd'],
  ];
  const exact = known.find(([key]) => normalized === key);
  if (exact) return exact[1];

  const bsInMatch = normalized.match(/^bachelor of science in\s+(.+)$/i);
  if (bsInMatch?.[1]) {
    const major = bsInMatch[1]
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !['and', 'of', 'the', 'in'].includes(w));
    const majorAcronym = major.map((w) => w[0]).join('').toUpperCase();
    if (majorAcronym) return `BS${majorAcronym}`;
  }

  if (/^[A-Za-z]{2,8}$/.test(raw.replace(/\s+/g, ''))) return raw.toUpperCase();

  const acronym = raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !['of', 'in', 'and', 'the'].includes(part.toLowerCase()))
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return acronym.length >= 3 && acronym.length <= 8 ? acronym : raw;
}

function abbreviateDepartment(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return 'Unspecified';

  const upper = raw.toUpperCase();
  if (['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'].includes(upper)) return upper;

  const parenMatch = raw.match(/\(([A-Za-z]{2,10})\)\s*$/);
  if (parenMatch?.[1]) {
    const pUpper = parenMatch[1].toUpperCase();
    if (['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'].includes(pUpper)) return pUpper;
    return pUpper;
  }

  const normalized = raw.toLowerCase();
  if (normalized.includes('computer studies') || normalized.includes('ccs')) return 'CCS';
  if (normalized.includes('business') || normalized.includes('cba')) return 'CBA';
  if (normalized.includes('education') || normalized.includes('arts') || normalized.includes('sciences') || normalized.includes('ceas')) return 'CEAS';
  if (normalized.includes('hospitality') || normalized.includes('tourism') || normalized.includes('chtm')) return 'CHTM';
  if (normalized.includes('allied health') || normalized.includes('health sciences') || normalized.includes('cahs')) return 'CAHS';

  if (raw.length > 8) {
    const acronym = raw
      .split(/\s+/)
      .filter(Boolean)
      .filter((part) => !['of', 'in', 'and', 'the'].includes(part.toLowerCase()))
      .map((part) => part[0])
      .join('')
      .toUpperCase();
    if (acronym.length >= 2 && acronym.length <= 8) return acronym;
  }

  return raw;
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
  const rawDisplayName =
    [me?.staff?.first_name || me?.profile.first_name || '', me?.staff?.last_name || me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    formatEmailName(me?.profile.email) ||
    staffRoleLabel;
  const isDoctor = isDoctorPosition(me?.staff?.position);
  const displayName = isDoctor && rawDisplayName && !rawDisplayName.startsWith('Dr. ')
    ? `Dr. ${rawDisplayName}`
    : rawDisplayName;

  const [queueSortOrder, setQueueSortOrder] = useState<'desc' | 'asc'>(workspacePreferences.reviewSortOrder);
  const [queueTab, setQueueTab] = useState<'all' | 'pending' | 'returned' | 'resubmitted'>(
    workspacePreferences.dashboardQueueTab === 'in_review' ? 'pending' : workspacePreferences.dashboardQueueTab,
  );
  const [queuePage, setQueuePage] = useState(1);
  const [recentActionsPage, setRecentActionsPage] = useState(1);
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

  const recentActions = useMemo(() => {
    const studentMap = new Map<string, StudentAccountSummary>();
    reportData.registeredStudents.forEach((student) => {
      if (student.studentId) {
        studentMap.set(student.studentId.trim(), student);
      }
    });

    return [...reportData.submissions]
      .map((sub) => {
        const student = studentMap.get(sub.studentId.trim());
        const firstName = student?.firstName || sub.firstName || '';
        const lastName = student?.lastName || sub.lastName || '';
        const fullName = [lastName, firstName].filter(Boolean).join(', ') || 'Unknown Student';

        const rawDept = sub.department || student?.department || '';
        const rawCourse = sub.course || student?.course || '';
        const deptCode = abbreviateDepartment(rawDept);
        const courseCode = abbreviateCourse(rawCourse);

        return {
          ...sub,
          fullName,
          deptCode,
          courseCode,
          yearLevel: student?.studentYearLevel || student?.year || sub.studentYearLevel || 'Unspecified',
        };
      })
      .sort((a, b) => {
        const timeA = new Date(a.submittedAt || 0).getTime();
        const timeB = new Date(b.submittedAt || 0).getTime();
        return timeB - timeA;
      });
  }, [reportData.submissions, reportData.registeredStudents]);

  const recentActionsTotalPages = Math.max(1, Math.ceil(recentActions.length / DASHBOARD_RECENT_ACTIONS_PAGE_SIZE));
  const paginatedRecentActions = useMemo(() => {
    return recentActions.slice(
      (recentActionsPage - 1) * DASHBOARD_RECENT_ACTIONS_PAGE_SIZE,
      recentActionsPage * DASHBOARD_RECENT_ACTIONS_PAGE_SIZE,
    );
  }, [recentActions, recentActionsPage]);

  useEffect(() => {
    if (recentActionsPage > recentActionsTotalPages) {
      setRecentActionsPage(recentActionsTotalPages);
    }
  }, [recentActionsPage, recentActionsTotalPages]);

  if (overviewLoading || !overview) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[100rem] space-y-5 sm:space-y-8">
      <PortalPageIntro
        className="border-none bg-transparent p-0 sm:p-0 shadow-none"
        title={`Welcome to ClinicKa! ${displayName}.`}
      />

      <SubmissionDashboardCards
        isError={reportSubmissionsError}
        isLoading={reportSubmissionsLoading}
        registeredStudents={reportData.registeredStudents}
        submissions={reportData.submissions}
      />

      <div className="grid min-w-0 grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="box-border flex w-full min-w-0 flex-col rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-6 flex flex-row items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-on-surface sm:text-lg whitespace-nowrap">Submission Queue</h2>
            </div>
            <div className="flex flex-row items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setQueueSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-[14px] border border-outline-variant/50 bg-surface-container-low px-2 text-[10px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface sm:h-10 sm:rounded-[18px] sm:px-4 sm:text-xs"
              >
                <ArrowUpDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span>{queueSortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/staff/submissions')}
                className="inline-flex h-8 items-center justify-center rounded-[14px] bg-primary px-2 text-[10px] font-semibold text-white transition-colors hover:bg-primary/90 sm:h-10 sm:rounded-[18px] sm:px-4 sm:text-sm"
              >
                Open<span className="hidden sm:inline">&nbsp;Queue</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void refetchOverview();
                }}
                disabled={overviewFetching}
                aria-label="Refresh queue"
                title="Refresh queue"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-outline-variant/50 bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10"
              >
                <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${overviewFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <Tabs
            value={queueTab}
            onValueChange={(value) => setQueueTab(value as 'all' | 'pending' | 'returned' | 'resubmitted')}
            className="mb-5"
          >
            <div className="pb-1">
              <TabsList className="grid h-auto min-h-10 w-full grid-cols-4 gap-1 rounded-[18px] p-1.5 sm:p-2 sm:gap-2">
                <TabsTrigger value="pending" className="h-full min-h-10 px-1 sm:px-3 text-center text-[10px] sm:text-xs md:text-sm leading-tight whitespace-normal">
                  Pending ({(overview.pendingRecords || 0) + (overview.inReviewRecords || 0)})
                </TabsTrigger>
                <TabsTrigger value="returned" className="h-full min-h-10 px-1 sm:px-3 text-center text-[10px] sm:text-xs md:text-sm leading-tight whitespace-normal">
                  Returned ({overview.returnedRecords || 0})
                </TabsTrigger>
                <TabsTrigger value="resubmitted" className="h-full min-h-10 px-1 sm:px-3 text-center text-[10px] sm:text-xs md:text-sm leading-tight whitespace-normal">
                  Resubmitted ({overview.resubmittedRecords || 0})
                </TabsTrigger>
                <TabsTrigger value="all" className="h-full min-h-10 px-1 sm:px-3 text-center text-[10px] sm:text-xs md:text-sm leading-tight whitespace-normal">
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

        <div className="box-border flex w-full min-w-0 flex-col rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Recent Actions</h2>
            </div>
          </div>

          {/* Mobile/Tablet Stacked View */}
          <div className="flex-1 md:hidden">
            {paginatedRecentActions.length === 0 ? (
              <div className="py-8 text-center text-on-surface-variant text-sm">
                No recent submissions found.
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/15">
                {paginatedRecentActions.map((action) => (
                  <div key={action.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-on-surface truncate">
                        {action.fullName}
                      </h3>
                      <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                        {action.studentId} • {[action.courseCode, action.deptCode].filter(v => v && v !== 'Unspecified').join(' / ') || 'Unspecified'} • {getYearLevelLabel(action.yearLevel)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${getStatusStyles(action.status as any)}`}>
                        {getStatusLabel(action.status as any)}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-medium">
                        {formatDate(action.submittedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="flex-1 overflow-x-auto hidden md:block">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-low text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                  <th className="px-4 py-3 font-semibold">Student ID</th>
                  <th className="px-4 py-3 font-semibold">Full Name</th>
                  <th className="px-4 py-3 font-semibold">Course / Dept</th>
                  <th className="px-4 py-3 font-semibold">Year Level</th>
                  <th className="px-4 py-3 font-semibold">Submission Date</th>
                  <th className="px-4 py-3 font-semibold text-right">Clearance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 text-on-surface">
                {paginatedRecentActions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-on-surface-variant text-sm">
                      No recent submissions found.
                    </td>
                  </tr>
                ) : (
                  paginatedRecentActions.map((action) => (
                    <tr key={action.id} className="transition-colors hover:bg-surface-container-low/35">
                      <td className="px-4 py-3 font-bold">{action.studentId}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">{action.fullName}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {[action.courseCode, action.deptCode].filter(v => v && v !== 'Unspecified').join(' / ') || 'Unspecified'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{getYearLevelLabel(action.yearLevel)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(action.submittedAt)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getStatusStyles(action.status as any)}`}>
                          {getStatusLabel(action.status as any)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {recentActions.length > 0 && (
            <div className="mt-auto">
              <ListPagination
                currentPage={recentActionsPage}
                totalPages={recentActionsTotalPages}
                totalItems={recentActions.length}
                pageSize={DASHBOARD_RECENT_ACTIONS_PAGE_SIZE}
                pageSizeOptions={[DASHBOARD_RECENT_ACTIONS_PAGE_SIZE]}
                itemLabel="records"
                onPageChange={setRecentActionsPage}
                onPageSizeChange={() => undefined}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
