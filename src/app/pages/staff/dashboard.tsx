import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  ShieldCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import PortalPageIntro from '../../components/portal-page-intro';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import ListPagination from '../../components/list-pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { getActiveAjaxRefetchInterval } from '../../lib/ajax-refresh';
import { getRoleLabel, getSubmissions } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { SubmissionRecord, SubmissionSummaryRecord } from '../../lib/record-types';
import { loadStaffWorkspacePreferences } from './staff-workspace-preferences';
import { useStaffDashboardOverviewQuery } from './staff-workflow-query';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
const DEPARTMENT_COLORS: Record<string, string> = {
  CCS: '#f97316',
  CBA: '#facc15',
  CEAS: '#3b82f6',
  CHTM: '#ec4899',
  CAHS: '#ef4444',
};
const SUBMISSION_RANGE_COLORS = ['#0f766e', '#14b8a6', '#f59e0b', '#f97316'];
const REPORT_GROUP_LABELS = {
  department: 'Department',
  gender: 'Gender',
  year: 'Year Level',
  program: 'Program',
} as const;
const REPORT_CHART_COLORS = ['#0f766e', '#14b8a6', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#6366f1', '#ec4899'];
const YEAR_LEVEL_COLORS: Record<string, string> = {
  '1': '#f97316',
  '2': '#facc15',
  '3': '#3b82f6',
  '4': '#14b8a6',
};
const GENDER_COLORS: Record<string, string> = {
  male: '#3b82f6',
  female: '#ec4899',
  other: '#8b5cf6',
  unspecified: '#94a3b8',
};
const YEAR_LABELS: Record<string, string> = {
  '1': '1st Year',
  '2': '2nd Year',
  '3': '3rd Year',
  '4': '4th Year',
};
const DASHBOARD_QUEUE_PAGE_SIZE = 20;
const GENDER_ORDER = ['male', 'female', 'other', 'unspecified'];

const SUBMISSION_RANGE_LABELS = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  academicYear: 'School Year',
} as const;
type SubmissionRangeKey = keyof typeof SUBMISSION_RANGE_LABELS;
type ReportGroupKey = keyof typeof REPORT_GROUP_LABELS;

type ReportChartDatum = {
  key: string;
  rawValue: string;
  label: string;
  count: number;
  fill: string;
  share: number;
};

type SubmissionTrendDatum = {
  key: SubmissionRangeKey;
  label: string;
  count: number;
  fill: string;
  helper: string;
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

function normalizeSubmissionGenderValue(value?: string) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'unspecified';
  if (normalized === 'm' || normalized === 'male') return 'male';
  if (normalized === 'f' || normalized === 'female') return 'female';
  if (['other', 'others', 'non-binary', 'nonbinary'].includes(normalized)) return 'other';
  return normalized;
}

function formatGenderLabel(value: string) {
  if (value === 'male') return 'Male';
  if (value === 'female') return 'Female';
  if (value === 'other') return 'Other';
  if (value === 'unspecified') return 'Unspecified';
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
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

  if (/^[A-Za-z]{2,10}$/.test(raw.replace(/\s+/g, ''))) return raw.toUpperCase();

  const acronym = raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !['of', 'in', 'and', 'the'].includes(part.toLowerCase()))
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return acronym.length >= 3 && acronym.length <= 10 ? acronym : raw;
}

function resolveDepartmentValue(department?: string, course?: string) {
  const normalizedDepartment = String(department || '').trim().toUpperCase();
  if (DEPARTMENTS.includes(normalizedDepartment)) return normalizedDepartment;

  const normalizedCourse = String(course || '').trim().toUpperCase();
  const matchedDepartment = DEPARTMENTS.find((item) => normalizedCourse.includes(item));
  if (matchedDepartment) return matchedDepartment;

  return normalizedDepartment || 'Unspecified';
}

function getAcademicYearRange(label?: string) {
  const [startYearValue, endYearValue] = String(label || '').split('-');
  const startYear = Number.parseInt(startYearValue || '', 10);
  const endYear = Number.parseInt(endYearValue || '', 10);
  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return {
      start: new Date(startYear, 6, 1),
      end: new Date(endYear, 6, 1),
    };
  }

  const now = new Date();
  const fallbackStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: new Date(fallbackStartYear, 6, 1),
    end: new Date(fallbackStartYear + 1, 6, 1),
  };
}

function getSubmissionGroupValue(submission: SubmissionRecord, groupBy: ReportGroupKey) {
  if (groupBy === 'department') {
    return resolveDepartmentValue(submission.department, submission.course);
  }

  if (groupBy === 'gender') {
    return normalizeSubmissionGenderValue(submission.sex);
  }

  if (groupBy === 'year') {
    return String(submission.year || '').trim() || 'unspecified';
  }

  return abbreviateCourse(submission.course);
}

function formatSubmissionGroupLabel(value: string, groupBy: ReportGroupKey) {
  if (groupBy === 'gender') {
    return formatGenderLabel(value);
  }

  if (groupBy === 'year') {
    return YEAR_LABELS[value] || (value === 'unspecified' ? 'Unspecified' : `Year ${value}`);
  }

  return value || 'Unspecified';
}

function ReportBreakdownTooltip({ active, payload }: TooltipProps<number, string>) {
  const entry = payload?.[0]?.payload as ReportChartDatum | undefined;

  if (!active || !entry) {
    return null;
  }

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 shadow-sm">
      <p className="text-sm font-semibold text-on-surface">{entry.label}</p>
      <p className="mt-1 text-xs text-on-surface-variant">
        {entry.count} submission{entry.count === 1 ? '' : 's'} • {entry.share.toFixed(0)}%
      </p>
    </div>
  );
}

function ReportBarValueLabel(props: any) {
  const { x = 0, y = 0, width = 0, value = 0 } = props || {};

  return (
    <text
      x={x + width / 2}
      y={Math.max(Number(y) - 8, 14)}
      textAnchor="middle"
      fontSize={12}
      fill="hsl(var(--muted-foreground))"
    >
      {value}
    </text>
  );
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
  const [reportRange, setReportRange] = useState<SubmissionRangeKey>('today');
  const [reportGroupBy, setReportGroupBy] = useState<ReportGroupKey>('department');
  const {
    data: overview,
    isLoading: overviewLoading,
    isFetching: overviewFetching,
    isError: isOverviewError,
  } = useStaffDashboardOverviewQuery();
  const {
    data: reportSubmissions = [],
    isLoading: reportSubmissionsLoading,
  } = useQuery({
    queryKey: ['staffDashboardReportSubmissions'],
    queryFn: async () => {
      const response = await getSubmissions();
      return Array.isArray(response?.submissions) ? response.submissions as SubmissionRecord[] : [];
    },
    staleTime: 45_000,
    refetchInterval: () => getActiveAjaxRefetchInterval(60_000),
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

  const summaryCards = [
    {
      label: 'Pending',
      value: (overview?.pendingRecords || 0) + (overview?.inReviewRecords || 0),
      icon: ClipboardCheck,
      tone: 'text-primary',
      href: '/staff/submissions?status=pending',
    },
    {
      label: 'Returned',
      value: overview?.returnedRecords || 0,
      icon: FileWarning,
      tone: 'text-rose-600',
      href: '/staff/submissions?status=returned',
    },
    {
      label: 'Approved Clearance',
      value: overview?.approvedRecords || 0,
      icon: ShieldCheck,
      tone: 'text-emerald-700',
      href: '/staff/records',
    },
  ] as const;
  const submissionTrendData: SubmissionTrendDatum[] = [
    {
      key: 'today',
      label: SUBMISSION_RANGE_LABELS.today,
      count: overview?.submittedToday || 0,
      fill: SUBMISSION_RANGE_COLORS[0],
      helper: 'Submitted since 12:00 AM today',
    },
    {
      key: 'week',
      label: SUBMISSION_RANGE_LABELS.week,
      count: overview?.submittedThisWeek || 0,
      fill: SUBMISSION_RANGE_COLORS[1],
      helper: 'Submitted since the start of this week',
    },
    {
      key: 'month',
      label: SUBMISSION_RANGE_LABELS.month,
      count: overview?.submittedThisMonth || 0,
      fill: SUBMISSION_RANGE_COLORS[2],
      helper: 'Submitted since the start of this month',
    },
    {
      key: 'academicYear',
      label: overview?.academicYearLabel
        ? `SY ${overview.academicYearLabel}`
        : SUBMISSION_RANGE_LABELS.academicYear,
      count: overview?.submittedThisAcademicYear || 0,
      fill: SUBMISSION_RANGE_COLORS[3],
      helper: 'Submitted during the active academic year',
    },
  ];
  const selectedSubmissionTrend =
    submissionTrendData.find((item) => item.key === reportRange) || submissionTrendData[0];
  const filteredReportSubmissions = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    const dayOfWeek = weekStart.getDay();
    const weekOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + weekOffset);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const academicYearRange = getAcademicYearRange(overview?.academicYearLabel);

    return reportSubmissions.filter((submission) => {
      const submittedAt = new Date(submission.submittedAt || '');
      if (Number.isNaN(submittedAt.getTime())) return false;

      if (reportRange === 'today') return submittedAt >= todayStart;
      if (reportRange === 'week') return submittedAt >= weekStart;
      if (reportRange === 'month') return submittedAt >= monthStart;
      return submittedAt >= academicYearRange.start && submittedAt < academicYearRange.end;
    });
  }, [overview?.academicYearLabel, reportRange, reportSubmissions]);
  const uniqueReportSubmissions = useMemo(() => {
    const latestByStudent = new Map<string, SubmissionRecord>();

    filteredReportSubmissions.forEach((submission) => {
      const studentKey = String(submission.studentId || submission.id || '').trim();
      if (!studentKey) return;

      const existing = latestByStudent.get(studentKey);
      if (!existing) {
        latestByStudent.set(studentKey, submission);
        return;
      }

      const existingTs = new Date(existing.submittedAt || 0).getTime();
      const nextTs = new Date(submission.submittedAt || 0).getTime();
      if (nextTs >= existingTs) {
        latestByStudent.set(studentKey, submission);
      }
    });

    return [...latestByStudent.values()];
  }, [filteredReportSubmissions]);
  const reportChartData = useMemo(() => {
    const counts = uniqueReportSubmissions.reduce((acc, submission) => {
      const rawValue = getSubmissionGroupValue(submission, reportGroupBy);
      const label = formatSubmissionGroupLabel(rawValue, reportGroupBy);
      const key = `${reportGroupBy}:${rawValue}`;
      const existing = acc[key];
      if (existing) {
        existing.count += 1;
        return acc;
      }

      acc[key] = {
        key,
        rawValue,
        label,
        count: 1,
        fill: '#94a3b8',
        share: 0,
      };
      return acc;
    }, {} as Record<string, ReportChartDatum>);

    const total = uniqueReportSubmissions.length;

    if (reportGroupBy === 'department') {
      return DEPARTMENTS.map((department) => {
        const key = `${reportGroupBy}:${department}`;
        const item = counts[key];
        const count = item?.count || 0;
        return {
          key,
          rawValue: department,
          label: department,
          count,
          fill: DEPARTMENT_COLORS[department] || '#94a3b8',
          share: total > 0 ? (count / total) * 100 : 0,
        };
      });
    }

    if (reportGroupBy === 'year') {
      const orderedYears = ['1', '2', '3', '4'];
      const base = orderedYears.map((year) => {
        const key = `${reportGroupBy}:${year}`;
        const item = counts[key];
        const count = item?.count || 0;
        return {
          key,
          rawValue: year,
          label: YEAR_LABELS[year] || `Year ${year}`,
          count,
          fill: YEAR_LEVEL_COLORS[year] || '#94a3b8',
          share: total > 0 ? (count / total) * 100 : 0,
        };
      });

      if (counts[`${reportGroupBy}:unspecified`]) {
        const count = counts[`${reportGroupBy}:unspecified`].count;
        base.push({
          key: `${reportGroupBy}:unspecified`,
          rawValue: 'unspecified',
          label: 'Unspecified',
          count,
          fill: '#94a3b8',
          share: total > 0 ? (count / total) * 100 : 0,
        });
      }

      return base;
    }

    if (reportGroupBy === 'gender') {
      return GENDER_ORDER.map((gender) => {
        const key = `${reportGroupBy}:${gender}`;
        const item = counts[key];
        const count = item?.count || 0;
        return {
          key,
          rawValue: gender,
          label: formatGenderLabel(gender),
          count,
          fill: GENDER_COLORS[gender] || '#94a3b8',
          share: total > 0 ? (count / total) * 100 : 0,
        };
      });
    }

    return Object.values(counts)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .map((item, index) => ({
        ...item,
        fill: REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length],
        share: total > 0 ? (item.count / total) * 100 : 0,
      }));
  }, [reportGroupBy, uniqueReportSubmissions]);
  const totalReportStudents = uniqueReportSubmissions.length;
  const hasReportChartData = totalReportStudents > 0;
  const reportChartMinWidth = Math.max(320, reportChartData.length * (reportGroupBy === 'program' ? 96 : 76));

  if (overviewLoading || !overview) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-5 sm:space-y-8">
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
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

      <div className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.85fr)]">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Submission Queue</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                By default, this view starts with pending records so staff can take action quickly.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <button
                onClick={() => setQueueSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface sm:w-auto"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {queueSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </button>
              <button
                onClick={() => navigate('/staff/submissions')}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
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
            onValueChange={(value) => setQueueTab(value as 'all' | 'pending' | 'returned' | 'resubmitted')}
            className="mb-5"
          >
            <div className="pb-1">
              <TabsList className="grid h-auto min-h-10 w-full grid-cols-2 gap-2 rounded-2xl p-2 sm:grid-cols-4">
                <TabsTrigger value="pending" className="h-full min-h-10 px-3 text-center text-xs leading-tight whitespace-normal sm:text-sm">
                  Pending ({(overview.pendingRecords || 0) + (overview.inReviewRecords || 0)})
                </TabsTrigger>
                <TabsTrigger value="returned" className="h-full min-h-10 px-3 text-center text-xs leading-tight whitespace-normal sm:text-sm">
                  Returned ({overview.returnedRecords || 0})
                </TabsTrigger>
                <TabsTrigger value="resubmitted" className="h-full min-h-10 px-3 text-center text-xs leading-tight whitespace-normal sm:text-sm">
                  Resubmitted ({overview.resubmittedRecords || 0})
                </TabsTrigger>
                <TabsTrigger value="all" className="h-full min-h-10 px-3 text-center text-xs leading-tight whitespace-normal sm:text-sm">
                  All Action Needed ({overview.actionableRecords || 0})
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
                  ? 'There are no pending, in-review, returned, or resubmitted records that need staff attention right now.'
                  : `There are no ${queueTab.replace('_', ' ')} records right now.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedQueue.map((submission) => (
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
                        {submission.status !== 'in_review' ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getStatusStyles(submission.status)}`}
                          >
                            {getStatusLabel(submission.status)}
                          </span>
                        ) : null}
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
          )}
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-on-surface">Submission Overview</h2>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {totalReportStudents} student{totalReportStudents === 1 ? '' : 's'}
                </p>
              </div>
              <div className="w-full sm:w-44">
                <p className="mb-1 text-xs font-medium text-on-surface-variant">Group by</p>
                <Select value={reportGroupBy} onValueChange={(value) => setReportGroupBy(value as ReportGroupKey)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Choose grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="gender">Gender</SelectItem>
                    <SelectItem value="year">Year Level</SelectItem>
                    <SelectItem value="program">Program</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Tabs
              value={reportRange}
              onValueChange={(value) => setReportRange(value as SubmissionRangeKey)}
            >
              <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl p-2 sm:grid-cols-4 sm:gap-0 sm:p-[3px]">
                <TabsTrigger value="today" className="min-h-9 px-3 text-xs sm:text-sm">Today</TabsTrigger>
                <TabsTrigger value="week" className="min-h-9 px-3 text-xs sm:text-sm">This Week</TabsTrigger>
                <TabsTrigger value="month" className="min-h-9 px-3 text-xs sm:text-sm">This Month</TabsTrigger>
                <TabsTrigger value="academicYear" className="min-h-9 px-3 text-xs sm:text-sm">School Year</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-low/40 p-4">
              {reportSubmissionsLoading ? (
                <div className="flex min-h-52 items-center justify-center text-sm text-on-surface-variant">
                  Loading submission breakdown...
                </div>
              ) : !hasReportChartData ? (
                <div className="flex min-h-52 flex-col items-center justify-center text-center">
                  <p className="text-lg font-semibold text-on-surface">No submissions yet</p>
                  <p className="mt-2 max-w-xs text-sm text-on-surface-variant">
                    There are no student submissions to display for {selectedSubmissionTrend.label.toLowerCase()} grouped by {REPORT_GROUP_LABELS[reportGroupBy].toLowerCase()}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="h-64 min-w-full" style={{ width: `${reportChartMinWidth}px` }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportChartData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--outline-variant) / 0.3)" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          domain={[0, (dataMax: number) => Math.max(1, Number(dataMax) || 0)]}
                        />
                        <Tooltip content={<ReportBreakdownTooltip />} cursor={{ fill: 'rgba(15, 118, 110, 0.06)' }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                          {reportChartData.map((entry) => (
                            <Cell key={entry.key} fill={entry.fill} />
                          ))}
                          <LabelList dataKey="count" content={<ReportBarValueLabel />} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
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
