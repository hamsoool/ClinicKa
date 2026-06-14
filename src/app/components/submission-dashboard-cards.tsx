import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Menu } from 'lucide-react';
import type { StudentAccountSummary, SubmissionRecord, SubmissionStatus } from '../lib/record-types';
import { getYearLevelLabel } from '../lib/student-year';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

type AnalyticsView = 'year' | 'gender' | 'department';

type AnalyticsSeries = {
  key: string;
  rawValue: string;
  label: string;
  color: string;
};

type AnalyticsDatum = {
  month: string;
  monthKey: string;
  [key: string]: string | number;
};

type DonutSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type StatusMetricKey = 'pending' | 'returned' | 'noAction' | 'approved';

type StatusMetric = {
  key: StatusMetricKey;
  label: string;
  value: number;
  previousValue: number;
  changePercent: number;
};

type SubmissionDashboardCardsProps = {
  isError?: boolean;
  isLoading?: boolean;
  registeredStudents?: StudentAccountSummary[];
  submissions?: SubmissionRecord[];
};

type NoActionStudent = StudentAccountSummary & {
  noActionAt?: string;
  source: 'idle' | 'returned';
};

const ANALYTICS_VIEW_LABELS: Record<AnalyticsView, string> = {
  year: 'Year Level',
  gender: 'Gender (Sex at birth)',
  department: 'Department',
};

const SERIES_COLORS = ['#006d3c', '#12b76a', '#3d8f66', '#85cfa4', '#5d7c68', '#e5a93a', '#d26d6d', '#6d7b6e'];
const STATUS_SEGMENT_COLORS = {
  submissions: '#006d3c',
  pending: '#e5a93a',
  returned: '#d26d6d',
  noAction: '#6d7b6e',
} as const;
const STATUS_METRIC_LABELS: Record<StatusMetricKey, string> = {
  approved: 'Approved Clearance',
  pending: 'Pending',
  returned: 'Returned',
  noAction: 'No Action Taken',
};

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

function formatNumber(value?: number) {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function normalizeSeriesKey(view: AnalyticsView, value: string) {
  const normalizedValue = String(value || 'unspecified')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${view}-${normalizedValue || 'unspecified'}`;
}

function normalizeGenderValue(value?: string, includeFallback = true) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return includeFallback ? 'unspecified' : '';
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

function getSubmissionGroupValue(submission: SubmissionRecord, view: AnalyticsView, includeFallback = true) {
  if (view === 'year') {
    const value = String(submission.year || submission.studentYearLevel || '').trim();
    return value || (includeFallback ? 'unspecified' : '');
  }

  if (view === 'gender') {
    return normalizeGenderValue(submission.sex, includeFallback);
  }

  const department = String(submission.department || '').trim().toUpperCase();
  if (department) return department;

  return includeFallback ? 'Unspecified' : '';
}

function getSubmissionGroupLabel(value: string, view: AnalyticsView) {
  if (view === 'year') {
    return value === 'unspecified' ? 'Unspecified' : getYearLevelLabel(value);
  }

  if (view === 'gender') {
    return formatGenderLabel(value);
  }

  return value || 'Unspecified';
}

function getSeriesForView(submissions: SubmissionRecord[], view: AnalyticsView) {
  const values = new Set(
    submissions
      .map((submission) => getSubmissionGroupValue(submission, view))
      .filter(Boolean),
  );

  return [...values]
    .sort((a, b) => {
      if (a === 'unspecified') return 1;
      if (b === 'unspecified') return -1;

      if (view === 'year') {
        return Number.parseInt(a, 10) - Number.parseInt(b, 10);
      }

      return a.localeCompare(b);
    })
    .map((value, index) => ({
      key: normalizeSeriesKey(view, value),
      rawValue: value,
      label: getSubmissionGroupLabel(value, view),
      color: SERIES_COLORS[index % SERIES_COLORS.length],
    }));
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getChartMonths(submissions: SubmissionRecord[]) {
  const latestTimestamp = submissions.reduce((latest, submission) => {
    const timestamp = new Date(submission.submittedAt || '').getTime();
    if (Number.isNaN(timestamp)) return latest;
    return Math.max(latest, timestamp);
  }, 0);
  const latestDate = latestTimestamp > 0 ? new Date(latestTimestamp) : new Date();
  const latestMonth = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);

  return Array.from({ length: 7 }, (_, index) => (
    new Date(latestMonth.getFullYear(), latestMonth.getMonth() - 6 + index, 1)
  ));
}

function getValidTimestamp(value?: string) {
  const timestamp = new Date(value || '').getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getStudentKey(value?: string) {
  return String(value || '').trim();
}

function getReturnedAt(submission: SubmissionRecord) {
  return submission.updatedAt || submission.submittedAt || '';
}

function buildNoActionStudents(
  submissions: SubmissionRecord[],
  registeredStudents: StudentAccountSummary[],
): NoActionStudent[] {
  const registeredByStudentId = new Map<string, StudentAccountSummary>();
  const submittedStudentIds = new Set<string>();
  const returnedByStudentId = new Map<string, SubmissionRecord>();

  registeredStudents.forEach((student) => {
    const studentId = getStudentKey(student.studentId);
    if (!studentId) return;
    registeredByStudentId.set(studentId, student);
  });

  submissions.forEach((submission) => {
    const studentId = getStudentKey(submission.studentId);
    if (!studentId) return;
    submittedStudentIds.add(studentId);

    const status = String(submission.status || '').trim().toLowerCase();
    if (!isStatus(status, ['returned'])) return;

    const existing = returnedByStudentId.get(studentId);
    if (!existing || getValidTimestamp(getReturnedAt(submission)) > getValidTimestamp(getReturnedAt(existing))) {
      returnedByStudentId.set(studentId, submission);
    }
  });

  const noActionByStudentId = new Map<string, NoActionStudent>();

  registeredStudents.forEach((student) => {
    const studentId = getStudentKey(student.studentId);
    if (!studentId || submittedStudentIds.has(studentId)) return;

    noActionByStudentId.set(studentId, {
      ...student,
      noActionAt: student.registeredAt,
      source: 'idle',
    });
  });

  returnedByStudentId.forEach((submission, studentId) => {
    const registeredStudent = registeredByStudentId.get(studentId);

    noActionByStudentId.set(studentId, {
      studentId,
      profileId: registeredStudent?.profileId,
      firstName: registeredStudent?.firstName,
      lastName: registeredStudent?.lastName,
      department: registeredStudent?.department || submission.department,
      course: registeredStudent?.course || submission.course,
      year: registeredStudent?.year || submission.year,
      studentYearLevel: registeredStudent?.studentYearLevel || submission.studentYearLevel || submission.year,
      sex: registeredStudent?.sex || submission.sex,
      registeredAt: registeredStudent?.registeredAt,
      noActionAt: getReturnedAt(submission) || registeredStudent?.registeredAt,
      source: 'returned',
    });
  });

  return [...noActionByStudentId.values()];
}

function buildAnalyticsData(submissions: SubmissionRecord[], view: AnalyticsView, series: AnalyticsSeries[]) {
  const rows = getChartMonths(submissions).map((date) => {
    const row: AnalyticsDatum = {
      month: monthFormatter.format(date),
      monthKey: getMonthKey(date),
    };

    series.forEach((item) => {
      row[item.key] = 0;
    });

    return row;
  });
  const rowByMonth = new Map(rows.map((row) => [row.monthKey, row]));
  const seriesKeyByValue = new Map(series.map((item) => [item.rawValue, item.key]));

  submissions.forEach((submission) => {
    const submittedAt = new Date(submission.submittedAt || '');
    if (Number.isNaN(submittedAt.getTime())) return;

    const row = rowByMonth.get(getMonthKey(submittedAt));
    if (!row) return;

    const groupValue = getSubmissionGroupValue(submission, view);
    const seriesKey = seriesKeyByValue.get(groupValue);
    if (!seriesKey) return;

    row[seriesKey] = Number(row[seriesKey] || 0) + 1;
  });

  return rows;
}

function isStatus(status: string, expected: SubmissionStatus[]) {
  return expected.includes(status as SubmissionStatus);
}

function getStatusMetricKey(status: string): StatusMetricKey | null {
  if (isStatus(status, ['pending', 'in_review'])) return 'pending';
  if (isStatus(status, ['returned'])) return 'returned';
  if (isStatus(status, ['approved'])) return 'approved';
  return null;
}

function getChangePercent(value: number, previousValue: number) {
  if (previousValue === 0) {
    return value === 0 ? 0 : 100;
  }

  return ((value - previousValue) / previousValue) * 100;
}

function buildStatusMetrics(submissions: SubmissionRecord[], noActionStudents: NoActionStudent[]) {
  const chartMonths = getChartMonths(submissions);
  const currentMonthKey = getMonthKey(chartMonths[chartMonths.length - 1] || new Date());
  const previousMonthKey = getMonthKey(chartMonths[chartMonths.length - 2] || new Date());
  const currentMonthStart = chartMonths[chartMonths.length - 1] || new Date();
  const counts = {
    pending: { value: 0, previousValue: 0 },
    returned: { value: 0, previousValue: 0 },
    noAction: { value: noActionStudents.length, previousValue: 0 },
    approved: { value: 0, previousValue: 0 },
  };

  submissions.forEach((submission) => {
    const submittedAt = new Date(submission.submittedAt || '');
    if (Number.isNaN(submittedAt.getTime())) return;

    const metricKey = getStatusMetricKey(String(submission.status || '').trim().toLowerCase());
    if (!metricKey) return;

    const monthKey = getMonthKey(submittedAt);
    if (monthKey === currentMonthKey) {
      counts[metricKey].value += 1;
    } else if (monthKey === previousMonthKey) {
      counts[metricKey].previousValue += 1;
    }
  });

  counts.noAction.previousValue = noActionStudents.filter((student) => {
    const timestamp = getValidTimestamp(student.noActionAt || student.registeredAt);
    return !timestamp || timestamp < currentMonthStart.getTime();
  }).length;

  return (Object.keys(STATUS_METRIC_LABELS) as StatusMetricKey[]).map((key) => ({
    key,
    label: STATUS_METRIC_LABELS[key],
    value: counts[key].value,
    previousValue: counts[key].previousValue,
    changePercent: getChangePercent(counts[key].value, counts[key].previousValue),
  }));
}

function buildDonutData(submissions: SubmissionRecord[], noActionStudents: NoActionStudent[]) {
  const counts = submissions.reduce(
    (acc, submission) => {
      const status = String(submission.status || '').trim().toLowerCase();

      if (!status || isStatus(status, ['pending', 'in_review', 'resubmitted'])) {
        acc.pending += 1;
      } else if (isStatus(status, ['returned'])) {
        acc.returned += 1;
      } else {
        acc.submissions += 1;
      }

      return acc;
    },
    {
      submissions: 0,
      pending: 0,
      returned: 0,
      noAction: noActionStudents.filter((student) => student.source === 'idle').length,
    },
  );

  return [
    { key: 'submissions', label: 'Cleared', value: counts.submissions, color: STATUS_SEGMENT_COLORS.submissions },
    { key: 'pending', label: 'Pending', value: counts.pending, color: STATUS_SEGMENT_COLORS.pending },
    { key: 'returned', label: 'Returned', value: counts.returned, color: STATUS_SEGMENT_COLORS.returned },
    { key: 'noAction', label: 'No Action Taken', value: counts.noAction, color: STATUS_SEGMENT_COLORS.noAction },
  ];
}

function hasAnalyticsValues(data: AnalyticsDatum[], series: AnalyticsSeries[]) {
  return data.some((row) => series.some((item) => Number(row[item.key] || 0) > 0));
}

type SubmissionAreaTooltipProps = TooltipProps<number, string> & {
  hoveredSeriesKey: string | null;
};

function SubmissionAreaTooltip({ active, label, payload, hoveredSeriesKey }: SubmissionAreaTooltipProps) {
  const entry = hoveredSeriesKey
    ? payload?.find((item) => String(item.dataKey) === hoveredSeriesKey)
    : undefined;

  if (!active || !entry) {
    return null;
  }

  return (
    <div className="rounded-[18px] border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 shadow-sm">
      <p className="text-sm font-semibold text-on-surface">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-5 text-xs">
        <span className="flex items-center gap-2 text-on-surface-variant">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color || '#006d3c' }}
          />
          {entry.name}
        </span>
        <span className="font-semibold text-on-surface">{formatNumber(Number(entry.value || 0))}</span>
      </div>
    </div>
  );
}

function SubmissionDonutTooltip({ active, payload }: TooltipProps<number, string>) {
  const entry = payload?.[0]?.payload as DonutSegment | undefined;

  if (!active || !entry) {
    return null;
  }

  return (
    <div className="min-w-32 rounded-[18px] border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 shadow-sm">
      <p className="whitespace-nowrap text-sm font-semibold text-on-surface">{entry.label}</p>
      <p className="mt-1 text-xs text-on-surface-variant">{formatNumber(entry.value)} records</p>
    </div>
  );
}

export default function SubmissionDashboardCards({
  isError = false,
  isLoading = false,
  registeredStudents = [],
  submissions = [],
}: SubmissionDashboardCardsProps) {
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>('year');
  const [hoveredSeriesKey, setHoveredSeriesKey] = useState<string | null>(null);

  const selectedSeries = useMemo(
    () => getSeriesForView(submissions, analyticsView),
    [analyticsView, submissions],
  );
  const selectedAnalyticsData = useMemo(
    () => buildAnalyticsData(submissions, analyticsView, selectedSeries),
    [analyticsView, selectedSeries, submissions],
  );
  const noActionStudents = useMemo(
    () => buildNoActionStudents(submissions, registeredStudents),
    [registeredStudents, submissions],
  );
  const selectedDonutData = useMemo(
    () => buildDonutData(submissions, noActionStudents),
    [noActionStudents, submissions],
  );
  const statusMetrics = useMemo(
    () => buildStatusMetrics(submissions, noActionStudents),
    [noActionStudents, submissions],
  );
  const donutTotal = useMemo(
    () => selectedDonutData.reduce((total, segment) => total + segment.value, 0),
    [selectedDonutData],
  );
  const hasChartData = hasAnalyticsValues(selectedAnalyticsData, selectedSeries);
  const hasDonutData = donutTotal > 0;

  return (
    <div className="grid min-w-0 gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(21rem,0.65fr)]">
      <section className="box-border flex min-h-[27rem] w-full min-w-0 flex-col rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">Submission Analytics</h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Monthly records by {ANALYTICS_VIEW_LABELS[analyticsView].toLowerCase()}.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Change analytics grouping"
                title="Change analytics grouping"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/50 bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                <Menu className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuRadioGroup
                value={analyticsView}
                onValueChange={(value) => {
                  setHoveredSeriesKey(null);
                  setAnalyticsView(value as AnalyticsView);
                }}
              >
                <DropdownMenuRadioItem value="year" className="rounded-[12px]">
                  Year Level
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="gender" className="rounded-[12px]">
                  Gender (Sex at birth)
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="department" className="rounded-[12px]">
                  Department
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-4">
          {statusMetrics.map((metric) => (
            <div
              key={metric.key}
              className="rounded-[18px] border border-outline-variant/25 bg-surface-container-low px-4 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                {metric.label}
              </p>
              <div className="mt-3">
                <p className="text-2xl font-bold leading-none text-on-surface">{formatNumber(metric.value)}</p>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-on-surface-variant">
                <span>vs last month</span>
                <span className="rounded-full bg-surface-container-lowest px-2 py-1 text-xs font-semibold text-on-surface-variant">
                  {formatPercent(metric.changePercent)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 rounded-[18px] border border-dashed border-outline-variant/30 bg-surface-container-low/40 px-2 py-4 sm:px-4">
          {isLoading ? (
            <div className="flex h-[19rem] items-center justify-center text-sm text-on-surface-variant">
              Loading submission analytics...
            </div>
          ) : isError ? (
            <div className="flex h-[19rem] flex-col items-center justify-center text-center">
              <p className="text-lg font-semibold text-on-surface">Unable to load submission data</p>
              <p className="mt-2 max-w-xs text-sm text-on-surface-variant">
                Check the database connection and report permissions.
              </p>
            </div>
          ) : !hasChartData ? (
            <div className="flex h-[19rem] flex-col items-center justify-center text-center">
              <p className="text-lg font-semibold text-on-surface">No submission data yet</p>
              <p className="mt-2 max-w-xs text-sm text-on-surface-variant">
                This chart will populate when matching records exist in the database.
              </p>
            </div>
          ) : (
            <div className="h-[19rem] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={selectedAnalyticsData}
                  margin={{ top: 16, right: 14, left: -18, bottom: 0 }}
                  onMouseLeave={() => setHoveredSeriesKey(null)}
                >
                  <defs>
                    {selectedSeries.map((series) => (
                      <linearGradient key={series.key} id={`submission-${series.key}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor={series.color} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={series.color} stopOpacity={0.03} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke="var(--outline-variant)" strokeOpacity={0.55} vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#3d4a3f', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#3d4a3f', fontSize: 12 }}
                    allowDecimals={false}
                    domain={[0, (dataMax: number) => Math.max(1, Number(dataMax) || 0)]}
                  />
                  <Tooltip
                    content={<SubmissionAreaTooltip hoveredSeriesKey={hoveredSeriesKey} />}
                    cursor={{ stroke: '#006d3c', strokeOpacity: 0.16 }}
                  />
                  {selectedSeries.map((series) => {
                    const isDimmed = Boolean(hoveredSeriesKey && hoveredSeriesKey !== series.key);

                    return (
                      <Area
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        name={series.label}
                        stroke={series.color}
                        strokeOpacity={isDimmed ? 0.3 : 1}
                        strokeWidth={hoveredSeriesKey === series.key ? 3 : 2.25}
                        fill={`url(#submission-${series.key})`}
                        fillOpacity={isDimmed ? 0.18 : 1}
                        activeDot={hoveredSeriesKey === series.key ? { r: 4, strokeWidth: 2, stroke: '#ffffff' } : false}
                        onMouseEnter={() => setHoveredSeriesKey(series.key)}
                        onMouseLeave={() => setHoveredSeriesKey(null)}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {selectedSeries.map((series) => (
            <div key={series.key} className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
              {series.label}
            </div>
          ))}
        </div>
      </section>

      <section className="box-border flex min-h-[27rem] w-full min-w-0 flex-col rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">Cleared</h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Status mix for records and idle student accounts.
            </p>
          </div>
        </div>

        <div className="relative mx-auto flex h-64 w-full max-w-[18rem] items-center justify-center">
          {isLoading ? (
            <p className="text-sm text-on-surface-variant">Loading submissions...</p>
          ) : isError ? (
            <div className="text-center">
              <p className="text-lg font-semibold text-on-surface">Unable to load</p>
              <p className="mt-2 text-sm text-on-surface-variant">Database totals could not be fetched.</p>
            </div>
          ) : !hasDonutData ? (
            <div className="text-center">
              <p className="text-lg font-semibold text-on-surface">No records</p>
              <p className="mt-2 text-sm text-on-surface-variant">Database totals will appear here.</p>
            </div>
          ) : (
            <>
              <div className="relative z-10 h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    allowEscapeViewBox={{ x: true, y: true }}
                    content={<SubmissionDonutTooltip />}
                    offset={14}
                    wrapperStyle={{ zIndex: 30, pointerEvents: 'none', outline: 'none' }}
                  />
                  <Pie
                    data={selectedDonutData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="82%"
                    cornerRadius={8}
                    paddingAngle={4}
                    stroke="#ffffff"
                    strokeWidth={4}
                  >
                    {selectedDonutData.map((segment) => (
                      <Cell key={segment.key} fill={segment.color} />
                    ))}
                  </Pie>
                </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold leading-none text-on-surface">{formatNumber(donutTotal)}</span>
                <span className="mt-1 text-xs font-medium text-on-surface-variant">Total</span>
              </div>
            </>
          )}
        </div>

        <div className="mt-auto space-y-3 pt-4">
          {selectedDonutData.map((segment) => {
            const percent = donutTotal > 0 ? Math.round((segment.value / donutTotal) * 100) : 0;

            return (
              <div key={segment.key} className="rounded-[18px] border border-outline-variant/20 bg-surface-container-low px-3 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-on-surface">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                    <span className="truncate">{segment.label}</span>
                  </span>
                  <span className="font-semibold text-on-surface">{formatNumber(segment.value)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent}%`, backgroundColor: segment.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
