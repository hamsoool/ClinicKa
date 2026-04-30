import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Download } from 'lucide-react';
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
    const subDate = sub.submittedAt ? new Date(sub.submittedAt) : null;
    if (fromDate && subDate && subDate < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && subDate && subDate > new Date(`${toDate}T23:59:59`)) return false;
    return true;
  }), [submissions, departmentFilter, yearFilter, statusFilter, courseFilter, conditionFilter, certificateFilter, surnameFilter, fromDate, toDate]);

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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Loading reports...</div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary mb-2">{mode === 'admin' ? 'Admin' : 'Staff'} Reports & Analytics</h1>
        <p className="text-muted-foreground">Filterable reports with downloadable PDF summaries</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}><SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
          <Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="all">All Years</SelectItem>{Object.entries(YEAR_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="pending">Under Review</SelectItem><SelectItem value="physical_exam_done">Physical Exam Done</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="returned">Returned</SelectItem></SelectContent></Select>
          <Select value={certificateFilter} onValueChange={setCertificateFilter}><SelectTrigger><SelectValue placeholder="Certificate" /></SelectTrigger><SelectContent><SelectItem value="all">All Certificates</SelectItem><SelectItem value="issued">Issued Only</SelectItem><SelectItem value="not_issued">Not Issued</SelectItem></SelectContent></Select>
          <Select value={courseFilter} onValueChange={setCourseFilter}><SelectTrigger><SelectValue placeholder="Course" /></SelectTrigger><SelectContent><SelectItem value="all">All Courses</SelectItem>{allCourses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Select value={conditionFilter} onValueChange={setConditionFilter}><SelectTrigger><SelectValue placeholder="Medical Condition" /></SelectTrigger><SelectContent><SelectItem value="all">All Conditions</SelectItem>{allConditions.map((k) => <SelectItem key={k} value={k}>{k.replace(/([A-Z])/g, ' $1').replace(/^./, (m) => m.toUpperCase())}</SelectItem>)}</SelectContent></Select>
          <Select value={surnameFilter} onValueChange={setSurnameFilter}>
            <SelectTrigger><SelectValue placeholder="Surname" /></SelectTrigger>
            <SelectContent>
              {SURNAME_FILTERS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === 'all' ? 'All Surnames' : `${value} - Surnames`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="md:col-span-2"><Label>Submitted From</Label><Input type="date" min={dateRange.minDate || undefined} max={today} value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Submitted To</Label><Input type="date" min={dateRange.minDate || undefined} max={today} value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
          <div className="md:col-span-4 flex justify-end"><Button onClick={downloadPdf}><Download className="w-4 h-4 mr-2" />Download PDF</Button></div>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Filtered Submissions</p><p className="text-3xl font-bold">{summary.total}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Approval Rate</p><p className="text-3xl font-bold text-green-600">{summary.approvalRate}%</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">1st Year Under Review</p><p className="text-3xl font-bold text-amber-600">{summary.firstYearUnderReview}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Certificates Issued</p><p className="text-3xl font-bold text-blue-600">{summary.withCertificate}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Course Submission Totals</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Total Submitted</TableHead></TableRow></TableHeader>
            <TableBody>
              {Object.entries(summary.byCourse).sort((a, b) => b[1] - a[1]).map(([course, count]) => <TableRow key={course}><TableCell>{course}</TableCell><TableCell>{count}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Submission Breakdown</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Total students (system): {analytics?.totalStudents || 0}</p>
          <p>Under review: {summary.pending}</p>
          <p>Approved: {summary.approved}</p>
          <p>1st year submitted overall: {summary.firstYears}</p>
          <p>1st year not under review: {summary.firstYearNotUnderReview}</p>
          <p>Medical certificate released: {summary.withCertificate}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Filtered Students</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Course</TableHead><TableHead>Year</TableHead><TableHead>Status</TableHead><TableHead>Submitted</TableHead><TableHead>Certificate</TableHead></TableRow></TableHeader>
            <TableBody>
              {dedupedFilteredSubmissions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.firstName} {s.lastName} ({s.studentId})</TableCell>
                  <TableCell>{s.course || '-'}</TableCell>
                  <TableCell>{YEAR_LABELS[String(s.year)] || `Year ${s.year || '-'}`}</TableCell>
                  <TableCell>{STATUS_LABELS[s.status] || s.status}</TableCell>
                  <TableCell>{s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>{s.clearanceInfo?.issuedDate ? 'Issued' : 'Not Issued'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
