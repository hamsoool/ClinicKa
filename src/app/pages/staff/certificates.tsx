import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import PortalPageIntro from '../../components/portal-page-intro';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import type { SubmissionRecord } from '../../lib/record-types';
import MedicalRecordPreview from '../../components/medical-record-preview';
import MedicalClearancePreview from '../../components/medical-clearance-preview';
import InlinePdfViewer from '../../components/inline-pdf-viewer';
import { Search, FileText, X, ClipboardList, Award } from 'lucide-react';
import { toast } from 'sonner';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { useAuth } from '../../lib/auth';
import { getRoleLabel } from '../../lib/api';
import { getSubmissionSlotLabel, MAX_SUBMISSION_CYCLE } from '../../lib/academic-year';
import { loadStaffWorkspacePreferences } from './staff-workspace-preferences';
import {
  useStaffApprovedStudentsQuery,
  useStaffStudentCertificateRecordsQuery,
} from './staff-workflow-query';
import StaffRecords from './records';

type StaffSubmission = SubmissionRecord & {
  photoUrl?: string;
  signatureUrl?: string;
};

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
const RECORD_SLOT_FILTERS = Array.from({ length: MAX_SUBMISSION_CYCLE }, (_, index) => String(index + 1));
type StaffRecordsCertificatesTab = 'archive' | 'certificates';

const CERTIFICATE_SELECTION_STORAGE_KEY_PREFIX = 'gc-staff-certificate-selection';
const staffRecordsCertificatesTabs = new Set<StaffRecordsCertificatesTab>(['archive', 'certificates']);

function normalizeStaffRecordsCertificatesTab(value: string | null): StaffRecordsCertificatesTab {
  return staffRecordsCertificatesTabs.has(value as StaffRecordsCertificatesTab)
    ? (value as StaffRecordsCertificatesTab)
    : 'archive';
}

function formatMedicalFormFileName(lastName?: string) {
  const namePart = (lastName || 'Student')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  return `${namePart}.MedicalForm.pdf`;
}

function formatMedicalCertificateFileName(lastName?: string) {
  const namePart = (lastName || 'Student')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  return `${namePart}.MedicalCertificate.pdf`;
}

function getCertificateSelectionStorageKey(staffId?: string | null) {
  return `${CERTIFICATE_SELECTION_STORAGE_KEY_PREFIX}:${String(staffId || '').trim()}`;
}

function loadRememberedCertificateStudent(staffId?: string | null) {
  if (typeof window === 'undefined' || !staffId) return '';

  try {
    return window.localStorage.getItem(getCertificateSelectionStorageKey(staffId)) || '';
  } catch {
    return '';
  }
}

function persistRememberedCertificateStudent(staffId: string, studentId: string) {
  if (typeof window === 'undefined' || !staffId) return;
  window.localStorage.setItem(getCertificateSelectionStorageKey(staffId), studentId);
}

function clearRememberedCertificateStudent(staffId?: string | null) {
  if (typeof window === 'undefined' || !staffId) return;
  window.localStorage.removeItem(getCertificateSelectionStorageKey(staffId));
}

function ApprovedStudentsListSkeleton() {
  return (
    <div className="max-h-[500px] space-y-2 overflow-y-hidden" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded border border-outline-variant/40 p-3">
          <Skeleton className="h-4 w-3/4 bg-surface-container-high" />
          <Skeleton className="mt-2 h-3 w-24 bg-surface-container" />
          <Skeleton className="mt-2 h-3 w-5/6 bg-surface-container" />
        </div>
      ))}
    </div>
  );
}

function StaffCertificatePreviewSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="min-w-0">
      <div className="mb-4 grid gap-1 rounded-[18px] bg-muted p-1 sm:grid-cols-2">
        <Skeleton className="h-11 rounded-[18px] bg-white/90" />
        <Skeleton className="h-11 rounded-[18px] bg-surface-container-high" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-6 w-full max-w-sm bg-surface-container-high" />
              <Skeleton className="h-4 w-48 bg-surface-container" />
            </div>
            <Skeleton className="h-10 w-full rounded-md bg-primary/20 sm:w-56" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border bg-muted/30">
            <div className="px-2 py-2 sm:px-4 sm:py-4">
              <div className="mx-auto w-full max-w-[816px] rounded-sm bg-white p-6 shadow-[3px_5px_30px_rgba(0,0,0,0.16)] ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex gap-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-10 rounded-full bg-surface-container-high" />
                    ))}
                  </div>
                  <div className="flex-1 space-y-2 text-center">
                    <Skeleton className="mx-auto h-5 w-44 bg-surface-container-high" />
                    <Skeleton className="mx-auto h-3 w-64 bg-surface-container" />
                    <Skeleton className="mx-auto h-3 w-36 bg-surface-container" />
                  </div>
                  <Skeleton className="h-16 w-16 rounded-sm bg-surface-container-high" />
                </div>

                <div className="mt-8 space-y-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-4 w-full bg-surface-container" />
                  ))}
                </div>

                <div className="mt-8 grid grid-cols-4 gap-px overflow-hidden rounded border border-outline-variant/40 bg-outline-variant/40">
                  {Array.from({ length: 32 }).map((_, index) => (
                    <Skeleton key={index} className="h-8 rounded-none bg-white" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



function StaffCertificatesWorkspace() {
  const RECORD_PREVIEW_BASE_WIDTH = 816;
  const CLEARANCE_PREVIEW_BASE_WIDTH = 794;
  const STUDENTS_PER_PAGE = 10;
  const { me } = useAuth();
  const staffRoleLabel = getRoleLabel(me?.profile?.role, me?.staff?.position);
  const staffPreferenceId = String(me?.staff?.id || me?.profile.email || '').trim();
  const workspacePreferences = useMemo(
    () => loadStaffWorkspacePreferences(staffPreferenceId, staffRoleLabel),
    [staffPreferenceId, staffRoleLabel],
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() =>
    loadRememberedCertificateStudent(staffPreferenceId),
  );
  const [activeTab, setActiveTab] = useState<'form' | 'medical-clearance'>(
    workspacePreferences.certificatesDefaultView,
  );
  const [clearanceYearFilter, setClearanceYearFilter] = useState('all');
  const [lastDefaultedStudentId, setLastDefaultedStudentId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery.trim());



  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchQuery, departmentFilter, yearFilter]);

  useEffect(() => {
    setActiveTab(workspacePreferences.certificatesDefaultView);

    if (workspacePreferences.rememberLastCertificateStudent) {
      setSelectedStudentId(loadRememberedCertificateStudent(staffPreferenceId));
      return;
    }

    clearRememberedCertificateStudent(staffPreferenceId);
    setSelectedStudentId('');
  }, [
    staffPreferenceId,
    workspacePreferences.certificatesDefaultView,
    workspacePreferences.rememberLastCertificateStudent,
  ]);

  const {
    data: approvedStudentsData,
    isLoading: loading,
    isFetching: approvedStudentsFetching,
    isError,
  } = useStaffApprovedStudentsQuery({
    searchQuery: deferredSearchQuery,
    departmentFilter,
    yearFilter,
    page: currentPage,
    pageSize: STUDENTS_PER_PAGE,
  });

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load submissions');
    }
  }, [isError]);

  const studentRows = useMemo(
    () => approvedStudentsData?.students || [],
    [approvedStudentsData?.students],
  );
  const totalStudents = approvedStudentsData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalStudents / STUDENTS_PER_PAGE));
  const clampedPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('all');
    setYearFilter('all');
  };

  useEffect(() => {
    if (studentRows.length && !selectedStudentId) {
      setSelectedStudentId(studentRows[0].studentId || '');
      return;
    }
    if (selectedStudentId && !studentRows.some((row) => row.studentId === selectedStudentId)) {
      setSelectedStudentId(studentRows[0]?.studentId || '');
    }
  }, [studentRows, selectedStudentId]);

  useEffect(() => {
    if (!workspacePreferences.rememberLastCertificateStudent) {
      clearRememberedCertificateStudent(staffPreferenceId);
      return;
    }

    if (staffPreferenceId && selectedStudentId) {
      persistRememberedCertificateStudent(staffPreferenceId, selectedStudentId);
    }
  }, [
    selectedStudentId,
    staffPreferenceId,
    workspacePreferences.rememberLastCertificateStudent,
  ]);

  const {
    data: selectedStudentRecordsData = [],
    isFetching: selectedStudentRecordsFetching,
  } = useStaffStudentCertificateRecordsQuery(selectedStudentId);

  const selectedStudentRecords = useMemo(
    () => (Array.isArray(selectedStudentRecordsData) ? selectedStudentRecordsData : []) as StaffSubmission[],
    [selectedStudentRecordsData],
  );

  const selectedRecordsSorted = useMemo(
    () =>
      [...selectedStudentRecords].sort(
        (a, b) => new Date(b.updatedAt || b.submittedAt || 0).getTime() - new Date(a.updatedAt || a.submittedAt || 0).getTime(),
      ),
    [selectedStudentRecords],
  );
  const combinedRecord = selectedRecordsSorted[0] || null;
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

  useEffect(() => {
    if (selectedStudentId && selectedStudentId !== lastDefaultedStudentId && !selectedStudentRecordsFetching) {
      if (availableYears.length > 0) {
        setClearanceYearFilter(availableYears[availableYears.length - 1]);
        setLastDefaultedStudentId(selectedStudentId);
      } else {
        setClearanceYearFilter('all');
        setLastDefaultedStudentId(selectedStudentId);
      }
    }
  }, [selectedStudentId, availableYears, selectedStudentRecordsFetching, lastDefaultedStudentId]);

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

  const handleStudentSelect = (studentId: string) => {
    if (!studentId || studentId === selectedStudentId) return;
    setSelectedStudentId(studentId);
  };



  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.7fr)] xl:items-start">
        <div className="min-w-0">
            <Card>
              <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Approved Students</CardTitle>
                {!loading && approvedStudentsFetching ? (
                  <span className="text-xs text-muted-foreground">Refreshing...</span>
                ) : null}
              </div>
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
                      <SelectValue placeholder="All Record Slots" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Record Slots</SelectItem>
                      {RECORD_SLOT_FILTERS.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {getSubmissionSlotLabel(slot)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-1">
                    {departmentFilter !== 'all' && <Badge variant="outline" className="px-1 text-[10px]">{departmentFilter}</Badge>}
                    {yearFilter !== 'all' && <Badge variant="outline" className="px-1 text-[10px]">{getSubmissionSlotLabel(yearFilter)}</Badge>}
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-5 px-1 text-[10px]">
                      <X className="mr-0.5 h-3 w-3" /> Clear
                    </Button>
                  </div>
                )}

                {loading ? (
                  <ApprovedStudentsListSkeleton />
                ) : studentRows.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground">No approved records found</div>
                ) : (
                  <div className="max-h-[500px] space-y-2 overflow-y-auto">
                    {studentRows.map((student) => (
                      <button
                        type="button"
                        key={student.studentId}
                        className={`w-full cursor-pointer rounded border p-3 text-left transition-colors ${
                          selectedStudentId === student.studentId ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        }`}
                        onClick={() => handleStudentSelect(student.studentId || '')}
                      >
                        <p className="text-sm font-medium">{student.lastName}, {student.firstName} {student.middleInitial || ''}</p>
                        <p className="text-xs text-muted-foreground">{student.studentId}</p>
                        <p className="text-xs text-muted-foreground">{student.course}</p>
                      </button>
                    ))}
                  </div>
                )}

                {!loading && totalPages > 1 ? (
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <p className="text-xs text-muted-foreground">Page {clampedPage} of {totalPages}</p>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={clampedPage <= 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>Previous</Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={clampedPage >= totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>Next</Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0">
          {selectedStudentId && selectedStudentRecordsFetching && !combinedRecord ? (
            <StaffCertificatePreviewSkeleton />
          ) : !combinedRecord ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ClipboardList className="mb-4 h-16 w-16 text-muted-foreground" />
                <p className="text-muted-foreground">Select a student from the list to view combined previews.</p>
              </CardContent>
            </Card>
          ) : (
            <Tabs className="min-w-0" value={activeTab} onValueChange={(value) => setActiveTab(value as 'form' | 'medical-clearance')}>
              <TabsList className="mb-4 h-auto w-full flex-col items-stretch gap-1 p-1 sm:grid sm:grid-cols-2">
                <TabsTrigger value="form" className="min-h-11 justify-center gap-2 px-3 text-center whitespace-normal">
                  <ClipboardList className="h-4 w-4" />
                  Form
                </TabsTrigger>
                <TabsTrigger value="medical-clearance" className="min-h-11 justify-center gap-2 px-3 text-center whitespace-normal">
                  <Award className="h-4 w-4" />
                  Medical Certificate
                </TabsTrigger>
              </TabsList>

              <TabsContent value="form" className="min-w-0">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="leading-snug">Medical Submission Form</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{combinedRecord.lastName}, {combinedRecord.firstName} | {combinedRecord.studentId}</p>
                        {selectedStudentRecordsFetching ? (
                          <span className="mt-2 block text-xs text-muted-foreground">Refreshing selected student...</span>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                      <InlinePdfViewer
                        title="Medical Submission Form"
                        fileName={formatMedicalFormFileName(combinedRecord.lastName)}
                        documentKey={`staff-record-${combinedRecord.id}-${selectedRecordsSorted.map((entry) => `${entry.id}:${entry.updatedAt || entry.submittedAt || ''}`).join('|')}`}
                        pageFormat="legal"
                        sourceContent={
                          <div
                            className="overflow-hidden rounded-sm bg-white shadow-[3px_5px_30px_rgba(0,0,0,0.16)] ring-1 ring-black/5 print:w-[816px]"
                            style={{ width: `${RECORD_PREVIEW_BASE_WIDTH}px` }}
                        >
                          <MedicalRecordPreview
                            record={combinedRecord}
                            records={selectedRecordsSorted}
                          />
                        </div>
                      }
                    />

                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="medical-clearance" className="min-w-0">
                <div className="mb-4 flex justify-end">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Filter by Record Slot:</span>
                    <Select value={clearanceYearFilter} onValueChange={setClearanceYearFilter}>
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Select record slot" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Record Slots</SelectItem>
                        {availableYears.map((year) => (
                          <SelectItem key={year} value={year}>
                            {getSubmissionSlotLabel(year)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {clearanceRecord ? (
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="leading-snug">Medical Certificate</CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">3 copies (Student, Coordinator, Registrar) | A4 bond paper</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <InlinePdfViewer
                        title="Medical Certificate"
                        fileName={formatMedicalCertificateFileName(clearanceRecord.lastName)}
                        documentKey={`staff-certificate-${clearanceRecord.id}-${clearanceRecord.updatedAt || clearanceRecord.submittedAt || ''}`}
                        pageFormat="a4"
                        sourceContent={
                          <div className="print:w-[794px] lg:mx-auto" style={{ width: `${CLEARANCE_PREVIEW_BASE_WIDTH}px` }}>
                            <MedicalClearancePreview record={clearanceRecord} />
                          </div>
                        }
                      />

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
  );
}

export default function StaffRecordsAndCertificates() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeWorkspaceTab = normalizeStaffRecordsCertificatesTab(searchParams.get('tab'));

  const handleWorkspaceTabChange = (value: string) => {
    const nextTab = normalizeStaffRecordsCertificatesTab(value);
    const nextParams = new URLSearchParams(searchParams);

    if (nextTab === 'archive') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }

    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-[100rem] min-w-0">
      <PortalPageIntro
        className="mb-8"
        title="Records & Certificates"
      />

      <Tabs className="min-w-0" value={activeWorkspaceTab} onValueChange={handleWorkspaceTabChange}>
        <TabsList className="mb-4 h-auto w-full flex-col items-stretch gap-1 p-1 sm:grid sm:grid-cols-2">
          <TabsTrigger value="certificates" className="min-h-11 justify-center gap-2 px-3 text-center whitespace-normal">
            <Award className="h-4 w-4" />
            Certificates
          </TabsTrigger>
          <TabsTrigger value="archive" className="min-h-11 justify-center gap-2 px-3 text-center whitespace-normal">
            <FileText className="h-4 w-4" />
            Records Archive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="certificates" className="min-w-0">
          <StaffCertificatesWorkspace />
        </TabsContent>

        <TabsContent value="archive" className="min-w-0">
          <StaffRecords embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
