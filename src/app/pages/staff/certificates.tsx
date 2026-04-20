import { useEffect, useRef, useState } from 'react';
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
import { getSubmissions } from '../../lib/api';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAS', 'CED'];
const YEAR_LABELS: Record<string, string> = {
  '1': '1st Year',
  '2': '2nd Year',
  '3': '3rd Year',
  '4': '4th Year',
};

export default function StaffCertificates() {
  const [submissions, setSubmissions] = useState<MockSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<MockSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<MockSubmission | null>(null);
  const [activeTab, setActiveTab] = useState('records');

  const recordPreviewRef = useRef<HTMLDivElement>(null);
  const clearancePreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSubmissions();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [searchQuery, departmentFilter, yearFilter, submissions]);

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

  const downloadRecordPDF = () => {
    if (!recordPreviewRef.current || !selectedStudent) return;
    const content = recordPreviewRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=816,height=1260');
    if (!printWindow) { toast.error('Please allow pop-ups'); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Medical Record - ${selectedStudent.firstName} ${selectedStudent.lastName}</title>
      <style>
        @page { size: 8.5in 13in; margin: 0.5in; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    </head><body>${content}
      <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
    </body></html>`);
    printWindow.document.close();
    toast.success('Medical record PDF downloading...');
  };

  const downloadClearancePDF = () => {
    if (!clearancePreviewRef.current || !selectedStudent) return;
    const content = clearancePreviewRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=794,height=1123');
    if (!printWindow) { toast.error('Please allow pop-ups'); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Medical Clearance - ${selectedStudent.firstName} ${selectedStudent.lastName}</title>
      <style>
        @page { size: A4; margin: 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    </head><body>${content}
      <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
    </body></html>`);
    printWindow.document.close();
    toast.success('Medical clearance PDF downloading...');
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
                {filteredSubmissions.map((submission) => (
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
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="records" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Completed Medical Records
          </TabsTrigger>
          <TabsTrigger value="clearance" className="flex items-center gap-2">
            <Award className="w-4 h-4" />
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
                          {selectedStudent.lastName}, {selectedStudent.firstName} — {selectedStudent.studentId}
                        </p>
                      </div>
                      <Button onClick={downloadRecordPDF} className="bg-green-600 hover:bg-green-700">
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF (Long Bond)
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-auto bg-white p-4" style={{ maxHeight: '70vh' }}>
                      <MedicalRecordPreview ref={recordPreviewRef} record={selectedStudent} />
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
                          3 copies (Student, Coordinator, Registrar) — A4 bond paper
                        </p>
                      </div>
                      <Button onClick={downloadClearancePDF} className="bg-green-600 hover:bg-green-700">
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF (A4)
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-auto bg-white p-2" style={{ maxHeight: '80vh' }}>
                      <MedicalClearancePreview ref={clearancePreviewRef} record={selectedStudent} />
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
