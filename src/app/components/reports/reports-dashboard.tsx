import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PortalPageIntro from '../portal-page-intro';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Download, TrendingUp, Clock, Award, Users, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { getActiveAjaxRefetchInterval } from '../../lib/ajax-refresh';
import {
  BarChart,
  Bar,
  LabelList,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  createDefaultAdminSystemSettings,
  getAnalytics,
  getReportingTermSettings,
  getSubmissions,
  type AdminSystemSettings,
} from '../../lib/api';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
const REPORTING_TERM_REFRESH_INTERVAL_MS = 180_000;
const YEAR_LABELS: Record<string, string> = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' };
const YEAR_LEVEL_ORDER = ['1', '2', '3', '4'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  returned: 'Returned',
  physical_exam_done: 'Physical Exam Done',
};
const CERTIFICATE_LABELS: Record<string, string> = { all: 'All Certificates', issued: 'Issued Only', not_issued: 'Not Issued' };
const STATUS_COLORS: Record<string, string> = {
  Approved: '#3b6d11',
  Pending: '#ba7517',
  'In Review': '#2f6fa3',
  Returned: '#a32d2d',
  'Exam Done': '#185fa5',
};
const DEPARTMENT_COLORS: Record<string, string> = {
  CCS: '#f97316',
  CBA: '#facc15',
  CEAS: '#3b82f6',
  CHTM: '#ec4899',
  CAHS: '#ef4444',
};
const YEAR_LEVEL_COLORS: Record<string, string> = {
  '1': '#f97316',
  '2': '#facc15',
  '3': '#3b82f6',
  '4': '#14b8a6',
};
const GENDER_ORDER = ['male', 'female', 'other'];
const GENDER_COLORS: Record<string, string> = {
  male: '#3b82f6',
  female: '#ec4899',
  other: '#8b5cf6',
};

type ReportsSummary = {
  total: number;
  approved: number;
  pending: number;
  inReview: number;
  returned: number;
  physicalExamDone: number;
  firstYears: number;
  firstYearUnderReview: number;
  firstYearNotUnderReview: number;
  withCertificate: number;
  approvalRate: number;
  byCourse: Record<string, number>;
};

type SubmissionBreakdownView = 'department' | 'program' | 'year' | 'gender';
type DateRangePreset = 'today' | 'lastWeek' | 'lastMonth' | 'schoolYear';
type SubmissionBreakdownDatum = {
  label: string;
  count: number;
  fill: string;
};
type ReportingTermRange = {
  label: string;
  startMs: number;
  endMs: number;
};
type ProgramChartAccumulator = Record<
  string,
  {
    count: number;
    department: string;
  }
>;

function normalizeCourseValue(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function resolveDepartmentValue(department?: string, course?: string) {
  const normalizedDepartment = String(department || '').trim().toUpperCase();
  if (DEPARTMENTS.includes(normalizedDepartment)) return normalizedDepartment;

  const normalizedCourse = String(course || '').trim().toUpperCase();
  const matchedDepartment = DEPARTMENTS.find((item) => normalizedCourse.includes(item));
  if (matchedDepartment) return matchedDepartment;

  return normalizedDepartment;
}

function abbreviateCourse(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '-';

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

function normalizeSubmissionGenderValue(value?: string) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'm' || normalized === 'male') return 'male';
  if (normalized === 'f' || normalized === 'female') return 'female';
  if (['other', 'others', 'non-binary', 'nonbinary'].includes(normalized)) return 'other';
  return normalized;
}

function formatSubmissionBreakdownLabel(view: SubmissionBreakdownView) {
  switch (view) {
    case 'department':
      return 'Department';
    case 'program':
      return 'Program';
    case 'year':
      return 'Year Level';
    case 'gender':
      return 'Gender';
    default:
      return 'Department';
  }
}

function formatGenderLabel(value: string) {
  if (!value) return 'Unspecified';
  if (value === 'male') return 'Male';
  if (value === 'female') return 'Female';
  if (value === 'other') return 'Other';
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalDateStartTimestamp(value?: string) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return Number.NaN;
  const [year, month, day] = raw.split('-').map((part) => Number(part));
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

function getLocalDateEndTimestamp(value?: string) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return Number.NaN;
  const [year, month, day] = raw.split('-').map((part) => Number(part));
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function getDateDaysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function clampDateToToday(date: Date) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date.getTime() > today.getTime() ? today : date;
}

function buildReportingTermRange(settings: AdminSystemSettings): ReportingTermRange {
  const [startYearValue, endYearValue] = String(settings.academicYear || '').split('-');
  const startYear = Number.parseInt(startYearValue || '', 10);
  const endYear = Number.parseInt(endYearValue || '', 10);

  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
    return buildReportingTermRange(createDefaultAdminSystemSettings());
  }

  return {
    label: settings.academicYear,
    startMs: Date.UTC(startYear, 6, 1),
    endMs: Date.UTC(endYear, 6, 1),
  };
}

async function imagePathToDataUrl(path: string, options?: { maxDimension?: number }) {
  const maxDimension = options?.maxDimension ?? 480;
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;
      const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
      canvas.width = Math.max(1, Math.round(srcW * scale));
      canvas.height = Math.max(1, Math.round(srcH * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to prepare image canvas'));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
    img.src = path;
  });
}

async function buildPdfWithAutoTable(
  jsPDFModule: any,
  autoTableModule: any,
  summaryRows: Array<{ label: string; value: string }>,
  studentRows: Array<{ fullName: string; studentId: string; course: string; year: string; status: string; submitted: string; certificate: string }>,
  reportTitle: string,
  filters: Array<{ label: string; value: string }>,
) {
  const { jsPDF } = jsPDFModule;
  const autoTable = autoTableModule.default;

  // Initialize PDF
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = margin;

  // Set colors and fonts
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);

  // ── Header with logos ──
  try {
    const [gcLogo, acadLogo, hsuLogo] = await Promise.all([
      imagePathToDataUrl('/gordon-college-logo.png', { maxDimension: 256 }),
      imagePathToDataUrl('/gordon_college_academicaffairs.png', { maxDimension: 256 }),
      imagePathToDataUrl('/gordonhsc.png', { maxDimension: 256 }),
    ]);

    const logoSize = 12;
    doc.addImage(gcLogo, 'PNG', margin, currentY, logoSize, logoSize);
    doc.addImage(acadLogo, 'PNG', margin + 15, currentY, logoSize, logoSize);
    doc.addImage(hsuLogo, 'PNG', margin + 30, currentY, logoSize, logoSize);
  } catch (err) {
    console.warn('Failed to load logos:', err);
  }

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle, margin + 50, currentY + 5);

  // Subtitle
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin + 50, currentY + 12);

  currentY = 45;

  // ── Applied Filters Section ──
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Applied Filters', margin, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const filterTableData: string[][] = [];
  for (let i = 0; i < filters.length; i += 2) {
    const row: string[] = [];
    if (filters[i]) row.push(`${filters[i].label}: ${filters[i].value}`);
    else row.push('');
    if (filters[i + 1]) row.push(`${filters[i + 1].label}: ${filters[i + 1].value}`);
    else row.push('');
    filterTableData.push(row);
  }

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: filterTableData,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'left' },
    },
  });

  currentY = doc.lastAutoTable.finalY + 5;

  // ── Summary Section ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Summary', margin, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const summaryBoxData = summaryRows.map((row) => [`${row.label}: ${row.value}`]);

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: summaryBoxData,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: pageWidth - margin * 2 },
    },
  });

  currentY = doc.lastAutoTable.finalY + 4;

  // ── Students Table ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Students Included (${studentRows.length})`, margin, currentY);
  currentY += 5;

  const tableHead = [['Full Name', 'Student ID', 'Course', 'Year', 'Status', 'Submitted', 'Cert']];
  const tableBody = studentRows.map((row) => [
    row.fullName,
    row.studentId,
    row.course,
    row.year,
    row.status,
    row.submitted,
    row.certificate,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headerStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 2.5,
      halign: 'center',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
    },
    didDrawPage: (data: any) => {
      // Footer
      const footerY = doc.internal.pageSize.getHeight() - 8;
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${data.pageNumber}`, pageWidth / 2, footerY, { align: 'center' });
    },
  });

  return doc.output('blob');
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <Card className="border-outline-variant/30 overflow-hidden">
      <CardContent className="pt-5 pb-5 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 truncate">{label}</p>
            <p className={`text-3xl font-bold leading-none ${accent}`}>{value}</p>
          </div>
          <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${accent.replace('text-', 'bg-').replace('600', '100').replace('foreground', '100')}`}>
            <Icon className={`w-4.5 h-4.5 ${accent}`} strokeWidth={2} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Filter Section Label ───────────────────────────────────────────────────
function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">{label}</p>
      {children}
    </div>
  );
}

// ── Labeled Select ─────────────────────────────────────────────────────────
function LabeledSelect({
  label,
  value,
  onValueChange,
  placeholder,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────
function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} submissions</p>
    </div>
  );
}

function CustomLineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} submissions</p>
    </div>
  );
}

function CustomDonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-muted-foreground">{payload[0].value} students</p>
    </div>
  );
}

function DepartmentBarValueLabel(props: any) {
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

// ── Main Component ─────────────────────────────────────────────────────────
export default function ReportsDashboard({ mode }: { mode: 'staff' | 'admin' }) {
  const analyticsQueryKey = mode === 'admin' ? ['adminAnalytics'] : ['staffAnalytics'];
  const submissionsQueryKey = mode === 'admin' ? ['adminSubmissions'] : ['staffSubmissions'];
  const reportingTermQueryKey = ['reportingTermSettings'];
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [certificateFilter, setCertificateFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [studentBatchFilter, setStudentBatchFilter] = useState('all');
  const [submissionBreakdownView, setSubmissionBreakdownView] = useState<SubmissionBreakdownView>('department');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusOverviewFromDate, setStatusOverviewFromDate] = useState('');
  const today = useMemo(() => getLocalDateInputValue(), []);
  const defaultReportingTermSettings = useMemo(() => createDefaultAdminSystemSettings(), []);
  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: isAnalyticsError,
  } = useQuery({
    queryKey: analyticsQueryKey,
    queryFn: () => getAnalytics(),
    staleTime: 60_000,
    refetchInterval: () => getActiveAjaxRefetchInterval(90_000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
  const {
    data: submissions = [],
    isLoading: submissionsLoading,
    isError: isSubmissionsError,
  } = useQuery({
    queryKey: submissionsQueryKey,
    queryFn: async () => {
      const data = await getSubmissions();
      return data.submissions || [];
    },
    staleTime: 60_000,
    refetchInterval: () => getActiveAjaxRefetchInterval(60_000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
  const {
    data: reportingTermSettings = defaultReportingTermSettings,
    isLoading: reportingTermLoading,
  } = useQuery({
    queryKey: reportingTermQueryKey,
    queryFn: getReportingTermSettings,
    staleTime: 60_000,
    refetchInterval: () => getActiveAjaxRefetchInterval(REPORTING_TERM_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
  const normalizedSubmissions = useMemo(
    () =>
      Array.isArray(submissions)
        ? submissions
        : Array.isArray((submissions as { submissions?: unknown[] } | undefined)?.submissions)
          ? (submissions as { submissions: any[] }).submissions
          : [],
    [submissions],
  );
  const loading = analyticsLoading || submissionsLoading || reportingTermLoading;

  useEffect(() => {
    if (isAnalyticsError || isSubmissionsError) {
      toast.error('Failed to load report data');
    }
  }, [isAnalyticsError, isSubmissionsError]);

  const allCourses = useMemo(
    () =>
      [...new Set(normalizedSubmissions.map((s) => String(s.course || '').trim()).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [normalizedSubmissions],
  );

  const allConditions = useMemo(() => {
    const keys = new Set<string>();
    normalizedSubmissions.forEach((s) => Object.entries(s.medicalHistory || {}).forEach(([k, v]) => v && keys.add(k)));
    return [...keys].sort((a, b) => a.localeCompare(b));
  }, [normalizedSubmissions]);

  const studentBatches = useMemo(() => {
    const batches = new Set<string>();
    normalizedSubmissions.forEach((s) => {
      const id = String(s.studentId || '');
      const match = id.match(/^(\d{4})/);
      if (match?.[1]) batches.add(match[1]);
    });
    return [...batches].sort();
  }, [normalizedSubmissions]);

  const filteredSubmissions = useMemo(
    () =>
      normalizedSubmissions.filter((sub) => {
        if (departmentFilter !== 'all' && !(sub.department === departmentFilter || sub.course?.includes(departmentFilter))) return false;
        if (yearFilter !== 'all' && String(sub.year) !== yearFilter) return false;
        if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
        if (courseFilter !== 'all' && normalizeCourseValue(sub.course) !== normalizeCourseValue(courseFilter)) return false;
        if (conditionFilter !== 'all' && !sub.medicalHistory?.[conditionFilter]) return false;
        if (certificateFilter === 'issued' && !sub.clearanceInfo?.issuedDate) return false;
        if (certificateFilter === 'not_issued' && sub.clearanceInfo?.issuedDate) return false;
        if (genderFilter !== 'all') {
          const gender = normalizeSubmissionGenderValue(sub.gender || sub.sex);
          if (gender !== genderFilter) return false;
        }
        if (studentBatchFilter !== 'all') {
          const id = String(sub.studentId || '');
          if (!id.startsWith(studentBatchFilter)) return false;
        }
        const subDate = sub.submittedAt ? new Date(sub.submittedAt) : null;
        if (fromDate && subDate && subDate.getTime() < getLocalDateStartTimestamp(fromDate)) return false;
        if (toDate && subDate && subDate.getTime() > getLocalDateEndTimestamp(toDate)) return false;
        return true;
      }),
    [normalizedSubmissions, departmentFilter, yearFilter, statusFilter, courseFilter, conditionFilter, certificateFilter, genderFilter, studentBatchFilter, fromDate, toDate],
  );

  const dedupedFilteredSubmissions = useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const s of filteredSubmissions) {
      const signature = [
        s.studentId || '',
        (s.firstName || '').trim().toLowerCase(),
        (s.lastName || '').trim().toLowerCase(),
        s.year || '',
        s.status || '',
        s.course || '',
        s.submittedAt ? new Date(s.submittedAt).toISOString().slice(0, 10) : '',
      ].join('|');
      if (seen.has(signature)) continue;
      seen.add(signature);
      out.push(s);
    }
    return out;
  }, [filteredSubmissions]);

  const dateRange = useMemo(() => {
    const timestamps = normalizedSubmissions
      .map((s) => (s.submittedAt ? new Date(s.submittedAt).getTime() : NaN))
      .filter((t) => Number.isFinite(t)) as number[];
    if (!timestamps.length) return { minDate: '', maxDate: today };
    const min = getLocalDateInputValue(new Date(Math.min(...timestamps)));
    return { minDate: min, maxDate: today };
  }, [normalizedSubmissions, today]);

  useEffect(() => {
    if (!normalizedSubmissions.length) return;
    if (!fromDate) setFromDate(dateRange.minDate);
    if (!toDate) setToDate(dateRange.maxDate);
  }, [normalizedSubmissions, fromDate, toDate, dateRange.minDate, dateRange.maxDate]);

  useEffect(() => {
    if (!normalizedSubmissions.length) return;
    if (!statusOverviewFromDate) setStatusOverviewFromDate(dateRange.minDate);
  }, [normalizedSubmissions, statusOverviewFromDate, dateRange.minDate]);

  const hasActiveFilters =
    departmentFilter !== 'all' || yearFilter !== 'all' || statusFilter !== 'all' ||
    courseFilter !== 'all' || conditionFilter !== 'all' || certificateFilter !== 'all' ||
    genderFilter !== 'all' || studentBatchFilter !== 'all';

  const handleFromDateChange = (nextValue: string) => {
    setFromDate(nextValue);
    if (toDate && nextValue && getLocalDateStartTimestamp(nextValue) > getLocalDateEndTimestamp(toDate)) {
      setToDate(nextValue);
    }
  };

  const handleToDateChange = (nextValue: string) => {
    setToDate(nextValue);
    if (fromDate && nextValue && getLocalDateEndTimestamp(nextValue) < getLocalDateStartTimestamp(fromDate)) {
      setFromDate(nextValue);
    }
  };

  const handleStatusOverviewFromDateChange = (nextValue: string) => {
    setStatusOverviewFromDate(nextValue);
  };

  const resetFilters = () => {
    setDepartmentFilter('all');
    setYearFilter('all');
    setStatusFilter('all');
    setCourseFilter('all');
    setConditionFilter('all');
    setCertificateFilter('all');
    setGenderFilter('all');
    setStudentBatchFilter('all');
    setFromDate(dateRange.minDate);
    setToDate(dateRange.maxDate);
  };

  const summary = useMemo<ReportsSummary>(() => {
    const total = dedupedFilteredSubmissions.length;
    const approved = dedupedFilteredSubmissions.filter((s) => s.status === 'approved').length;
    const pending = dedupedFilteredSubmissions.filter((s) => s.status === 'pending').length;
    const inReview = dedupedFilteredSubmissions.filter((s) => s.status === 'in_review').length;
    const returned = dedupedFilteredSubmissions.filter((s) => s.status === 'returned').length;
    const physicalExamDone = dedupedFilteredSubmissions.filter((s) => s.status === 'physical_exam_done').length;
    const firstYears = dedupedFilteredSubmissions.filter((s) => String(s.year) === '1');
    const firstYearUnderReview = firstYears.filter((s) => s.status === 'pending' || s.status === 'in_review').length;
    const firstYearNotUnderReview = firstYears.length - firstYearUnderReview;
    const withCertificate = dedupedFilteredSubmissions.filter((s) => Boolean(s.clearanceInfo?.issuedDate)).length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const byCourse = dedupedFilteredSubmissions.reduce(
      (acc, sub) => {
        const course = sub.course || 'Unknown';
        acc[course] = (acc[course] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return {
      total,
      approved,
      pending,
      inReview,
      returned,
      physicalExamDone,
      firstYears: firstYears.length,
      firstYearUnderReview,
      firstYearNotUnderReview,
      withCertificate,
      approvalRate,
      byCourse,
    };
  }, [dedupedFilteredSubmissions]);
  const reportingTermRange = useMemo(
    () => buildReportingTermRange(reportingTermSettings),
    [reportingTermSettings],
  );
  const dateRangePresets = useMemo(
    () => {
      const schoolYearEnd = new Date(reportingTermRange.endMs - 1);
      return [
        {
          value: 'today' as const,
          label: 'Today',
          from: today,
          to: today,
        },
        {
          value: 'lastWeek' as const,
          label: 'Last Week',
          from: getLocalDateInputValue(getDateDaysAgo(6)),
          to: today,
        },
        {
          value: 'lastMonth' as const,
          label: 'Last Month',
          from: getLocalDateInputValue(getDateDaysAgo(29)),
          to: today,
        },
        {
          value: 'schoolYear' as const,
          label: 'School Year',
          from: getLocalDateInputValue(new Date(reportingTermRange.startMs)),
          to: getLocalDateInputValue(clampDateToToday(schoolYearEnd)),
        },
      ];
    },
    [reportingTermRange.endMs, reportingTermRange.startMs, today],
  );
  const activeDateRangePreset = useMemo(
    () =>
      dateRangePresets.find((preset) => preset.from === fromDate && preset.to === toDate)?.value || null,
    [dateRangePresets, fromDate, toDate],
  );
  const activeDateRangeLabel =
    dateRangePresets.find((preset) => preset.value === activeDateRangePreset)?.label ||
    `${fromDate || '-'} to ${toDate || '-'}`;
  const applyDateRangePreset = (preset: DateRangePreset) => {
    const range = dateRangePresets.find((item) => item.value === preset);
    if (!range) return;
    setFromDate(range.from);
    setToDate(range.to);
  };
  const currentTermSubmissions = useMemo(
    () =>
      dedupedFilteredSubmissions.filter((submission) => {
        const submittedTimestamp = new Date(submission.submittedAt || 0).getTime();
        return Number.isFinite(submittedTimestamp)
          && submittedTimestamp >= reportingTermRange.startMs
          && submittedTimestamp < reportingTermRange.endMs;
      }),
    [dedupedFilteredSubmissions, reportingTermRange.endMs, reportingTermRange.startMs],
  );

  // ── Chart data ─────────────────────────────────────────────────────────
  const departmentChartData = useMemo(() => {
    const counts = currentTermSubmissions.reduce((acc, sub) => {
      const department = resolveDepartmentValue(sub.department, sub.course);
      if (!department) return acc;

      acc[department] = (acc[department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return DEPARTMENTS
      .map((department) => ({
        department,
        count: counts[department] || 0,
        fill: DEPARTMENT_COLORS[department] || '#94a3b8',
      }));
  }, [currentTermSubmissions]);
  const programChartData = useMemo(
    () => {
      const programCounts = currentTermSubmissions.reduce((acc, sub) => {
        const program = abbreviateCourse(sub.course);
        if (!program || program === '-') return acc;

        const department = resolveDepartmentValue(sub.department, sub.course);
        const existing = acc[program];
        if (existing) {
          existing.count += 1;
          if (!existing.department && department) {
            existing.department = department;
          }
          return acc;
        }

        acc[program] = {
          count: 1,
          department,
        };
        return acc;
      }, {} as ProgramChartAccumulator);

      return (Object.entries(programCounts) as Array<[string, ProgramChartAccumulator[string]]>)
        .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
        .map(([label, details]) => ({
          label,
          count: details.count,
          fill: DEPARTMENT_COLORS[details.department] || 'hsl(var(--primary))',
        }));
    },
    [currentTermSubmissions],
  );
  const yearChartData = useMemo(() => {
    const yearCounts = currentTermSubmissions.reduce((acc, sub) => {
      const year = String(sub.year || '').trim();
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const extraYears = Object.keys(yearCounts)
      .filter((year) => year && !YEAR_LEVEL_ORDER.includes(year))
      .sort((a, b) => {
        const aNumber = Number.parseInt(a, 10);
        const bNumber = Number.parseInt(b, 10);
        const areNumbers = Number.isFinite(aNumber) && Number.isFinite(bNumber);
        return areNumbers ? aNumber - bNumber : a.localeCompare(b);
      });

    const data = [
      ...YEAR_LEVEL_ORDER.map((year) => ({
        label: YEAR_LABELS[year] || `Year ${year}`,
        count: yearCounts[year] || 0,
        fill: YEAR_LEVEL_COLORS[year] || '#94a3b8',
      })),
      ...extraYears.map((year) => ({
        label: YEAR_LABELS[year] || `Year ${year}`,
        count: yearCounts[year] || 0,
        fill: YEAR_LEVEL_COLORS[year] || '#94a3b8',
      })),
    ];

    if (yearCounts['']) {
      data.push({
        label: 'Unspecified',
        count: yearCounts[''],
        fill: '#94a3b8',
      });
    }

    return data;
  }, [currentTermSubmissions]);
  const genderChartData = useMemo(() => {
    const genderCounts = currentTermSubmissions.reduce((acc, sub) => {
      const gender = normalizeSubmissionGenderValue(sub.gender || sub.sex);
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const extraGenders = Object.keys(genderCounts)
      .filter((gender) => gender && !GENDER_ORDER.includes(gender))
      .sort((a, b) => a.localeCompare(b));

    const data = [
      ...GENDER_ORDER.map((gender) => ({
        label: formatGenderLabel(gender),
        count: genderCounts[gender] || 0,
        fill: GENDER_COLORS[gender] || '#94a3b8',
      })),
      ...extraGenders.map((gender) => ({
        label: formatGenderLabel(gender),
        count: genderCounts[gender] || 0,
        fill: GENDER_COLORS[gender] || '#94a3b8',
      })),
    ];

    if (genderCounts['']) {
      data.push({
        label: 'Unspecified',
        count: genderCounts[''],
        fill: '#94a3b8',
      });
    }

    return data;
  }, [currentTermSubmissions]);
  const submissionBreakdownLabel = formatSubmissionBreakdownLabel(submissionBreakdownView);
  const submissionBreakdownData: SubmissionBreakdownDatum[] =
    submissionBreakdownView === 'department'
      ? departmentChartData.map((item) => ({
          label: item.department,
          count: item.count,
          fill: item.fill,
        }))
      : submissionBreakdownView === 'program'
        ? programChartData
        : submissionBreakdownView === 'year'
          ? yearChartData
          : genderChartData;

  const statusOverviewSubmissions = useMemo(() => {
    if (!statusOverviewFromDate) return filteredSubmissions;

    const selectedStart = getLocalDateStartTimestamp(statusOverviewFromDate);
    if (!Number.isFinite(selectedStart)) return [];

    return filteredSubmissions.filter((submission) => {
      const submittedTimestamp = new Date(submission.submittedAt || 0).getTime();
      return Number.isFinite(submittedTimestamp) && submittedTimestamp >= selectedStart;
    });
  }, [filteredSubmissions, statusOverviewFromDate]);

  const statusChartData = useMemo(
    () =>
      [
        { name: 'Approved', value: statusOverviewSubmissions.filter((s) => s.status === 'approved').length },
        { name: 'Pending', value: statusOverviewSubmissions.filter((s) => s.status === 'pending').length },
        { name: 'Returned', value: statusOverviewSubmissions.filter((s) => s.status === 'returned').length },
        { name: 'Exam Done', value: statusOverviewSubmissions.filter((s) => s.status === 'physical_exam_done').length },
      ].filter((d) => d.value > 0),
    [statusOverviewSubmissions],
  );

  const submissionsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    dedupedFilteredSubmissions.forEach((s) => {
      if (!s.submittedAt) return;
      const date = new Date(s.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      counts[date] = (counts[date] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, count]) => ({ date, count }));
  }, [dedupedFilteredSubmissions]);

  // ── PDF download ────────────────────────────────────────────────────────
  const downloadPdf = async () => {
    try {
      const jsPDFModule = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');

      const friendlyDepartment = departmentFilter === 'all' ? 'All Departments' : departmentFilter;
      const friendlyYear = yearFilter === 'all' ? 'All Years' : (YEAR_LABELS[yearFilter] || `Year ${yearFilter}`);
      const friendlyStatus = statusFilter === 'all' ? 'All Statuses' : (STATUS_LABELS[statusFilter] || statusFilter);
      const friendlyCourse = courseFilter === 'all' ? 'All Courses' : courseFilter;
      const friendlyCondition = conditionFilter === 'all'
        ? 'All Conditions'
        : conditionFilter.replace(/([A-Z])/g, ' $1').replace(/^./, (m) => m.toUpperCase());
      const friendlyCertificate = CERTIFICATE_LABELS[certificateFilter] || certificateFilter;
      const friendlyGender = genderFilter === 'all'
        ? 'All Genders'
        : genderFilter === 'male'
          ? 'Male'
          : genderFilter === 'female'
            ? 'Female'
            : 'Other';
      const friendlyBatch = studentBatchFilter === 'all' ? 'All Batches' : `${studentBatchFilter} Batch`;

      const summaryRows = [
        { label: 'Total submissions', value: String(summary.total) },
        { label: 'Approved', value: String(summary.approved) },
        { label: 'Pending', value: String(summary.pending) },
        { label: 'In review', value: String(summary.inReview) },
        { label: 'Approval rate', value: `${summary.approvalRate}%` },
        { label: 'With medical certificate', value: String(summary.withCertificate) },
        {
          label: 'Top course totals',
          value:
            Object.entries(summary.byCourse)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([course, count]) => `${abbreviateCourse(course)}: ${count}`)
              .join(' | ') || '-',
        },
      ];

      const studentRows = dedupedFilteredSubmissions.map((s) => {
        const middle = s.middleInitial ? ` ${String(s.middleInitial).charAt(0)}.` : '';
        const fullName = `${s.lastName || '-'}, ${s.firstName || '-'}${middle}`;
        return {
          fullName,
          studentId: s.studentId || '-',
          course: abbreviateCourse(s.course),
          year: YEAR_LABELS[String(s.year)] || `Year ${s.year || '-'}`,
          status: STATUS_LABELS[s.status] || s.status || '-',
          submitted: s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : '-',
          certificate: s.clearanceInfo?.issuedDate ? 'Issued' : 'Not Issued',
        };
      });

      const filterList = [
        { label: 'Department', value: friendlyDepartment },
        { label: 'Year', value: friendlyYear },
        { label: 'Status', value: friendlyStatus },
        { label: 'Course', value: friendlyCourse },
        { label: 'Condition', value: friendlyCondition },
        { label: 'Certificate', value: friendlyCertificate },
        { label: 'Gender', value: friendlyGender },
        { label: 'Student ID Batch', value: friendlyBatch },
        { label: 'Submitted From', value: fromDate || '-' },
        { label: 'Submitted To', value: toDate || '-' },
      ];

      const blob = await buildPdfWithAutoTable(
        jsPDFModule,
        autoTableModule,
        summaryRows,
        studentRows,
        `${mode === 'admin' ? 'ADMIN' : 'STAFF'} CLINIC REPORT`,
        filterList,
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${mode}_clinic_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('PDF report downloaded');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF report');
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[100rem] space-y-5">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-56 sm:h-10 sm:w-80" />
            <Skeleton className="h-5 w-full max-w-md" />
          </div>
          <Skeleton className="h-10 w-full rounded-md sm:w-36" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={`stats-skeleton-${idx}`} className="border-outline-variant/30">
              <CardContent className="px-5 pb-5 pt-5">
                <Skeleton className="mb-3 h-3 w-32" />
                <Skeleton className="h-9 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-outline-variant/30">
          <CardHeader className="pb-0 pt-5 px-5">
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-64" />
          </CardContent>
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card key={`chart-skeleton-${idx}`} className={`border-outline-variant/30 ${idx === 0 ? 'xl:col-span-2' : ''}`}>
              <CardHeader className="pb-2 pt-5 px-5">
                <Skeleton className="h-6 w-44" />
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <Skeleton className="h-56 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-5">
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <PortalPageIntro
        title={`${mode === 'admin' ? 'Admin' : 'Staff'} Reports & Analytics`}
        description="Filter submissions and export professional PDF summaries."
        className="mb-8"
      />

      {/* ── Stat Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Filtered Submissions" value={summary.total} icon={Users} accent="text-primary" />
        <StatCard label="Approval Rate" value={`${summary.approvalRate}%`} icon={TrendingUp} accent="text-green-600" />
        <StatCard label="1st Year Under Review" value={summary.firstYearUnderReview} icon={Clock} accent="text-amber-600" />
        <StatCard label="Certificates Issued" value={summary.withCertificate} icon={Award} accent="text-blue-600" />
      </div>

      {/* ── Filters Card ──────────────────────────────────────────────── */}
      <Card className="border-outline-variant/30">
        <CardHeader className="pb-0 pt-5 px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Filters</CardTitle>
              {hasActiveFilters && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Active
                </span>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-outline-variant/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:justify-start sm:border-0 sm:px-0 sm:py-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset all
                </button>
              )}
              <Button onClick={downloadPdf} size="sm" className="w-full gap-2 bg-primary text-white hover:bg-primary/90 sm:w-auto sm:shrink-0">
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5 pt-5 space-y-5">

          {/* ── Group 1: Student Info ──────────────────────────────────── */}
          <FilterSection label="Student">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <LabeledSelect label="Department" value={departmentFilter} onValueChange={setDepartmentFilter} placeholder="Department">
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </LabeledSelect>
              <LabeledSelect label="Year Level" value={yearFilter} onValueChange={setYearFilter} placeholder="Year">
                <SelectItem value="all">All Years</SelectItem>
                {Object.entries(YEAR_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </LabeledSelect>
              <LabeledSelect label="Course" value={courseFilter} onValueChange={setCourseFilter} placeholder="Course">
                <SelectItem value="all">All Courses</SelectItem>
                {allCourses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </LabeledSelect>
              <LabeledSelect label="Student ID Batch" value={studentBatchFilter} onValueChange={setStudentBatchFilter} placeholder="Batch">
                <SelectItem value="all">All Batches</SelectItem>
                {studentBatches.map((batch) => <SelectItem key={batch} value={batch}>{batch}</SelectItem>)}
              </LabeledSelect>
            </div>
          </FilterSection>

          <div className="border-t border-outline-variant/20" />

          {/* ── Group 2: Submission Info ───────────────────────────────── */}
          <FilterSection label="Submission">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <LabeledSelect label="Status" value={statusFilter} onValueChange={setStatusFilter} placeholder="Status">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="physical_exam_done">Physical Exam Done</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </LabeledSelect>
              <LabeledSelect label="Certificate" value={certificateFilter} onValueChange={setCertificateFilter} placeholder="Certificate">
                <SelectItem value="all">All Certificates</SelectItem>
                <SelectItem value="issued">Issued Only</SelectItem>
                <SelectItem value="not_issued">Not Issued</SelectItem>
              </LabeledSelect>
              <LabeledSelect label="Medical Condition" value={conditionFilter} onValueChange={setConditionFilter} placeholder="Condition">
                <SelectItem value="all">All Conditions</SelectItem>
                {allConditions.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k.replace(/([A-Z])/g, ' $1').replace(/^./, (m) => m.toUpperCase())}
                  </SelectItem>
                ))}
              </LabeledSelect>
              <LabeledSelect label="Gender" value={genderFilter} onValueChange={setGenderFilter} placeholder="Gender">
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </LabeledSelect>
            </div>
          </FilterSection>

          <div className="border-t border-outline-variant/20" />

          {/* ── Group 3: Date Range ────────────────────────────────────── */}
          <FilterSection label="Date Range">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {dateRangePresets.map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant={activeDateRangePreset === preset.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 justify-center"
                    onClick={() => applyDateRangePreset(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="grid max-w-none grid-cols-1 gap-3 sm:max-w-sm sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">From</span>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  min={dateRange.minDate || undefined}
                  max={today}
                  value={fromDate}
                  onChange={(e) => handleFromDateChange(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">To</span>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  min={dateRange.minDate || undefined}
                  max={today}
                  value={toDate}
                  onChange={(e) => handleToDateChange(e.target.value)}
                />
              </div>
              </div>
            </div>
          </FilterSection>

        </CardContent>
      </Card>

      {/* ── Charts ────────────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Bar chart: submissions by department */}
        <Card className="border-outline-variant/30">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                <CardTitle className="text-base font-semibold">
                  Submissions by {submissionBreakdownLabel}
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Total medical clearance forms for the selected date range.
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                  Range: {activeDateRangeLabel} | Academic Year: {reportingTermRange.label}
                </p>
              </div>
              <div className="w-full sm:w-44">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Sort by</p>
                <Select
                  value={submissionBreakdownView}
                  onValueChange={(value) => setSubmissionBreakdownView(value as SubmissionBreakdownView)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Choose chart view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="program">Program</SelectItem>
                    <SelectItem value="year">Year Level</SelectItem>
                    <SelectItem value="gender">Gender</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            {submissionBreakdownView === 'program' && submissionBreakdownData.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-muted-foreground">
                No current academic year program submissions are available for the selected filters.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={submissionBreakdownData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
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
                    <Tooltip content={<CustomBarTooltip />} cursor={false} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {submissionBreakdownData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                      <LabelList dataKey="count" content={<DepartmentBarValueLabel />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donut + Line side-by-side */}
        <div className="grid xl:grid-cols-2 gap-4">

          {/* Donut chart: status breakdown */}
          <Card className="border-outline-variant/30">
            <CardHeader className="pb-0 pt-5 px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Status Breakdown</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">Distribution across approval stages</p>
                </div>
                <div className="w-full sm:w-44">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Overview from</p>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    min={dateRange.minDate || undefined}
                    max={toDate || today}
                    value={statusOverviewFromDate}
                    onChange={(event) => handleStatusOverviewFromDateChange(event.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              {statusOverviewSubmissions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-muted-foreground">
                  No records found from the selected overview date.
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius="52%"
                        outerRadius="72%"
                        dataKey="value"
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {statusChartData.map((entry) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#888'} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomDonutTooltip />} />
                      <Legend
                        iconType="square"
                        iconSize={10}
                        formatter={(value) => (
                          <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line chart: submissions over time */}
          <Card className="border-outline-variant/30">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="text-base font-semibold">Submissions Over Time</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Daily volume across the filtered date range</p>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              {submissionsByDate.length === 0 ? (
                <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-muted-foreground">
                  No timeline data available for the selected filters.
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={submissionsByDate} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--outline-variant) / 0.3)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomLineTooltip />} cursor={{ stroke: 'hsl(var(--outline-variant) / 0.5)', strokeWidth: 1 }} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#0f6e56"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#0f6e56', strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

    </div>
  );
}
