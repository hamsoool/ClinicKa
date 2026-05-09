import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import type { MockSubmission } from '../../lib/mock-data';
import MedicalRecordPreview from '../../components/medical-record-preview';
import MedicalClearancePreview from '../../components/medical-clearance-preview';
import { Download, Search, FileText, X, ClipboardList, Award } from 'lucide-react';
import { toast } from 'sonner';
import { getSubmissions } from '../../lib/api';

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

export default function StaffCertificates() {
  const RECORD_PREVIEW_BASE_WIDTH = 816;
  const CLEARANCE_PREVIEW_BASE_WIDTH = 794;
  const STUDENTS_PER_PAGE = 10;
  const [submissions, setSubmissions] = useState<MockSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<MockSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<MockSubmission | null>(null);
  const [activeTab, setActiveTab] = useState('records');
  const [currentPage, setCurrentPage] = useState(1);
  const [openRecordPreview, setOpenRecordPreview] = useState(false);
  const [openClearancePreview, setOpenClearancePreview] = useState(false);

  const recordPreviewRef = useRef<HTMLDivElement>(null);
  const clearancePreviewRef = useRef<HTMLDivElement>(null);
  const recordPreviewViewportRef = useRef<HTMLDivElement>(null);
  const recordPreviewCanvasRef = useRef<HTMLDivElement>(null);
  const clearancePreviewViewportRef = useRef<HTMLDivElement>(null);
  const clearancePreviewCanvasRef = useRef<HTMLDivElement>(null);
  const recordPreviewModalViewportRef = useRef<HTMLDivElement>(null);
  const recordPreviewModalCanvasRef = useRef<HTMLDivElement>(null);
  const clearancePreviewModalViewportRef = useRef<HTMLDivElement>(null);
  const clearancePreviewModalCanvasRef = useRef<HTMLDivElement>(null);
  const [recordPreviewScale, setRecordPreviewScale] = useState(1);
  const [recordPreviewHeight, setRecordPreviewHeight] = useState<number | null>(null);
  const [isRecordCompactPreview, setIsRecordCompactPreview] = useState(false);
  const [clearancePreviewScale, setClearancePreviewScale] = useState(1);
  const [clearancePreviewHeight, setClearancePreviewHeight] = useState<number | null>(null);
  const [isClearanceCompactPreview, setIsClearanceCompactPreview] = useState(false);

  useEffect(() => {
    loadSubmissions();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [searchQuery, departmentFilter, yearFilter, submissions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, yearFilter]);

  useLayoutEffect(() => {
    if (!selectedStudent) return;

    const updateScale = () => {
      const viewport = openRecordPreview ? recordPreviewModalViewportRef.current : recordPreviewViewportRef.current;
      const canvas = openRecordPreview ? recordPreviewModalCanvasRef.current : recordPreviewCanvasRef.current;
      if (!viewport || !canvas) return;

      const availableWidth = Math.max(0, viewport.clientWidth - 6);
      const naturalHeight = canvas.scrollHeight;
      if (!naturalHeight) return;

      const compact = availableWidth < RECORD_PREVIEW_BASE_WIDTH;
      const nextScale = compact ? availableWidth / RECORD_PREVIEW_BASE_WIDTH : 1;
      setIsRecordCompactPreview(compact);
      setRecordPreviewScale(nextScale);
      setRecordPreviewHeight(naturalHeight * nextScale);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    if (recordPreviewViewportRef.current) observer.observe(recordPreviewViewportRef.current);
    if (recordPreviewCanvasRef.current) observer.observe(recordPreviewCanvasRef.current);
    if (recordPreviewModalViewportRef.current) observer.observe(recordPreviewModalViewportRef.current);
    if (recordPreviewModalCanvasRef.current) observer.observe(recordPreviewModalCanvasRef.current);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [selectedStudent, activeTab, openRecordPreview]);

  useLayoutEffect(() => {
    if (!selectedStudent) return;

    const updateScale = () => {
      const viewport = openClearancePreview ? clearancePreviewModalViewportRef.current : clearancePreviewViewportRef.current;
      const canvas = openClearancePreview ? clearancePreviewModalCanvasRef.current : clearancePreviewCanvasRef.current;
      if (!viewport || !canvas) return;

      const availableWidth = Math.max(0, viewport.clientWidth - 6);
      const naturalHeight = canvas.scrollHeight;
      if (!naturalHeight) return;

      const compact = availableWidth < CLEARANCE_PREVIEW_BASE_WIDTH;
      const nextScale = compact ? availableWidth / CLEARANCE_PREVIEW_BASE_WIDTH : 1;
      setIsClearanceCompactPreview(compact);
      setClearancePreviewScale(nextScale);
      setClearancePreviewHeight(naturalHeight * nextScale);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    if (clearancePreviewViewportRef.current) observer.observe(clearancePreviewViewportRef.current);
    if (clearancePreviewCanvasRef.current) observer.observe(clearancePreviewCanvasRef.current);
    if (clearancePreviewModalViewportRef.current) observer.observe(clearancePreviewModalViewportRef.current);
    if (clearancePreviewModalCanvasRef.current) observer.observe(clearancePreviewModalCanvasRef.current);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [selectedStudent, activeTab, openClearancePreview]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const data = await getSubmissions();
      // Only show approved records
      const approvedRecords = (data.submissions || []).filter((r) => r.status === 'approved');
      setSubmissions(approvedRecords);
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const filterSubmissions = () => {
    let filtered = submissions;

    if (searchQuery) {
      filtered = filtered.filter(sub =>
        sub.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.studentId?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(sub =>
        sub.department === departmentFilter || sub.course?.includes(departmentFilter)
      );
    }
    
    if (yearFilter !== 'all') {
      filtered = filtered.filter(sub => String(sub.year) === yearFilter);
    }

    setFilteredSubmissions(filtered);
  };
  
  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('all');
    setYearFilter('all');
  };

  const hasActiveFilters = searchQuery || departmentFilter !== 'all' || yearFilter !== 'all';
  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / STUDENTS_PER_PAGE));
  const clampedPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (clampedPage - 1) * STUDENTS_PER_PAGE;
  const paginatedSubmissions = filteredSubmissions.slice(pageStartIndex, pageStartIndex + STUDENTS_PER_PAGE);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  const downloadRecordPDF = async () => {
    if (!recordPreviewRef.current || !selectedStudent) return;
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
        format: [330.2, 215.9], // Long bond: 8.5in x 13in
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

          ctx.drawImage(
            fullCanvas,
            0,
            renderedPx,
            fullCanvas.width,
            sliceHeightPx,
            0,
            0,
            fullCanvas.width,
            sliceHeightPx,
          );

          if (pageIndex > 0) pdf.addPage();
          const sliceData = pageCanvas.toDataURL('image/png');
          const sliceHeightMm = (sliceHeightPx * usableWidth) / fullCanvas.width;
          pdf.addImage(sliceData, 'PNG', margin, margin, usableWidth, sliceHeightMm, undefined, 'FAST');

          renderedPx += sliceHeightPx;
          pageIndex += 1;
        }
      }

      pdf.save(`medical_record_${selectedStudent.lastName}_${selectedStudent.firstName}.pdf`);
      toast.success('Medical record PDF downloaded.');
    } catch (error) {
      console.error('Failed to generate medical record PDF:', error);
      toast.error('Failed to download PDF. Please try again.');
    }
  };

  const downloadClearancePDF = async () => {
    if (!clearancePreviewRef.current || !selectedStudent) return;
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
      pdf.save(`medical_clearance_${selectedStudent.lastName}_${selectedStudent.firstName}.pdf`);
      toast.success('Medical clearance PDF downloaded.');
    } catch (error) {
      console.error('Failed to generate clearance PDF:', error);
      toast.error('Failed to download PDF. Please try again.');
    }
  };

  /* ───────── Student List Sidebar ───────── */
  const renderStudentList = () => (
    <div className="lg:col-span-1">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approved Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Depts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Depts</SelectItem>
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
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
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1">
                {departmentFilter !== 'all' && (
                  <Badge variant="outline" className="text-[10px] px-1">{departmentFilter}</Badge>
                )}
                {yearFilter !== 'all' && (
                  <Badge variant="outline" className="text-[10px] px-1">{YEAR_LABELS[yearFilter]}</Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-5 px-1 text-[10px]">
                  <X className="w-3 h-3 mr-0.5" /> Clear
                </Button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No approved records found
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {paginatedSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedStudent?.id === submission.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedStudent(submission)}
                  >
                    <p className="font-medium text-sm">
                      {submission.lastName}, {submission.firstName} {submission.middleInitial || ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {submission.studentId} • Year {submission.year}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {submission.course}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {!loading && filteredSubmissions.length > STUDENTS_PER_PAGE ? (
              <div className="flex items-center justify-between gap-2 pt-2">
                <p className="text-xs text-muted-foreground">
                  Page {clampedPage} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={clampedPage <= 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Prev
                  </Button>
                  <div className="flex items-center gap-1">
                    {pageNumbers.map((page) => (
                      <Button
                        key={page}
                        type="button"
                        size="sm"
                        variant={page === clampedPage ? 'default' : 'outline'}
                        className="h-7 min-w-7 px-2 text-xs"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={clampedPage >= totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Certificates & Records</h1>
        <p className="text-muted-foreground">View completed medical records and generate medical clearance certificates</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="records" className="flex items-center gap-1 px-2 text-[10px] sm:gap-2 sm:text-sm">
            <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Completed Medical Records
          </TabsTrigger>
          <TabsTrigger value="clearance" className="flex items-center gap-1 px-2 text-[10px] sm:gap-2 sm:text-sm">
            <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Medical Clearance
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: Completed Medical Records ===== */}
        <TabsContent value="records">
          <div className="grid lg:grid-cols-3 gap-6">
            {renderStudentList()}

            <div className="lg:col-span-2">
              {selectedStudent ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <CardTitle>Medical Record Form</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedStudent.lastName}, {selectedStudent.firstName}  E{selectedStudent.studentId}
                        </p>
                      </div>
                      <Button onClick={downloadRecordPDF} className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90">
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF (Long Bond)
                      </Button>
                      <Dialog open={openRecordPreview} onOpenChange={setOpenRecordPreview}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full sm:hidden">Preview</Button>
                        </DialogTrigger>
                        <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none p-0 sm:h-[92vh] sm:max-w-5xl sm:rounded-lg">
                          <DialogHeader className="border-b bg-primary px-4 py-3 text-primary-foreground">
                            <DialogTitle className="text-sm font-semibold">Medical Record - {selectedStudent.year}</DialogTitle>
                          </DialogHeader>
                          <div ref={recordPreviewModalViewportRef} className="flex-1 overflow-auto bg-muted/30 p-2">
                            <div style={{ height: isRecordCompactPreview ? (recordPreviewHeight ?? 'auto') : 'auto' }}>
                              <div
                                ref={recordPreviewModalCanvasRef}
                                style={{
                                  width: `${RECORD_PREVIEW_BASE_WIDTH}px`,
                                  margin: isRecordCompactPreview ? '0' : '0 auto',
                                  transform: `scale(${recordPreviewScale})`,
                                  transformOrigin: isRecordCompactPreview ? 'top left' : 'top center',
                                }}
                              >
                                <MedicalRecordPreview record={selectedStudent} />
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div ref={recordPreviewViewportRef} className="hidden max-h-[68vh] overflow-auto rounded-lg border bg-muted/30 p-2 sm:block sm:p-4 md:p-8">
                      <div style={{ height: isRecordCompactPreview ? (recordPreviewHeight ?? 'auto') : 'auto' }}>
                        <div
                          ref={recordPreviewCanvasRef}
                          style={{
                            width: `${RECORD_PREVIEW_BASE_WIDTH}px`,
                            margin: isRecordCompactPreview ? '0' : '0 auto',
                            transform: `scale(${recordPreviewScale})`,
                            transformOrigin: isRecordCompactPreview ? 'top left' : 'top center',
                          }}
                        >
                          <MedicalRecordPreview ref={recordPreviewRef} record={selectedStudent} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <ClipboardList className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Select a student from the list to view their completed medical record
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ===== TAB 2: Medical Clearance ===== */}
        <TabsContent value="clearance">
          <div className="grid lg:grid-cols-3 gap-6">
            {renderStudentList()}

            <div className="lg:col-span-2">
              {selectedStudent ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <CardTitle>Medical Clearance Certificate</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          3 copies (Student, Coordinator, Registrar)  EA4 bond paper
                        </p>
                      </div>
                      <Button onClick={downloadClearancePDF} className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90">
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF (A4)
                      </Button>
                      <Dialog open={openClearancePreview} onOpenChange={setOpenClearancePreview}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full sm:hidden">Preview</Button>
                        </DialogTrigger>
                        <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none p-0 sm:h-[92vh] sm:max-w-5xl sm:rounded-lg">
                          <DialogHeader className="border-b bg-primary px-4 py-3 text-primary-foreground">
                            <DialogTitle className="text-sm font-semibold">Medical Clearance Certificate</DialogTitle>
                          </DialogHeader>
                          <div ref={clearancePreviewModalViewportRef} className="flex-1 overflow-auto bg-muted/30 p-2">
                            <div style={{ height: isClearanceCompactPreview ? (clearancePreviewHeight ?? 'auto') : 'auto' }}>
                              <div
                                ref={clearancePreviewModalCanvasRef}
                                style={{
                                  width: `${CLEARANCE_PREVIEW_BASE_WIDTH}px`,
                                  margin: isClearanceCompactPreview ? '0' : '0 auto',
                                  transform: `scale(${clearancePreviewScale})`,
                                  transformOrigin: isClearanceCompactPreview ? 'top left' : 'top center',
                                }}
                              >
                                <MedicalClearancePreview record={selectedStudent} />
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div ref={clearancePreviewViewportRef} className="hidden overflow-hidden rounded-lg border bg-white p-1 sm:block sm:p-2">
                      <div style={{ height: isClearanceCompactPreview ? (clearancePreviewHeight ?? 'auto') : 'auto' }}>
                        <div
                          ref={clearancePreviewCanvasRef}
                          style={{
                            width: `${CLEARANCE_PREVIEW_BASE_WIDTH}px`,
                            margin: isClearanceCompactPreview ? '0' : '0 auto',
                            transform: `scale(${clearancePreviewScale})`,
                            transformOrigin: isClearanceCompactPreview ? 'top left' : 'top center',
                          }}
                        >
                          <MedicalClearancePreview ref={clearancePreviewRef} record={selectedStudent} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Award className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Select a student from the list to generate a medical clearance certificate
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
