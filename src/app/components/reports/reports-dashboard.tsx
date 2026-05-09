import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Skeleton } from '../ui/skeleton';
import { Download, TrendingUp, Clock, Award, Users, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { getAnalytics, getSubmissions } from '../../lib/api';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
const SURNAME_FILTERS = ['all', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
const YEAR_LABELS: Record<string, string> = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' };
const STATUS_LABELS: Record<string, string> = {
  pending: 'Under Review',
  approved: 'Approved',
  returned: 'Returned',
  physical_exam_done: 'Physical Exam Done',
};
const CERTIFICATE_LABELS: Record<string, string> = { all: 'All Certificates', issued: 'Issued Only', not_issued: 'Not Issued' };
const REPORTS_CACHE_KEY = 'clinic_reports_cache_v1';

function statusChipClass(status: string) {
  if (status === 'approved') return 'bg-green-50 text-green-700 ring-green-600/20';
  if (status === 'pending') return 'bg-amber-50 text-amber-700 ring-amber-600/20';
  if (status === 'returned') return 'bg-red-50 text-red-700 ring-red-600/20';
  return 'bg-blue-50 text-blue-700 ring-blue-600/20';
}

type ReportsSummary = {
  total: number;
  approved: number;
  pending: number;
  firstYears: number;
  firstYearUnderReview: number;
  firstYearNotUnderReview: number;
  withCertificate: number;
  approvalRate: number;
  byCourse: Record<string, number>;
};

function normalizeCourseValue(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
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

async function imagePathToDataUrl(path: string) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to prepare image canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
    img.src = path;
  });
}

async function buildSimplePdf(
  createDoc: () => any,
  summaryRows: Array<{ label: string; value: string }>,
  studentRows: Array<{ fullName: string; studentId: string; course: string; year: string; status: string; submitted: string; certificate: string }>,
  reportTitle: string,
  filters: Array<{ label: string; value: string }>,
) {
  const doc = createDoc();
  const left = 32;
  const right = 563;
  const contentWidth = right - left;
  const border: [number, number, number] = [31, 115, 46];
  const headingFill: [number, number, number] = [237, 250, 237];
  const zebraFill: [number, number, number] = [250, 250, 250];
  const startY = 24;
  const rowHeight = 20;
  const maxRows = 14;
  const rows = studentRows.slice(0, maxRows);
  const colXs = [left, 200, 252, 322, 380, 446, 508, right];
  const colTitles = ['Full Name', 'Student ID', 'Course', 'Year', 'Status', 'Submitted', 'Cert'] as const;

  const [gcLogo, acadLogo, hsuLogo] = await Promise.all([
    imagePathToDataUrl('/gordon-college-logo.png'),
    imagePathToDataUrl('/gordon_college_academicaffairs.png'),
    imagePathToDataUrl('/gordonhsc.png'),
  ]);

  doc.setDrawColor(...border);
  doc.setFillColor(...headingFill);
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.9);

  doc.addImage(gcLogo, 'PNG', left, startY, 26, 26);
  doc.addImage(acadLogo, 'PNG', left + 30, startY, 26, 26);
  doc.addImage(hsuLogo, 'PNG', left + 60, startY, 26, 26);

  doc.setFontSize(16);
  doc.text(reportTitle, left + 96, startY + 11);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, left + 96, startY + 25);

  const filtersY = 82;
  const filtersHeight = 98;
  doc.setFillColor(...headingFill);
  doc.rect(left, filtersY, contentWidth, filtersHeight);
  doc.setDrawColor(...border);
  doc.rect(left, filtersY, contentWidth, filtersHeight);
  doc.setFillColor(...headingFill);
  doc.rect(left, filtersY, contentWidth, 22, 'F');
  doc.setFontSize(10);
  doc.text('Applied Filters', left + 10, filtersY + 15);
  const filterCols = [left + 12, left + 265];
  filters.forEach((filter, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const y = filtersY + 37 + row * 14;
    doc.setFontSize(8.5);
    doc.text(`${filter.label}: ${filter.value}`, filterCols[col], y);
  });

  const summaryY = 198;
  const summaryHeight = 116;
  doc.setFillColor(...headingFill);
  doc.rect(left, summaryY, contentWidth, summaryHeight);
  doc.setDrawColor(...border);
  doc.rect(left, summaryY, contentWidth, summaryHeight);
  doc.setFillColor(...headingFill);
  doc.rect(left, summaryY, contentWidth, 22, 'F');
  doc.setFontSize(10);
  doc.text('Summary', left + 10, summaryY + 15);
  summaryRows.forEach((row, idx) => {
    const col = idx % 2;
    const rowIndex = Math.floor(idx / 2);
    const y = summaryY + 38 + rowIndex * 15;
    const x = left + 12 + col * 245;
    if (y < summaryY + summaryHeight - 8) {
      doc.setFontSize(8.5);
      doc.text(`${row.label}: ${row.value}`, x, y);
    }
  });

  const tableLabelY = 332;
  doc.setFontSize(11);
  doc.text(`Students Included (${rows.length}${studentRows.length > maxRows ? ` of ${studentRows.length}` : ''})`, left, tableLabelY);

  const tableTopY = 346;
  const tableHeight = rowHeight * (rows.length + 1);
  doc.setDrawColor(...border);
  doc.rect(left, tableTopY, contentWidth, tableHeight);
  doc.setFillColor(...headingFill);
  doc.rect(left, tableTopY, contentWidth, rowHeight, 'F');
  doc.setLineWidth(0.7);
  doc.line(left, tableTopY + rowHeight, right, tableTopY + rowHeight);
  colXs.forEach((x) => doc.line(x, tableTopY, x, tableTopY + tableHeight));
  colTitles.forEach((title, idx) => {
    doc.setFontSize(8.5);
    doc.text(title, colXs[idx] + 4, tableTopY + 13);
  });

  rows.forEach((row, rowIndex) => {
    const rowY = tableTopY + rowHeight * (rowIndex + 1);
    const textY = rowY + 13;
    if (rowIndex % 2 === 1) {
      doc.setFillColor(...zebraFill);
      doc.rect(left, rowY, contentWidth, rowHeight, 'F');
      doc.setFillColor(...headingFill);
    }
    doc.line(left, rowY + rowHeight, right, rowY + rowHeight);
    const values = [
      row.fullName.slice(0, 30),
      row.studentId.slice(0, 12),
      row.course.slice(0, 12),
      row.year.slice(0, 8),
      row.status.slice(0, 12),
      row.submitted.slice(0, 12),
      row.certificate.slice(0, 10),
    ];
    values.forEach((value, idx) => {
      doc.setFontSize(7.2);
      doc.text(value, colXs[idx] + 4, textY);
    });
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

// ── Main Component ─────────────────────────────────────────────────────────
export default function ReportsDashboard({ mode }: { mode: 'staff' | 'admin' }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [certificateFilter, setCertificateFilter] = useState('all');
  const [surnameFilter, setSurnameFilter] = useState('all');
  const [studentBatchFilter, setStudentBatchFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedRaw = window.sessionStorage.getItem(REPORTS_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as { analytics?: any; submissions?: any[] };
          if (cached?.analytics) setAnalytics(cached.analytics);
          if (Array.isArray(cached?.submissions)) setSubmissions(cached.submissions);
          if (cached?.analytics || Array.isArray(cached?.submissions)) setLoading(false);
        }
      } catch {
        // ignore cache parse errors
      }
    }

    (async () => {
      setLoading((prev) => prev && submissions.length === 0 && !analytics);
      try {
        const [analyticsData, submissionsData] = await Promise.all([getAnalytics(), getSubmissions()]);
        const nextSubmissions = submissionsData.submissions || [];
        setAnalytics(analyticsData);
        setSubmissions(nextSubmissions);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(
            REPORTS_CACHE_KEY,
            JSON.stringify({
              analytics: analyticsData,
              submissions: nextSubmissions,
            }),
          );
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allCourses = useMemo(
    () =>
      [...new Set(submissions.map((s) => String(s.course || '').trim()).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b))),
    [submissions],
  );

  const allConditions = useMemo(() => {
    const keys = new Set<string>();
    submissions.forEach((s) => Object.entries(s.medicalHistory || {}).forEach(([k, v]) => v && keys.add(k)));
    return [...keys].sort((a, b) => a.localeCompare(b));
  }, [submissions]);

  const studentBatches = useMemo(() => {
    const batches = new Set<string>();
    submissions.forEach((s) => {
      const id = String(s.studentId || '');
      const match = id.match(/^(\d{4})/);
      if (match?.[1]) batches.add(match[1]);
    });
    return [...batches].sort();
  }, [submissions]);

  const filteredSubmissions = useMemo(() => submissions.filter((sub) => {
    if (departmentFilter !== 'all' && !(sub.department === departmentFilter || sub.course?.includes(departmentFilter))) return false;
    if (yearFilter !== 'all' && String(sub.year) !== yearFilter) return false;
    if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
    if (courseFilter !== 'all' && normalizeCourseValue(sub.course) !== normalizeCourseValue(courseFilter)) return false;
    if (conditionFilter !== 'all' && !sub.medicalHistory?.[conditionFilter]) return false;
    if (certificateFilter === 'issued' && !sub.clearanceInfo?.issuedDate) return false;
    if (certificateFilter === 'not_issued' && sub.clearanceInfo?.issuedDate) return false;
    if (surnameFilter !== 'all') {
      const lastName = String(sub.lastName || '').trim();
      if (!lastName.toUpperCase().startsWith(surnameFilter)) return false;
    }
    if (studentBatchFilter !== 'all') {
      const id = String(sub.studentId || '');
      if (!id.startsWith(studentBatchFilter)) return false;
    }
    const subDate = sub.submittedAt ? new Date(sub.submittedAt) : null;
    if (fromDate && subDate && subDate < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && subDate && subDate > new Date(`${toDate}T23:59:59`)) return false;
    return true;
  }), [submissions, departmentFilter, yearFilter, statusFilter, courseFilter, conditionFilter, certificateFilter, surnameFilter, studentBatchFilter, fromDate, toDate]);

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
    const timestamps = submissions
      .map((s) => (s.submittedAt ? new Date(s.submittedAt).getTime() : NaN))
      .filter((t) => Number.isFinite(t)) as number[];
    if (!timestamps.length) return { minDate: '', maxDate: today };
    const min = new Date(Math.min(...timestamps)).toISOString().split('T')[0];
    return { minDate: min, maxDate: today };
  }, [submissions, today]);

  useEffect(() => {
    if (!submissions.length) return;
    if (!fromDate) setFromDate(dateRange.minDate);
    if (!toDate) setToDate(dateRange.maxDate);
  }, [submissions, fromDate, toDate, dateRange.minDate, dateRange.maxDate]);

  const hasActiveFilters = departmentFilter !== 'all' || yearFilter !== 'all' || statusFilter !== 'all' ||
    courseFilter !== 'all' || conditionFilter !== 'all' || certificateFilter !== 'all' ||
    surnameFilter !== 'all' || studentBatchFilter !== 'all';

  const resetFilters = () => {
    setDepartmentFilter('all');
    setYearFilter('all');
    setStatusFilter('all');
    setCourseFilter('all');
    setConditionFilter('all');
    setCertificateFilter('all');
    setSurnameFilter('all');
    setStudentBatchFilter('all');
    setFromDate(dateRange.minDate);
    setToDate(dateRange.maxDate);
  };

  const summary = useMemo<ReportsSummary>(() => {
    const total = dedupedFilteredSubmissions.length;
    const approved = dedupedFilteredSubmissions.filter((s) => s.status === 'approved').length;
    const pending = dedupedFilteredSubmissions.filter((s) => s.status === 'pending').length;
    const firstYears = dedupedFilteredSubmissions.filter((s) => String(s.year) === '1');
    const firstYearUnderReview = firstYears.filter((s) => s.status === 'pending').length;
    const firstYearNotUnderReview = firstYears.length - firstYearUnderReview;
    const withCertificate = dedupedFilteredSubmissions.filter((s) => Boolean(s.clearanceInfo?.issuedDate)).length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const byCourse = dedupedFilteredSubmissions.reduce((acc, sub) => {
      const course = sub.course || 'Unknown';
      acc[course] = (acc[course] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { total, approved, pending, firstYears: firstYears.length, firstYearUnderReview, firstYearNotUnderReview, withCertificate, approvalRate, byCourse };
  }, [dedupedFilteredSubmissions]);

  const courseEntries = useMemo(
    () => Object.entries(summary.byCourse).sort((a, b) => b[1] - a[1]),
    [summary.byCourse],
  );

  const downloadPdf = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const friendlyDepartment = departmentFilter === 'all' ? 'All Departments' : departmentFilter;
      const friendlyYear = yearFilter === 'all' ? 'All Years' : (YEAR_LABELS[yearFilter] || `Year ${yearFilter}`);
      const friendlyStatus = statusFilter === 'all' ? 'All Statuses' : (STATUS_LABELS[statusFilter] || statusFilter);
      const friendlyCourse = courseFilter === 'all' ? 'All Courses' : courseFilter;
      const friendlyCondition = conditionFilter === 'all'
        ? 'All Conditions'
        : conditionFilter.replace(/([A-Z])/g, ' $1').replace(/^./, (m) => m.toUpperCase());
      const friendlyCertificate = CERTIFICATE_LABELS[certificateFilter] || certificateFilter;
      const friendlySurname = surnameFilter === 'all' ? 'All Surnames' : `Surname starts with ${surnameFilter}`;
      const friendlyBatch = studentBatchFilter === 'all' ? 'All Batches' : `${studentBatchFilter} Batch`;
      const summaryRows = [
        { label: 'Total submissions', value: String(summary.total) },
        { label: 'Approved', value: String(summary.approved) },
        { label: 'Under review', value: String(summary.pending) },
        { label: 'Approval rate', value: `${summary.approvalRate}%` },
        { label: 'With medical certificate', value: String(summary.withCertificate) },
        {
          label: 'Top course totals',
          value: Object.entries(summary.byCourse)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([course, count]) => `${abbreviateCourse(course)}: ${count}`)
            .join(' | ') || '-',
        },
      ];
      if (yearFilter === '1' || summary.firstYears > 0) {
        summaryRows.splice(5, 0,
          { label: '1st year submitted', value: String(summary.firstYears) },
          { label: '1st year under review', value: String(summary.firstYearUnderReview) },
          { label: '1st year not under review', value: String(summary.firstYearNotUnderReview) },
        );
      }
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
        { label: 'Surname', value: friendlySurname },
        { label: 'Student ID Batch', value: friendlyBatch },
        { label: 'Submitted From', value: fromDate || '-' },
        { label: 'Submitted To', value: toDate || '-' },
      ];
      const blob = await buildSimplePdf(
        () => new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' }),
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
    } catch {
      toast.error('Failed to generate PDF report');
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
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

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="border-outline-variant/30">
            <CardHeader className="pb-2 pt-5 px-5">
              <Skeleton className="h-6 w-44" />
            </CardHeader>
            <CardContent className="space-y-2 px-5 pb-5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={`breakdown-skeleton-${idx}`} className="h-5 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card className="border-outline-variant/30 xl:col-span-2">
            <CardHeader className="pb-2 pt-5 px-5">
              <Skeleton className="h-6 w-52" />
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-5">
              <Skeleton className="h-8 w-full" />
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={`course-skeleton-${idx}`} className="h-6 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-primary sm:text-3xl">
            {mode === 'admin' ? 'Admin' : 'Staff'} Reports &amp; Analytics
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Filter submissions and export professional PDF summaries.
          </p>
        </div>
      </div>

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
                <SelectItem value="pending">Under Review</SelectItem>
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

              <LabeledSelect label="Surname" value={surnameFilter} onValueChange={setSurnameFilter} placeholder="Surname">
                {SURNAME_FILTERS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === 'all' ? 'All Surnames' : `${value} — Surnames`}
                  </SelectItem>
                ))}
              </LabeledSelect>
            </div>
          </FilterSection>

          <div className="border-t border-outline-variant/20" />

          {/* ── Group 3: Date Range ────────────────────────────────────── */}
          <FilterSection label="Date Range">
            <div className="grid max-w-none grid-cols-1 gap-3 sm:max-w-sm sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">From</span>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  min={dateRange.minDate || undefined}
                  max={today}
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
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
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
          </FilterSection>

        </CardContent>
      </Card>

      {/* ── Data Tables ───────────────────────────────────────────────── */}
      <div className="grid xl:grid-cols-3 gap-4">

        {/* Submission breakdown (left) */}
        <Card className="border-outline-variant/30">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base font-semibold">Submission Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <dl className="space-y-2.5 text-sm">
              {[
                { label: 'Total students (system)', value: analytics?.totalStudents || 0 },
                { label: 'Under review', value: summary.pending },
                { label: 'Approved', value: summary.approved },
                { label: '1st year submitted', value: summary.firstYears },
                { label: '1st year not under review', value: summary.firstYearNotUnderReview },
                { label: 'Medical certificate released', value: summary.withCertificate },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-outline-variant/20 last:border-0">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Course totals (right, spans 2 cols) */}
        <Card className="border-outline-variant/30 xl:col-span-2">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base font-semibold">Course Submission Totals</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {courseEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-muted-foreground">
                No course totals available for the selected filters.
              </div>
            ) : null}

            <div className="space-y-2 md:hidden">
              {courseEntries.map(([course, count]) => {
                const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                return (
                  <div key={course} className="rounded-lg border border-outline-variant/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-on-surface">{course}</p>
                      <p className="text-sm font-semibold tabular-nums text-on-surface">{count}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-outline-variant/20">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-right">Submissions</TableHead>
                    <TableHead className="w-40">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseEntries.map(([course, count]) => {
                    const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                    return (
                      <TableRow key={course}>
                        <TableCell className="font-medium">{course}</TableCell>
                        <TableCell className="text-right tabular-nums">{count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-outline-variant/20 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filtered Students Table ────────────────────────────────────── */}
      <Card className="border-outline-variant/30">
        <CardHeader className="flex flex-col items-start justify-between gap-1 pb-2 pt-5 px-5 sm:flex-row sm:items-center">
          <CardTitle className="text-base font-semibold">Filtered Students</CardTitle>
          <span className="text-xs text-muted-foreground font-normal">
            {dedupedFilteredSubmissions.length} record{dedupedFilteredSubmissions.length !== 1 ? 's' : ''}
          </span>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {dedupedFilteredSubmissions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-muted-foreground">
              No records match the selected filters.
            </div>
          ) : null}

          <div className="space-y-3 md:hidden">
            {dedupedFilteredSubmissions.map((s) => (
              <Card key={s.id} className="border-outline-variant/40">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-muted-foreground">{s.studentId || '—'}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusChipClass(s.status)}`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p className="text-muted-foreground">Course</p>
                    <p className="text-right text-on-surface">{s.course || '—'}</p>
                    <p className="text-muted-foreground">Year</p>
                    <p className="text-right text-on-surface">{YEAR_LABELS[String(s.year)] || `Year ${s.year || '—'}`}</p>
                    <p className="text-muted-foreground">Submitted</p>
                    <p className="text-right text-on-surface">{s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : '—'}</p>
                    <p className="text-muted-foreground">Certificate</p>
                    <p className={`text-right font-medium ${s.clearanceInfo?.issuedDate ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {s.clearanceInfo?.issuedDate ? 'Issued' : 'Not Issued'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Certificate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dedupedFilteredSubmissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="font-medium">{s.firstName} {s.lastName}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">({s.studentId})</span>
                    </TableCell>
                    <TableCell>{s.course || '—'}</TableCell>
                    <TableCell>{YEAR_LABELS[String(s.year)] || `Year ${s.year || '—'}`}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusChipClass(s.status)}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      {s.clearanceInfo?.issuedDate
                        ? <span className="text-green-600 font-medium text-sm">Issued</span>
                        : <span className="text-muted-foreground text-sm">Not Issued</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
