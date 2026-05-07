import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
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

function buildSimplePdf(
  summaryRows: Array<{ label: string; value: string }>,
  studentRows: Array<{ fullName: string; studentId: string; course: string; year: string; status: string; submitted: string; certificate: string }>,
  reportTitle: string,
  filters: Array<{ label: string; value: string }>,
) {
  const escapePdfText = (value: string) =>
    String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E]/g, '');
  const t = (x: number, y: number, text: string, size = 10) => `BT /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
  const line = (x1: number, y1: number, x2: number, y2: number) => `${x1} ${y1} m ${x2} ${y2} l S`;
  const rect = (x: number, y: number, w: number, h: number) => `${x} ${y} ${w} ${h} re S`;

  const pageTop = 812;
  const left = 32;
  const right = 563;
  const summaryTop = 600;
  const summaryHeight = 150;
  const tableTop = 380;
  const rowHeight = 20;
  const maxRows = 14;
  const rows = studentRows.slice(0, maxRows);
  const tableHeight = rowHeight * (rows.length + 1);

  const colXs = [left, 200, 252, 322, 380, 446, 508, right];
  const colTitles = ['Full Name', 'Student ID', 'Course', 'Year', 'Status', 'Submitted', 'Cert'];

  const parts: string[] = [];
  parts.push('1 w');
  parts.push('0 g');
  parts.push(t(left, pageTop - 28, reportTitle, 16));
  parts.push(t(left, pageTop - 62, `Generated: ${new Date().toLocaleString()}`, 9));

  parts.push('0.12 0.45 0.18 RG');
  parts.push('0.93 0.98 0.93 rg');
  parts.push(`${left} ${pageTop - 98} ${right - left} 26 re f`);
  parts.push(rect(left, pageTop - 188, right - left, 116));
  parts.push('0 g');
  parts.push(t(left + 10, pageTop - 86, 'Applied Filters', 11));
  const filterCols = [left + 12, left + 280];
  filters.forEach((filter, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const y = pageTop - 112 - row * 17;
    parts.push(t(filterCols[col], y, `${filter.label}: ${filter.value}`, 9));
  });

  parts.push('0.12 0.45 0.18 RG');
  parts.push('0.93 0.98 0.93 rg');
  parts.push(`${left} ${summaryTop - 24} ${right - left} 24 re f`);
  parts.push(rect(left, summaryTop - summaryHeight, right - left, summaryHeight));
  parts.push('0 g');
  parts.push(t(left + 10, summaryTop - 16, 'Summary', 11));
  summaryRows.forEach((row, idx) => {
    const col = idx % 2;
    const rowIndex = Math.floor(idx / 2);
    const y = summaryTop - 42 - rowIndex * 17;
    const x = left + 12 + col * 258;
    if (y > summaryTop - summaryHeight + 8) {
      parts.push(t(x, y, `${row.label}: ${row.value}`, 9));
    }
  });

  parts.push(t(left, tableTop + 18, `Students Included (${rows.length}${studentRows.length > maxRows ? ` of ${studentRows.length}` : ''})`, 11));
  parts.push('0.12 0.45 0.18 RG');
  parts.push('0.93 0.98 0.93 rg');
  parts.push(`${left} ${tableTop - rowHeight} ${right - left} ${rowHeight} re f`);
  parts.push(rect(left, tableTop - tableHeight, right - left, tableHeight));
  parts.push('0 g');
  parts.push('0.7 w');
  parts.push('0.2 0.55 0.25 RG');
  parts.push(line(left, tableTop - rowHeight, right, tableTop - rowHeight));
  colXs.forEach((x) => parts.push(line(x, tableTop, x, tableTop - tableHeight)));
  colTitles.forEach((title, idx) => {
    parts.push(t(colXs[idx] + 4, tableTop - 13, title, 8.5));
  });
  parts.push('1 w');
  parts.push('0.12 0.45 0.18 RG');

  rows.forEach((row, rowIndex) => {
    const yTop = tableTop - rowHeight * (rowIndex + 1);
    const yText = yTop - 13;
    if (rowIndex % 2 === 1) {
      parts.push('0.98 0.98 0.98 rg');
      parts.push(`${left} ${yTop - rowHeight} ${right - left} ${rowHeight} re f`);
      parts.push('0 g');
    }
    parts.push(line(left, yTop - rowHeight, right, yTop - rowHeight));
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
      parts.push(t(colXs[idx] + 4, yText, value, 8));
    });
  });

  const stream = parts.join('\n');
  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  objects.push(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`);
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
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
    (async () => {
      setLoading(true);
      try {
        const [analyticsData, submissionsData] = await Promise.all([getAnalytics(), getSubmissions()]);
        setAnalytics(analyticsData);
        setSubmissions(submissionsData.submissions || []);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allCourses = useMemo(
    () => [...new Set(submissions.map((s) => s.course).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))),
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
    if (courseFilter !== 'all' && sub.course !== courseFilter) return false;
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

  const downloadPdf = () => {
    try {
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
        { label: '1st year submitted', value: String(summary.firstYears) },
        { label: '1st year under review', value: String(summary.firstYearUnderReview) },
        { label: '1st year not under review', value: String(summary.firstYearNotUnderReview) },
        { label: 'Top course totals', value: Object.entries(summary.byCourse).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([course, count]) => `${course}: ${count}`).join(' | ') || '-' },
      ];
      const studentRows = dedupedFilteredSubmissions.map((s) => {
        const middle = s.middleInitial ? ` ${String(s.middleInitial).charAt(0)}.` : '';
        const fullName = `${s.lastName || '-'}, ${s.firstName || '-'}${middle}`;
        return {
          fullName,
          studentId: s.studentId || '-',
          course: s.course || '-',
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
      const blob = buildSimplePdf(summaryRows, studentRows, `${mode === 'admin' ? 'ADMIN' : 'STAFF'} CLINIC REPORT`, filterList);
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
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary leading-tight">
            {mode === 'admin' ? 'Admin' : 'Staff'} Reports &amp; Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Filter submissions and export professional PDF summaries.
          </p>
        </div>
        <Button onClick={downloadPdf} className="bg-primary text-white hover:bg-primary/90 gap-2 shrink-0">
          <Download className="w-4 h-4" />
          Download PDF
        </Button>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Filtered Submissions" value={summary.total} icon={Users} accent="text-primary" />
        <StatCard label="Approval Rate" value={`${summary.approvalRate}%`} icon={TrendingUp} accent="text-green-600" />
        <StatCard label="1st Year Under Review" value={summary.firstYearUnderReview} icon={Clock} accent="text-amber-600" />
        <StatCard label="Certificates Issued" value={summary.withCertificate} icon={Award} accent="text-blue-600" />
      </div>

      {/* ── Filters Card ──────────────────────────────────────────────── */}
      <Card className="border-outline-variant/30">
        <CardHeader className="pb-0 pt-5 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Filters</CardTitle>
              {hasActiveFilters && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Active
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset all
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5 pt-5 space-y-5">

          {/* ── Group 1: Student Info ──────────────────────────────────── */}
          <FilterSection label="Student">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <div className="grid grid-cols-2 gap-3 max-w-sm">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-right">Submissions</TableHead>
                  <TableHead className="w-40 hidden md:table-cell">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(summary.byCourse)
                  .sort((a, b) => b[1] - a[1])
                  .map(([course, count]) => {
                    const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                    return (
                      <TableRow key={course}>
                        <TableCell className="font-medium">{course}</TableCell>
                        <TableCell className="text-right tabular-nums">{count}</TableCell>
                        <TableCell className="hidden md:table-cell">
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
          </CardContent>
        </Card>
      </div>

      {/* ── Filtered Students Table ────────────────────────────────────── */}
      <Card className="border-outline-variant/30">
        <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Filtered Students</CardTitle>
          <span className="text-xs text-muted-foreground font-normal">
            {dedupedFilteredSubmissions.length} record{dedupedFilteredSubmissions.length !== 1 ? 's' : ''}
          </span>
        </CardHeader>
        <CardContent className="px-5 pb-5">
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
              {dedupedFilteredSubmissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No records match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                dedupedFilteredSubmissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="font-medium">{s.firstName} {s.lastName}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">({s.studentId})</span>
                    </TableCell>
                    <TableCell>{s.course || '—'}</TableCell>
                    <TableCell>{YEAR_LABELS[String(s.year)] || `Year ${s.year || '—'}`}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        s.status === 'approved'
                          ? 'bg-green-50 text-green-700 ring-green-600/20'
                          : s.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                          : s.status === 'returned'
                          ? 'bg-red-50 text-red-700 ring-red-600/20'
                          : 'bg-blue-50 text-blue-700 ring-blue-600/20'
                      }`}>
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}