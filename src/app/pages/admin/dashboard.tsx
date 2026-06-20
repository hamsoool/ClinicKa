import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  ScanText,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import PortalPageIntro from '../../components/portal-page-intro';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import { useAuth } from '../../lib/auth';
import ListPagination from '../../components/list-pagination';
import {
  useAdminAnalyticsQuery,
  useAdminOcrAnalyticsQuery,
  useAdminStaffUsersQuery,
  useAdminSubmissionsQuery,
  useAdminUserAccountsQuery,
} from './admin-workflow-query';

type StaffUser = {
  id: string;
  name: string;
  role: string;
  status: string;
  email: string;
};

type UserAccount = {
  id: string;
  name: string;
  role: string;
  status: string;
  lastActive?: string;
};

type SubmissionSummary = {
  id: string;
  firstName?: string;
  lastName?: string;
  studentId?: string;
  submittedAt: string;
  updatedAt?: string;
  status: 'pending' | 'in_review' | 'approved' | 'returned' | 'resubmitted';
  course?: string;
  reviewedByStaffId?: string;
  reviewedByName?: string;
  reviewedByPosition?: string;
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

  return dateFormatter.format(date);
}

function formatDateTime(value?: string) {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return dateTimeFormatter.format(date);
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function getStatusLabel(status: SubmissionSummary['status']) {
  switch (status) {
    case 'pending':
      return 'Pending review';
    case 'in_review':
      return 'In review';
    case 'approved':
      return 'Approved';
    case 'returned':
      return 'Returned';
    default:
      return status;
  }
}

function getStatusStyles(status: SubmissionSummary['status']) {
  switch (status) {
    case 'approved':
      return 'bg-primary-container/20 text-on-primary-container';
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'in_review':
      return 'bg-sky-100 text-sky-800';
    case 'returned':
      return 'bg-error-container/70 text-on-error-container';
    default:
      return 'bg-surface-variant text-on-surface-variant';
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const displayName =
    [me?.profile.first_name || '', me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    formatEmailName(me?.profile.email) ||
    'System Administrator';

  const { data: analytics, isLoading: analyticsLoading } = useAdminAnalyticsQuery();
  const { data: staffData, isLoading: staffLoading } = useAdminStaffUsersQuery();
  const { data: userData, isLoading: userLoading } = useAdminUserAccountsQuery();
  const { data: submissionData, isLoading: submissionLoading } = useAdminSubmissionsQuery();
  const { data: ocrAnalyticsData, isLoading: ocrAnalyticsLoading } = useAdminOcrAnalyticsQuery();
  const legacySubmissionData = submissionData as { submissions?: SubmissionSummary[] } | undefined;

  const staffUsers = (staffData?.staff || []) as StaffUser[];
  const userAccounts = (userData?.users || []) as UserAccount[];
  const submissions = (
    Array.isArray(submissionData)
      ? submissionData
      : Array.isArray(legacySubmissionData?.submissions)
        ? legacySubmissionData.submissions
        : []
  ) as SubmissionSummary[];

  const loading = analyticsLoading || staffLoading || userLoading || submissionLoading || ocrAnalyticsLoading;

  const {
    adminCount,
    clinicStaffCount,
    studentAccounts,
    recentAccounts,
    submissionsNeedingAttention,
    staffActions,
  } = useMemo(() => {
    const admin = userAccounts.filter((user) => user.role === 'Administrator').length;
    const clinicStaff = userAccounts.filter((user) => user.role === 'Clinic Staff').length;
    const students = userAccounts.filter((user) => user.role === 'Student').length;
    const recent = [...userAccounts]
      .filter((user) => user.lastActive)
      .sort((a, b) => new Date(b.lastActive || 0).getTime() - new Date(a.lastActive || 0).getTime());
    const queue = [...submissions]
      .filter((submission) => submission.status === 'pending' || submission.status === 'in_review' || submission.status === 'returned')
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    const actions = [...submissions]
      .filter((submission) => submission.reviewedByName || submission.reviewedByStaffId)
      .sort((a, b) => new Date(b.updatedAt || b.submittedAt).getTime() - new Date(a.updatedAt || a.submittedAt).getTime());
    return {
      adminCount: admin,
      clinicStaffCount: clinicStaff,
      studentAccounts: students,
      recentAccounts: recent,
      submissionsNeedingAttention: queue,
      staffActions: actions,
    };
  }, [submissions, userAccounts]);

  const [logsPage, setLogsPage] = useState(1);
  const [accountsPage, setAccountsPage] = useState(1);
  const [queuePage, setQueuePage] = useState(1);

  const ITEMS_PER_PAGE = 10;

  const totalLogsPages = Math.max(1, Math.ceil(staffActions.length / ITEMS_PER_PAGE));
  const totalAccountsPages = Math.max(1, Math.ceil(recentAccounts.length / ITEMS_PER_PAGE));
  const totalQueuePages = Math.max(1, Math.ceil(submissionsNeedingAttention.length / ITEMS_PER_PAGE));

  const paginatedStaffActions = useMemo(() => {
    const activePage = Math.min(logsPage, totalLogsPages);
    const start = (activePage - 1) * ITEMS_PER_PAGE;
    return staffActions.slice(start, start + ITEMS_PER_PAGE);
  }, [staffActions, logsPage, totalLogsPages]);

  const paginatedRecentAccounts = useMemo(() => {
    const activePage = Math.min(accountsPage, totalAccountsPages);
    const start = (activePage - 1) * ITEMS_PER_PAGE;
    return recentAccounts.slice(start, start + ITEMS_PER_PAGE);
  }, [recentAccounts, accountsPage, totalAccountsPages]);

  const paginatedQueue = useMemo(() => {
    const activePage = Math.min(queuePage, totalQueuePages);
    const start = (activePage - 1) * ITEMS_PER_PAGE;
    return submissionsNeedingAttention.slice(start, start + ITEMS_PER_PAGE);
  }, [submissionsNeedingAttention, queuePage, totalQueuePages]);

  const [timePeriod, setTimePeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const { ocrChartData, ocrCurrentTotal, ocrPreviousTotal, ocrChangePercent } = useMemo(() => {
    const history = ocrAnalyticsData?.history || [];
    const now = Date.now();
    const HOUR_MS = 60 * 60 * 1000;
    const DAY_MS = 24 * HOUR_MS;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    let chartData: { label: string; azure: number; ocrSpace: number }[] = [];
    let currentTotal = 0;
    let previousTotal = 0;

    if (timePeriod === 'daily') {
      // Past 7 calendar days, grouped by day
      chartData = Array.from({ length: 7 }, (_, i) => {
        const binStart = todayStartMs - (6 - i) * DAY_MS;
        const binEnd = binStart + DAY_MS;
        const periodEntries = history.filter((t) => t.timestamp >= binStart && t.timestamp < binEnd);
        const azure = periodEntries.filter((e) => e.provider === 'azure').length;
        const ocrSpace = periodEntries.filter((e) => e.provider === 'ocr-space').length;
        const label = new Date(binStart).toLocaleDateString('en-US', { weekday: 'short' });
        return { label, azure, ocrSpace };
      });
      currentTotal = history.filter((t) => t.timestamp >= todayStartMs - 6 * DAY_MS && t.timestamp < todayStartMs + DAY_MS).length;
      previousTotal = history.filter((t) => t.timestamp >= todayStartMs - 13 * DAY_MS && t.timestamp < todayStartMs - 6 * DAY_MS).length;
    } else if (timePeriod === 'weekly') {
      // Past 4 weeks (28 days), grouped by week
      chartData = Array.from({ length: 4 }, (_, i) => {
        const binStart = todayStartMs - (3 - i) * 7 * DAY_MS - 6 * DAY_MS;
        const binEnd = binStart + 7 * DAY_MS;
        const periodEntries = history.filter((t) => t.timestamp >= binStart && t.timestamp < binEnd);
        const azure = periodEntries.filter((e) => e.provider === 'azure').length;
        const ocrSpace = periodEntries.filter((e) => e.provider === 'ocr-space').length;

        const startDate = new Date(binStart);
        const endDate = new Date(binEnd - 1);
        const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = endDate.getMonth() === startDate.getMonth()
          ? endDate.toLocaleDateString('en-US', { day: 'numeric' })
          : endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const label = `${startStr}-${endStr}`;

        return { label, azure, ocrSpace };
      });
      currentTotal = history.filter((t) => t.timestamp >= todayStartMs - 27 * DAY_MS && t.timestamp < todayStartMs + DAY_MS).length;
      previousTotal = history.filter((t) => t.timestamp >= todayStartMs - 55 * DAY_MS && t.timestamp < todayStartMs - 27 * DAY_MS).length;
    } else {
      // Past 6 calendar months, grouped by month
      const tempDate = new Date(todayStartMs);
      const currentMonth = tempDate.getMonth();
      const currentYear = tempDate.getFullYear();

      chartData = Array.from({ length: 6 }, (_, i) => {
        const targetMonthDate = new Date(currentYear, currentMonth - (5 - i), 1);
        const binStart = targetMonthDate.getTime();
        const nextMonthDate = new Date(currentYear, currentMonth - (5 - i) + 1, 1);
        const binEnd = nextMonthDate.getTime();

        const periodEntries = history.filter((t) => t.timestamp >= binStart && t.timestamp < binEnd);
        const azure = periodEntries.filter((e) => e.provider === 'azure').length;
        const ocrSpace = periodEntries.filter((e) => e.provider === 'ocr-space').length;

        const label = targetMonthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        return { label, azure, ocrSpace };
      });

      const startOf6MonthsAgo = new Date(currentYear, currentMonth - 5, 1).getTime();
      const startOf12MonthsAgo = new Date(currentYear, currentMonth - 11, 1).getTime();
      const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 1).getTime();
      currentTotal = history.filter((t) => t.timestamp >= startOf6MonthsAgo && t.timestamp < endOfCurrentMonth).length;
      previousTotal = history.filter((t) => t.timestamp >= startOf12MonthsAgo && t.timestamp < startOf6MonthsAgo).length;
    }

    let changePercent = 0;
    if (previousTotal === 0) {
      changePercent = currentTotal > 0 ? 100 : 0;
    } else {
      changePercent = Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
    }

    return {
      ocrChartData: chartData,
      ocrCurrentTotal: currentTotal,
      ocrPreviousTotal: previousTotal,
      ocrChangePercent: changePercent,
    };
  }, [ocrAnalyticsData, timePeriod]);

  if (loading) {
    return <PortalPageSkeleton variant="dashboard" />;
  }



  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-5 sm:space-y-8">
      <PortalPageIntro
        className="border-none bg-transparent p-0 sm:p-0 shadow-none"
        title={`Welcome to ClinicKa! ${displayName}.`}
      />

      {/* OCR Service Analytics (First full-width card with internal grid layout) */}
      <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6">
        {/* Header with Title and Pills Selector */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <ScanText className="h-5 w-5 text-primary animate-pulse" />
              OCR Service Analytics
            </h2>
          </div>
          <div className="flex rounded-lg bg-surface-container-low p-0.5 self-start sm:self-auto">
            {(['daily', 'weekly', 'monthly'] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setTimePeriod(period)}
                className={`rounded-[6px] px-3 py-1 text-xs font-semibold capitalize transition-all duration-200 cursor-pointer ${
                  timePeriod === period
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* Small Stats Card above the graph */}
        <div className="mb-5 inline-flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 sm:p-3.5 pr-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary">
            <ScanText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-on-surface-variant/80">
                Total OCR Calls
              </span>
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  ocrChangePercent > 0
                    ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : ocrChangePercent < 0
                      ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                      : 'bg-surface-variant text-on-surface-variant'
                }`}
              >
                {ocrChangePercent > 0 ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : ocrChangePercent < 0 ? (
                  <TrendingDown className="h-2.5 w-2.5" />
                ) : (
                  <Clock className="h-2.5 w-2.5" />
                )}
                {ocrChangePercent > 0 ? '+' : ''}
                {ocrChangePercent}%
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-0.5">
              <span className="text-2xl font-black text-on-surface leading-none">{ocrCurrentTotal}</span>
              <span className="text-[11px] text-on-surface-variant/75 font-medium">
                {timePeriod === 'daily'
                  ? 'past 7 days'
                  : timePeriod === 'weekly'
                    ? 'past 4 weeks'
                    : 'past 6 months'}{' '}
                (vs. {ocrPreviousTotal} {timePeriod === 'daily' ? 'last week' : timePeriod === 'weekly' ? 'previous 4 weeks' : 'previous 6 months'})
              </span>
            </div>
          </div>
        </div>

        {/* Recharts Area/Line Chart */}
        <div className="min-h-0 rounded-[14px] border border-dashed border-outline-variant/30 bg-surface-container-low/40 px-2 py-4 sm:px-3">
          <div className="flex h-[17rem] flex-col w-full min-w-0">
            <div className="mb-2 px-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/80">
                Usage Volume Trend ({timePeriod === 'daily' ? 'Daily' : timePeriod === 'weekly' ? 'Weekly' : 'Monthly'})
              </span>
              <div className="flex gap-3">
                <div className="flex items-center gap-1 text-[9px] font-semibold text-on-surface-variant">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
                  Azure AI Vision
                </div>
                <div className="flex items-center gap-1 text-[9px] font-semibold text-on-surface-variant">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                  OCR.space
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={ocrChartData}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="azureGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="ocrSpaceGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--outline-variant)" strokeOpacity={0.45} vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#3d4a3f', fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#3d4a3f', fontSize: 10 }}
                    allowDecimals={false}
                    domain={[0, (dataMax: number) => Math.max(1, Number(dataMax) || 0)]}
                  />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (active && payload && payload.length) {
                        const total = payload.reduce((sum: number, entry: any) => sum + Number(entry.value || 0), 0);
                        return (
                          <div className="rounded-[18px] border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5 shadow-sm min-w-[10rem] space-y-2">
                            <p className="text-[10px] font-semibold text-on-surface-variant">{label}</p>
                            <div className="space-y-1">
                              {payload.map((entry: any) => (
                                <div key={entry.name} className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-1.5 text-on-surface-variant font-medium">
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    {entry.name}
                                  </span>
                                  <span className="font-bold text-on-surface">
                                    {entry.value}
                                  </span>
                                </div>
                              ))}
                              <div className="border-t border-outline-variant/30 mt-1.5 pt-1.5 flex items-center justify-between text-xs font-bold">
                                <span className="text-on-surface-variant">Total</span>
                                <span className="text-primary">{total}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ stroke: '#12b76a', strokeOpacity: 0.16 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="azure"
                    name="Azure OCR"
                    stroke="#3b82f6"
                    strokeWidth={2.25}
                    fill="url(#azureGradient)"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ocrSpace"
                    name="OCR.space"
                    stroke="#10b981"
                    strokeWidth={2.25}
                    fill="url(#ocrSpaceGradient)"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard lists stacked vertically */}
      <div className="space-y-5 sm:space-y-6">
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
          {/* Staff Activity Logs */}
          <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-on-surface">Staff Activity Logs</h2>
              </div>

              {staffActions.length === 0 ? (
                <div className="py-10 text-center text-sm text-on-surface-variant">
                  No staff activities logged yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {paginatedStaffActions.map((sub) => {
                    const studentName = `${sub.firstName} ${sub.lastName}`.trim() || 'Unknown Student';
                    const staffName = sub.reviewedByName || 'Clinic Staff';
                    const position = sub.reviewedByPosition || 'Staff';

                    // Resolve styles and icons based on status
                    let icon = <Clock className="h-4 w-4" />;
                    let iconStyles = 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400';
                    let actionText = '';

                    if (sub.status === 'approved') {
                      icon = <CheckCircle2 className="h-4 w-4" />;
                      iconStyles = 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400';
                      actionText = `cleared / approved ${studentName}`;
                    } else if (sub.status === 'returned') {
                      icon = <ShieldAlert className="h-4 w-4" />;
                      iconStyles = 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400';
                      actionText = `declined / returned ${studentName}`;
                    } else {
                      // e.g. in_review
                      icon = <Clock className="h-4 w-4" />;
                      iconStyles = 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400';
                      actionText = `started reviewing ${studentName}`;
                    }

                    return (
                      <div key={sub.id} className="flex gap-3 items-start text-xs border-b border-outline-variant/10 pb-3 last:border-0 last:pb-0 animate-fade-in">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${iconStyles}`}>
                          {icon}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-on-surface truncate">
                              {staffName}
                            </span>
                            <span className="text-[10px] text-on-surface-variant/70 shrink-0">
                              {formatDate(sub.updatedAt || sub.submittedAt)}
                            </span>
                          </div>
                          <p className="text-[10px] text-on-surface-variant/80 font-medium">
                            {position}
                          </p>
                          <p className="text-on-surface-variant leading-relaxed mt-1">
                            {actionText}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {staffActions.length > 0 && (
              <ListPagination
                currentPage={Math.min(logsPage, totalLogsPages)}
                totalPages={totalLogsPages}
                totalItems={staffActions.length}
                pageSize={10}
                pageSizeOptions={[10]}
                itemLabel="logs"
                onPageChange={setLogsPage}
                onPageSizeChange={() => {}}
              />
            )}
          </div>

          {/* Recent Account Activity */}
          <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-on-surface">Recent Account Activity</h2>
                </div>
                <button
                  onClick={() => navigate('/admin/users')}
                  className="w-full rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary/80 sm:w-auto sm:border-none sm:bg-transparent sm:px-0 sm:py-0"
                >
                  View Users
                </button>
              </div>

              {recentAccounts.length === 0 ? (
                <div className="py-10 text-center text-sm text-on-surface-variant">
                  No account activity available.
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedRecentAccounts.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col gap-3 rounded-[18px] border border-outline-variant/20 bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container-low sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-primary">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-on-surface">{user.name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {user.role} | {user.status}
                        </p>
                      </div>
                      <p className="text-left text-xs text-on-surface-variant sm:text-right">
                        {formatDateTime(user.lastActive)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {recentAccounts.length > 0 && (
              <ListPagination
                currentPage={Math.min(accountsPage, totalAccountsPages)}
                totalPages={totalAccountsPages}
                totalItems={recentAccounts.length}
                pageSize={10}
                pageSizeOptions={[10]}
                itemLabel="accounts"
                onPageChange={setAccountsPage}
                onPageSizeChange={() => {}}
              />
            )}
          </div>
        </div>

        {/* Admin Action Queue */}
        <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Admin Action Queue</h2>
            </div>
            <button
              onClick={() => navigate('/admin/reports')}
              className="w-full rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary/80 sm:w-auto sm:border-none sm:bg-transparent sm:px-0 sm:py-0"
            >
              Open Reports
            </button>
          </div>

          {submissionsNeedingAttention.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-[18px] border border-dashed border-outline-variant/40 bg-surface-container-low px-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="mt-4 text-lg font-semibold text-on-surface">No escalations right now</p>
              <p className="mt-2 max-w-sm text-sm text-on-surface-variant">
                Pending and returned cases are currently clear or minimal.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedQueue.map((submission) => (
                <div
                  key={submission.id}
                  className="flex flex-col gap-3 rounded-[18px] border border-outline-variant/20 bg-surface-container-lowest p-4 sm:flex-row sm:items-start sm:gap-4"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[18px] bg-surface-container text-primary sm:h-12 sm:w-12">
                    <ShieldAlert className="h-5 w-5" />
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
                      {submission.studentId || '--'} | {submission.course || 'Course unavailable'}
                    </p>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      Submitted {formatDate(submission.submittedAt)}
                    </p>
                  </div>
                </div>
              ))}

              <ListPagination
                currentPage={Math.min(queuePage, totalQueuePages)}
                totalPages={totalQueuePages}
                totalItems={submissionsNeedingAttention.length}
                pageSize={10}
                pageSizeOptions={[10]}
                itemLabel="submissions"
                onPageChange={setQueuePage}
                onPageSizeChange={() => {}}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
