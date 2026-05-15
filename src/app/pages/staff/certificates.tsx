import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import type { MockSubmission } from '../../lib/mock-data';
import MedicalRecordPreview from '../../components/medical-record-preview';
import MedicalClearancePreview from '../../components/medical-clearance-preview';
import { Download, Search, FileText, X, ClipboardList, Award } from 'lucide-react';
import { toast } from 'sonner';
import { getStudentProfileAssets, getSubmissions } from '../../lib/api';

type StaffSubmission = MockSubmission & {
  photoUrl?: string;
  signatureUrl?: string;
};

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
const YEAR_LABELS: Record<string, string> = {
  '1': '1st Year',
  '2': '2nd Year',
  '3': '3rd Year',
  '4': '4th Year',
};

async function loadPdfDependencies() {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  return { html2canvas, jsPDF };
}

function buildLatestPerYear(records: MockSubmission[]) {
  return records.reduce<Partial<Record<1 | 2 | 3 | 4, MockSubmission>>>((acc, item) => {
    const yearNum = Number.parseInt(String(item.year || ''), 10) as 1 | 2 | 3 | 4;
    if (![1, 2, 3, 4].includes(yearNum)) return acc;
    const current = acc[yearNum];
    if (!current) {
      acc[yearNum] = item;
      return acc;
    }
    const currentTs = new Date(current.updatedAt || current.submittedAt || 0).getTime();
    const nextTs = new Date(item.updatedAt || item.submittedAt || 0).getTime();
    if (nextTs >= currentTs) acc[yearNum] = item;
    return acc;
  }, {});
}

export default function StaffCertificates() {
  const RECORD_PREVIEW_BASE_WIDTH = 816;
  const CLEARANCE_PREVIEW_BASE_WIDTH = 794;
  const STUDENTS_PER_PAGE = 10;
  const [submissions, setSubmissions] = useState<StaffSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<StaffSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'form' | 'medical-clearance'>('form');
  const [clearanceYearFilter, setClearanceYearFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const recordPreviewRef = useRef<HTMLDivElement>(null);
  const clearancePreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadSubmissions();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [searchQuery, departmentFilter, yearFilter, submissions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, yearFilter]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const data = await getSubmissions();
      const approvedRecords = (data.submissions || []).filter((r) => r.status === 'approved');
      setSubmissions(approvedRecords);
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const hydrateStudentAssets = async (records: StaffSubmission[]) => {
    if (!records.length) return records;
    const needAssets = records.some((record) => !record.photoUrl || !record.signatureUrl);
    if (!needAssets) return records;

    const studentId = String(records[0].studentId || '').trim();
    if (!studentId) return records;

    try {
      const { photoUrl, signatureUrl } = await getStudentProfileAssets(studentId);
      if (!photoUrl && !signatureUrl) return records;
      return records.map((record) => ({
        ...record,
        photoUrl: record.photoUrl || photoUrl || undefined,
        signatureUrl: record.signatureUrl || signatureUrl || undefined,
      }));
    } catch {
      return records;
    }
  };

  const filterSubmissions = () => {
    let filtered = submissions;

    if (searchQuery) {
      filtered = filtered.filter((sub) =>
        sub.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.studentId?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (departmentFilter !== 'all') {
      filtered = filtered.filter((sub) => sub.department === departmentFilter || sub.course?.includes(departmentFilter));
    }

    if (yearFilter !== 'all') {
      filtered = filtered.filter((sub) => String(sub.year) === yearFilter);
    }

    setFilteredSubmissions(filtered);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('all');
    setYearFilter('all');
  };

  const studentRows = useMemo(() => {
    const grouped = filteredSubmissions.reduce((acc, item) => {
      const key = String(item.studentId || '');
      if (!key) return acc;
      const existing = acc.get(key);
      if (!existing) {
        acc.set(key, item);
        return acc;
      }
      const existingTs = new Date(existing.updatedAt || existing.submittedAt || 0).getTime();
      const nextTs = new Date(item.updatedAt || item.submittedAt || 0).getTime();
      if (nextTs >= existingTs) acc.set(key, item);
      return acc;
    }, new Map<string, MockSubmission>());
    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.updatedAt || b.submittedAt || 0).getTime() - new Date(a.updatedAt || a.submittedAt || 0).getTime(),
    );
  }, [filteredSubmissions]);

  useEffect(() => {
    if (studentRows.length && !selectedStudentId) {
      setSelectedStudentId(studentRows[0].studentId || '');
      return;
    }
    if (selectedStudentId && !studentRows.some((row) => row.studentId === selectedStudentId)) {
      setSelectedStudentId(studentRows[0]?.studentId || '');
    }
  }, [studentRows, selectedStudentId]);

  const selectedStudentRecords = useMemo(
    () => submissions.filter((item) => String(item.studentId || '') === String(selectedStudentId || '')),
    [submissions, selectedStudentId],
  );

  const [hydratedSelectedRecords, setHydratedSelectedRecords] = useState<StaffSubmission[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const hydrated = await hydrateStudentAssets(selectedStudentRecords);
      if (active) setHydratedSelectedRecords(hydrated);
    })();
    return () => {
      active = false;
    };
  }, [selectedStudentId, submissions]);

  const selectedRecordsSorted = useMemo(
    () =>
      [...hydratedSelectedRecords].sort(
        (a, b) => new Date(b.updatedAt || b.submittedAt || 0).getTime() - new Date(a.updatedAt || a.submittedAt || 0).getTime(),
      ),
    [hydratedSelectedRecords],
  );
  const combinedRecord = selectedRecordsSorted[0] || null;
  const latestRecordPerYear = useMemo(() => buildLatestPerYear(selectedRecordsSorted), [selectedRecordsSorted]);
  const availableYears = useMemo(
    () =>
      Array.from(new Set(selectedRecordsSorted.map((entry) => String(entry.year || '')).filter(Boolean))).sort(
        (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
      ),
    [selectedRecordsSorted],
  );

  useEffect(() => {
    if (clearanceYearFilter !== 'all' && !availableYears.includes(clearanceYearFilter)) {
      setClearanceYearFilter('all');
    }
  }, [availableYears, clearanceYearFilter]);

  const clearanceRecord = useMemo(() => {
    const source =
      clearanceYearFilter === 'all'
        ? selectedRecordsSorted
        : selectedRecordsSorted.filter((entry) => String(entry.year || '') === clearanceYearFilter);
    return (
      source.find((entry) => entry.status === 'approved' && entry.clearanceInfo?.controlNo) ||
      source.find((entry) => entry.status === 'approved') ||
      source[0] ||
      null
    );
  }, [selectedRecordsSorted, clearanceYearFilter]);

  const hasActiveFilters = searchQuery || departmentFilter !== 'all' || yearFilter !== 'all';
  const totalPages = Math.max(1, Math.ceil(studentRows.length / STUDENTS_PER_PAGE));
  const clampedPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (clampedPage - 1) * STUDENTS_PER_PAGE;
  const paginatedStudents = studentRows.slice(pageStartIndex, pageStartIndex + STUDENTS_PER_PAGE);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  const downloadRecordPDF = async () => {
    if (!recordPreviewRef.current || !combinedRecord) return;
    try {
      const { html2canvas, jsPDF } = await loadPdfDependencies();
      const exportRoot = document.createElement('div');
      exportRoot.style.position = 'fixed';
      exportRoot.style.left = '-10000px';
      exportRoot.style.top = '0';
      exportRoot.style.width = `${RECORD_PREVIEW_BASE_WIDTH}px`;
      exportRoot.style.background = '#fff';
      exportRoot.style.padding = '0';
      exportRoot.style.margin = '0';

      const clone = recordPreviewRef.current.cloneNode(true) as HTMLDivElement;
      clone.style.width = `${RECORD_PREVIEW_BASE_WIDTH}px`;
      clone.style.maxWidth = `${RECORD_PREVIEW_BASE_WIDTH}px`;
      clone.style.margin = '0';
      clone.style.padding = '0';
      clone.style.transform = 'none';

      exportRoot.appendChild(clone);
      document.body.appendChild(exportRoot);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: RECORD_PREVIEW_BASE_WIDTH,
        windowWidth: RECORD_PREVIEW_BASE_WIDTH,
      });
      document.body.removeChild(exportRoot);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [330.2, 215.9],
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png');

      if (imgHeight <= usableHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight, undefined, 'FAST');
      } else {
        const fullCanvas = canvas;
        const pageSliceHeightPx = Math.floor((usableHeight * fullCanvas.width) / usableWidth);
        let renderedPx = 0;
        let pageIndex = 0;
        while (renderedPx < fullCanvas.height) {
          const sliceHeightPx = Math.min(pageSliceHeightPx, fullCanvas.height - renderedPx);
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = fullCanvas.width;
          pageCanvas.height = sliceHeightPx;
          const ctx = pageCanvas.getContext('2d');
          if (!ctx) break;
          ctx.drawImage(fullCanvas, 0, renderedPx, fullCanvas.width, sliceHeightPx, 0, 0, fullCanvas.width, sliceHeightPx);
          if (pageIndex > 0) pdf.addPage();
          const sliceData = pageCanvas.toDataURL('image/png');
          const sliceHeightMm = (sliceHeightPx * usableWidth) / fullCanvas.width;
          pdf.addImage(sliceData, 'PNG', margin, margin, usableWidth, sliceHeightMm, undefined, 'FAST');
          renderedPx += sliceHeightPx;
          pageIndex += 1;
        }
      }

      pdf.save(`medical_record_${combinedRecord.lastName}_${combinedRecord.firstName}.pdf`);
      toast.success('Medical record PDF downloaded.');
    } catch (error) {
      console.error('Failed to generate medical record PDF:', error);
      toast.error('Failed to download PDF. Please try again.');
    }
  };

  const downloadClearancePDF = async () => {
    if (!clearancePreviewRef.current || !clearanceRecord) return;
    try {
      const { html2canvas, jsPDF } = await loadPdfDependencies();
      const exportRoot = document.createElement('div');
      exportRoot.style.position = 'fixed';
      exportRoot.style.left = '-10000px';
      exportRoot.style.top = '0';
      exportRoot.style.width = `${CLEARANCE_PREVIEW_BASE_WIDTH}px`;
      exportRoot.style.background = '#fff';
      exportRoot.style.padding = '0';
      exportRoot.style.margin = '0';

      const clone = clearancePreviewRef.current.cloneNode(true) as HTMLDivElement;
      clone.style.width = `${CLEARANCE_PREVIEW_BASE_WIDTH}px`;
      clone.style.maxWidth = `${CLEARANCE_PREVIEW_BASE_WIDTH}px`;
      clone.style.margin = '0';
      clone.style.padding = '0';
      clone.style.transform = 'none';

      exportRoot.appendChild(clone);
      document.body.appendChild(exportRoot);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: CLEARANCE_PREVIEW_BASE_WIDTH,
        windowWidth: CLEARANCE_PREVIEW_BASE_WIDTH,
      });
      document.body.removeChild(exportRoot);

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const canvasRatio = canvas.width / canvas.height;
      const pageRatio = usableWidth / usableHeight;
      let renderWidth = usableWidth;
      let renderHeight = usableWidth / canvasRatio;
      if (canvasRatio < pageRatio) {
        renderHeight = usableHeight;
        renderWidth = usableHeight * canvasRatio;
      }
      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, renderWidth, renderHeight, undefined, 'FAST');
      pdf.save(`medical_clearance_${clearanceRecord.lastName}_${clearanceRecord.firstName}.pdf`);
      toast.success('Medical clearance PDF downloaded.');
    } catch (error) {
      console.error('Failed to generate clearance PDF:', error);
      toast.error('Failed to download PDF. Please try again.');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-primary">Certificates & Records</h1>
        <p className="text-muted-foreground">Combined student form and medical clearance preview in one workspace.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approved Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Depts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Depts</SelectItem>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {Object.entries(YEAR_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-1">
                    {departmentFilter !== 'all' && <Badge variant="outline" className="px-1 text-[10px]">{departmentFilter}</Badge>}
                    {yearFilter !== 'all' && <Badge variant="outline" className="px-1 text-[10px]">{YEAR_LABELS[yearFilter]}</Badge>}
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-5 px-1 text-[10px]">
                      <X className="mr-0.5 h-3 w-3" /> Clear
                    </Button>
                  </div>
                )}

                {loading ? (
                  <div className="py-4 text-center text-muted-foreground">Loading...</div>
                ) : studentRows.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground">No approved records found</div>
                ) : (
                  <div className="max-h-[500px] space-y-2 overflow-y-auto">
                    {paginatedStudents.map((student) => (
                      <div
                        key={student.studentId}
                        className={`cursor-pointer rounded border p-3 transition-colors ${
                          selectedStudentId === student.studentId ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        }`}
                        onClick={() => setSelectedStudentId(student.studentId || '')}
                      >
                        <p className="text-sm font-medium">{student.lastName}, {student.firstName} {student.middleInitial || ''}</p>
                        <p className="text-xs text-muted-foreground">{student.studentId}</p>
                        <p className="text-xs text-muted-foreground">{student.course}</p>
                      </div>
                    ))}
                  </div>
                )}

                {!loading && studentRows.length > STUDENTS_PER_PAGE ? (
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <p className="text-xs text-muted-foreground">Page {clampedPage} of {totalPages}</p>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={clampedPage <= 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>Prev</Button>
                      {pageNumbers.map((page) => (
                        <Button key={page} type="button" size="sm" variant={page === clampedPage ? 'default' : 'outline'} className="h-7 min-w-7 px-2 text-xs" onClick={() => setCurrentPage(page)}>
                          {page}
                        </Button>
                      ))}
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={clampedPage >= totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>Next</Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {!combinedRecord ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ClipboardList className="mb-4 h-16 w-16 text-muted-foreground" />
                <p className="text-muted-foreground">Select a student from the list to view combined previews.</p>
              </CardContent>
            </Card>
          ) : (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'form' | 'medical-clearance')}>
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="form" className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Form
                </TabsTrigger>
                <TabsTrigger value="medical-clearance" className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Medical Clearance
                </TabsTrigger>
              </TabsList>

              <TabsContent value="form">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle>Medical Record Form (Combined Year 1-4)</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{combinedRecord.lastName}, {combinedRecord.firstName} | {combinedRecord.studentId}</p>
                      </div>
                      <Button onClick={downloadRecordPDF} className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto">
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF (Long Bond)
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[68vh] overflow-auto rounded-lg border bg-muted/30 p-2 sm:p-4 md:p-8">
                      <div className="mx-auto max-w-[816px] overflow-hidden rounded-sm bg-white shadow-lg ring-1 ring-black/5">
                        <MedicalRecordPreview ref={recordPreviewRef} record={combinedRecord} yearlyRecords={latestRecordPerYear} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="medical-clearance">
                <Card className="mb-4">
                  <CardContent className="pt-6">
                    <div className="flex max-w-xs flex-col gap-2">
                      <p className="text-sm font-medium">Year Filter</p>
                      <Select value={clearanceYearFilter} onValueChange={setClearanceYearFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Years</SelectItem>
                          {availableYears.map((year) => (
                            <SelectItem key={year} value={year}>
                              Year {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {clearanceRecord ? (
                  <Card>
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <CardTitle>Medical Clearance Certificate</CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">3 copies (Student, Coordinator, Registrar) | A4 bond paper</p>
                        </div>
                        <Button onClick={downloadClearancePDF} className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto">
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF (A4)
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-hidden rounded-lg border bg-white p-1 sm:p-2">
                        <div className="mx-auto w-full max-w-[794px]">
                          <MedicalClearancePreview ref={clearancePreviewRef} record={clearanceRecord} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <FileText className="mb-4 h-16 w-16 text-muted-foreground opacity-40" />
                      <p className="text-muted-foreground">No clearance record for the selected year filter.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
