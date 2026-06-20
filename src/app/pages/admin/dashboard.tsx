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
  UserCog,
  Users,
} from 'lucide-react';
import PortalPageIntro from '../../components/portal-page-intro';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import { useAuth } from '../../lib/auth';
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
  status: 'pending' | 'in_review' | 'approved' | 'returned';
  course?: string;
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
  } = useMemo(() => {
    const admin = userAccounts.filter((user) => user.role === 'Administrator').length;
    const clinicStaff = userAccounts.filter((user) => user.role === 'Clinic Staff').length;
    const students = userAccounts.filter((user) => user.role === 'Student').length;
    const recent = [...userAccounts]
      .filter((user) => user.lastActive)
      .sort((a, b) => new Date(b.lastActive || 0).getTime() - new Date(a.lastActive || 0).getTime())
      .slice(0, 5);
    const queue = [...submissions]
      .filter((submission) => submission.status === 'pending' || submission.status === 'in_review' || submission.status === 'returned')
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 5);
    return {
      adminCount: admin,
      clinicStaffCount: clinicStaff,
      studentAccounts: students,
      recentAccounts: recent,
      submissionsNeedingAttention: queue,
    };
  }, [submissions, userAccounts]);
  const [timePeriod, setTimePeriod] = useState<'hourly' | 'daily' | 'weekly'>('daily');

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

    if (timePeriod === 'hourly') {
      // Past 24 hours, grouped by hour
      chartData = Array.from({ length: 24 }, (_, i) => {
        const binStart = now - (23 - i) * HOUR_MS;
        const binEnd = binStart + HOUR_MS;
        const periodEntries = history.filter((t) => t.timestamp >= binStart && t.timestamp < binEnd);
        const azure = periodEntries.filter((e) => e.provider === 'azure').length;
        const ocrSpace = periodEntries.filter((e) => e.provider === 'ocr-space').length;
        const label = new Date(binStart).toLocaleTimeString('en-US', { hour: 'numeric' });
        return { label, azure, ocrSpace };
      });
      currentTotal = history.filter((t) => t.timestamp >= now - 24 * HOUR_MS && t.timestamp < now).length;
      previousTotal = history.filter((t) => t.timestamp >= now - 48 * HOUR_MS && t.timestamp < now - 24 * HOUR_MS).length;
    } else if (timePeriod === 'daily') {
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
    } else {
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

  const roleDistribution = [
    { label: 'Students', count: studentAccounts, color: 'bg-primary' },
    { label: 'Clinic Staff', count: clinicStaffCount, color: 'bg-emerald-500' },
    { label: 'Administrators', count: adminCount, color: 'bg-amber-500' },
  ];

  const totalRoleCount = roleDistribution.reduce((sum, role) => sum + role.count, 0) || 1;

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-5 sm:space-y-8">
      <PortalPageIntro
        className="border-none bg-transparent p-0 sm:p-0 shadow-none"
        eyebrow={(
          <div className="inline-flex max-w-full items-center gap-2 self-start rounded-full bg-primary-container/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-on-primary-container sm:text-xs sm:tracking-[0.22em]">
            <ShieldCheck className="h-4 w-4" />
            Admin Control Center
          </div>
        )}
        title={`Welcome to ClinicKa! ${displayName}.`}
      >
        <div className="flex flex-wrap gap-2 text-xs text-on-surface-variant sm:gap-3 sm:text-sm">
          <span className="rounded-full bg-surface-container px-3 py-1.5">
            Total submissions: <span className="font-semibold text-on-surface">{analytics?.totalSubmissions || 0}</span>
          </span>
          <span className="rounded-full bg-surface-container px-3 py-1.5">
            Approved records: <span className="font-semibold text-on-surface">{analytics?.approvedRecords || 0}</span>
          </span>
        </div>
      </PortalPageIntro>

      {/* OCR Service Analytics (First full-width card with internal grid layout) */}
      <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6">
        {/* Header with Title and Pills Selector */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <ScanText className="h-5 w-5 text-primary animate-pulse" />
              OCR Service Analytics
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              History of automated text extraction requests by provider.
            </p>
          </div>
          <div className="flex rounded-lg bg-surface-container-low p-0.5 self-start sm:self-auto">
            {(['hourly', 'daily', 'weekly'] as const).map((period) => (
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
                {timePeriod === 'hourly'
                  ? 'past 24 hours'
                  : timePeriod === 'daily'
                    ? 'past 7 days'
                    : 'past 4 weeks'}{' '}
                (vs. {ocrPreviousTotal} {timePeriod === 'hourly' ? 'yesterday' : timePeriod === 'daily' ? 'last week' : 'last month'})
              </span>
            </div>
          </div>
        </div>

        {/* Recharts Area/Line Chart */}
        <div className="min-h-0 rounded-[14px] border border-dashed border-outline-variant/30 bg-surface-container-low/40 px-2 py-4 sm:px-3">
          <div className="flex h-[17rem] flex-col w-full min-w-0">
            <div className="mb-2 px-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/80">
                Usage Volume Trend ({timePeriod === 'hourly' ? 'Hourly' : timePeriod === 'daily' ? 'Daily' : 'Weekly'})
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
                    stackId="1"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ocrSpace"
                    name="OCR.space"
                    stroke="#10b981"
                    strokeWidth={2.25}
                    fill="url(#ocrSpaceGradient)"
                    stackId="1"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column Grid for queue and lists */}
      <div className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.85fr)]">
        {/* Left Column: Queue & Activity stacked */}
        <div className="space-y-5 sm:space-y-6">
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
                {submissionsNeedingAttention.map((submission) => (
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
              </div>
            )}
          </div>

          {/* Recent Account Activity */}
          <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6">
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
                {recentAccounts.map((user) => (
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
        </div>

        {/* Right Column: Role Distribution */}
        <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6 self-start">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-on-surface">Role Distribution</h2>
          </div>
          <div className="space-y-4">
            {roleDistribution.map((role) => (
              <div key={role.label} className="space-y-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <p className="font-medium text-on-surface">{role.label}</p>
                  <p className="text-on-surface-variant">{role.count}</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                  <div
                    className={`h-full rounded-full ${role.color}`}
                    style={{ width: `${Math.max((role.count / totalRoleCount) * 100, role.count > 0 ? 8 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 min-[440px]:grid-cols-2">
            <button
              onClick={() => navigate('/admin/users?role=clinic-staff')}
              className="flex items-center justify-between rounded-[18px] border border-outline-variant/30 bg-surface-container-low px-4 py-4 text-left transition-colors hover:bg-surface-container"
            >
              <div>
                <p className="text-sm font-semibold text-on-surface">Clinic Staff Accounts</p>
              </div>
              <UserCog className="h-5 w-5 text-primary" />
            </button>
            <button
              onClick={() => navigate('/admin/users')}
              className="flex items-center justify-between rounded-[18px] border border-outline-variant/30 bg-surface-container-low px-4 py-4 text-left transition-colors hover:bg-surface-container"
            >
              <div>
                <p className="text-sm font-semibold text-on-surface">Review Accounts</p>
              </div>
              <Users className="h-5 w-5 text-primary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
