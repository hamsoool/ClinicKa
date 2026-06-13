import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { FileText, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import StudentPageIntro from '../../components/student-page-intro';
import type { SubmissionRecord } from '../../lib/record-types';
import MedicalClearancePreview from '../../components/medical-clearance-preview';
import MedicalRecordPreview from '../../components/medical-record-preview';
import InlinePdfViewer from '../../components/inline-pdf-viewer';
import { toast } from 'sonner';
import { useAuth } from '../../lib/auth';
import { formatAcademicYearLabel, getRecordAcademicYear, getSubmissionSlotLabel } from '../../lib/academic-year';
import { useAcademicYear } from '../../lib/academic-year-query';
import { createMedicalCertificatePdfBlob, createMedicalRecordPdfBlob } from '../../lib/medical-record-pdf-export';
import { useStudentRecordsQuery } from './student-records-query';

type StudentClearanceTab = 'history' | 'form' | 'medical-clearance';

const clearanceTabs = new Set<StudentClearanceTab>(['history', 'form', 'medical-clearance']);

function normalizeClearanceTab(value: string | null): StudentClearanceTab {
  return clearanceTabs.has(value as StudentClearanceTab) ? (value as StudentClearanceTab) : 'form';
}

const styles = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fadeIn 0.4s ease-out forwards;
  }
`;

export default function StudentClearance() {
  const RECORD_PREVIEW_BASE_WIDTH = 816;
  const CLEARANCE_PREVIEW_BASE_WIDTH = 794;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const recordPreviewRef = useRef<HTMLDivElement>(null);
  const clearanceRef = useRef<HTMLDivElement>(null);
  const activeTab = normalizeClearanceTab(searchParams.get('tab'));
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const { me } = useAuth();
  const { academicYear: activeAcademicYear } = useAcademicYear();
  const studentId = me?.student?.student_id || me?.profile.student_id || '';

  // Inject styles once on mount
  useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  const { data = [], isLoading: loading, isError } = useStudentRecordsQuery(studentId);
  const records = data;
  const yearOptions = useMemo(
    () =>
      Array.from(new Set(records.map((entry) => String(entry.year || '')).filter(Boolean))).sort(
        (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
      ),
    [records],
  );
  const requestedYear = searchParams.get('year') || 'all';
  const selectedYear =
    !loading && requestedYear !== 'all' && !yearOptions.includes(requestedYear)
      ? 'all'
      : requestedYear;

  useEffect(() => {
    if (loading) return;
    if (requestedYear === 'all' || yearOptions.includes(requestedYear)) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('year');
    setSearchParams(nextParams, { replace: true });
  }, [loading, requestedYear, searchParams, setSearchParams, yearOptions]);

  const filteredRecords = useMemo(
    () => (selectedYear === 'all' ? records : records.filter((entry) => String(entry.year || '') === selectedYear)),
    [records, selectedYear],
  );
  const sortedFilteredRecords = [...filteredRecords].sort(
    (a, b) => new Date(b.updatedAt || b.submittedAt).getTime() - new Date(a.updatedAt || a.submittedAt).getTime(),
  );
  const record =
    sortedFilteredRecords.find((entry) => entry.status === 'approved' && entry.clearanceInfo?.controlNo) ||
    sortedFilteredRecords.find((entry) => entry.status === 'approved') ||
    sortedFilteredRecords[0] ||
    null;
  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.updatedAt || b.submittedAt).getTime() - new Date(a.updatedAt || a.submittedAt).getTime(),
  );
  const profileRecord = sortedRecords[0] || null;
  const recordAcademicYearLabel = profileRecord
    ? formatAcademicYearLabel(getRecordAcademicYear(profileRecord, activeAcademicYear))
    : formatAcademicYearLabel(activeAcademicYear);
  const clearanceAcademicYearLabel = record
    ? formatAcademicYearLabel(getRecordAcademicYear(record, activeAcademicYear))
    : formatAcademicYearLabel(activeAcademicYear);
  useEffect(() => {
    if (isError) {
      toast.error('Failed to load clearance details');
    }
  }, [isError]);

  const createRecordPdfBlob = useCallback(() => {
    if (!profileRecord) return Promise.reject(new Error('No medical record is available.'));
    return createMedicalRecordPdfBlob(profileRecord, sortedRecords, recordAcademicYearLabel);
  }, [profileRecord, recordAcademicYearLabel, sortedRecords]);

  const createClearancePdfBlob = useCallback(() => {
    if (!record) return Promise.reject(new Error('No medical certificate is available.'));
    return createMedicalCertificatePdfBlob(record, clearanceAcademicYearLabel);
  }, [clearanceAcademicYearLabel, record]);

  const handleTabChange = (value: string) => {
    const nextTab = normalizeClearanceTab(value);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  const handleYearChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value === 'all') {
      nextParams.delete('year');
    } else {
      nextParams.set('year', value);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case 'in_review':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case 'physical_exam_done':
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">Physical Exam Done</Badge>;
      case 'returned':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Returned</Badge>;
      case 'resubmitted':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Resubmitted</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return <PortalPageSkeleton variant="certificate" />;
  }

  const normalizedStatus = String(record?.status || '').toLowerCase();
  const isApproved = normalizedStatus === 'approved';
  const isPending = normalizedStatus === 'pending';
  const isInReview = normalizedStatus === 'in_review';
  const isReturned = normalizedStatus === 'returned';
  const isPhysicalExamDone = normalizedStatus === 'physical_exam_done';

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-5 sm:space-y-6">
      <StudentPageIntro
        title="Records & Clearance"
      />

      <Tabs className="min-w-0" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-auto w-full flex-col items-stretch gap-1 p-1 sm:grid sm:grid-cols-3">
          <TabsTrigger value="form" className="min-h-11 justify-center px-3 text-center whitespace-normal">Form</TabsTrigger>
          <TabsTrigger value="medical-clearance" className="min-h-11 justify-center px-3 text-center whitespace-normal">Medical Certificate</TabsTrigger>
          <TabsTrigger value="history" className="min-h-11 justify-center px-3 text-center whitespace-normal">History</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="min-w-0 space-y-4 animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Medical Record History</CardTitle>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No records found</p>
                  <p className="text-sm">Submit your first medical record to see your history here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedRecords.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col justify-between gap-3 rounded-[18px] border border-outline-variant/25 bg-white p-4 transition-colors sm:flex-row sm:items-start"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-bold leading-tight">{formatAcademicYearLabel(getRecordAcademicYear(entry))} Medical Record</p>
                          <div className="mt-1.5 flex flex-col gap-0.5">
                            <p className="flex items-center text-xs text-muted-foreground sm:text-sm">
                              <span className="mr-1 font-medium text-foreground">Submitted:</span>
                              {new Date(entry.submittedAt).toLocaleDateString()}
                            </p>
                            {entry.status === 'approved' && entry.updatedAt && (
                              <p className="flex items-center text-xs font-medium text-green-600 sm:text-sm">
                                <span className="mr-1">Approved:</span>
                                {new Date(entry.updatedAt).toLocaleDateString()}
                              </p>
                            )}
                            {entry.status === 'resubmitted' && entry.updatedAt && (
                              <p className="flex items-center text-xs font-medium text-orange-600 sm:text-sm">
                                <span className="mr-1">Resubmitted:</span>
                                {new Date(entry.updatedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          {entry.staffNotes ? (
                            <div className="mt-3 hidden rounded-md border border-red-100 bg-red-50 p-2 text-xs text-red-700 sm:block sm:max-w-[320px]">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <p className={`${expandedNotes[entry.id] ? '' : 'line-clamp-2'}`}>
                                  <strong>Staff Note:</strong> {entry.staffNotes}
                                </p>
                              </div>
                              {entry.staffNotes.length > 100 ? (
                                <button
                                  type="button"
                                  className="mt-1 text-[11px] font-semibold underline underline-offset-2"
                                  onClick={() =>
                                    setExpandedNotes((prev) => ({
                                      ...prev,
                                      [entry.id]: !prev[entry.id],
                                    }))
                                  }
                                >
                                  {expandedNotes[entry.id] ? 'See less' : 'See more'}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:items-end">
                        {entry.staffNotes ? (
                          <div className="w-full rounded-md border border-red-100 bg-red-50 p-2 text-xs text-red-700 sm:hidden">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                              <p className={`${expandedNotes[entry.id] ? '' : 'line-clamp-2'}`}>
                                <strong>Staff Note:</strong> {entry.staffNotes}
                              </p>
                            </div>
                            {entry.staffNotes.length > 100 ? (
                              <button
                                type="button"
                                className="mt-1 text-[11px] font-semibold underline underline-offset-2"
                                onClick={() =>
                                  setExpandedNotes((prev) => ({
                                    ...prev,
                                    [entry.id]: !prev[entry.id],
                                  }))
                                }
                              >
                                {expandedNotes[entry.id] ? 'See less' : 'See more'}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="self-start sm:self-auto">{getStatusBadge(entry.status)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="form" className="min-w-0 space-y-4 animate-fade-in">
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg">Medical Record Form</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Submit the active school year medical record or continue an existing one before your medical certificate is issued.
                </p>
              </div>
              <Button onClick={() => navigate('/student/year-selection')} className="w-full shrink-0 sm:w-auto">
                Open Form
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Medical Record PDF</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {profileRecord ? (
                <>
                  <InlinePdfViewer
                    title="Medical Record Form"
                    fileName={`${profileRecord.studentId || 'medical-record'}.pdf`}
                    documentKey={`student-record-${profileRecord.id}-${recordAcademicYearLabel}-${sortedRecords.map((item) => `${item.id}:${item.updatedAt || item.submittedAt || ''}`).join('|')}`}
                    createBlob={createRecordPdfBlob}
                  />
                  <details className="rounded-lg border bg-muted/20">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-on-surface">
                      Show rendered medical record preview
                    </summary>
                    <div className="border-t px-2 py-2 sm:px-4 sm:py-4 lg:max-h-[72vh] lg:overflow-auto">
                      <div className="overflow-x-auto overscroll-x-contain">
                        <div className="flex w-max min-w-full justify-center print:w-full">
                          <div
                            className="w-[816px] shrink-0 overflow-hidden rounded-sm bg-white shadow-[3px_5px_30px_rgba(0,0,0,0.16)] ring-1 ring-black/5 print:w-[816px]"
                            style={{ width: `${RECORD_PREVIEW_BASE_WIDTH}px` }}
                          >
                            <MedicalRecordPreview
                              ref={recordPreviewRef}
                              record={profileRecord}
                              records={sortedRecords}
                              academicYearLabel={recordAcademicYearLabel}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Medical form preview will appear here once you have at least one submitted record.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medical-clearance" className="min-w-0 space-y-4 animate-fade-in">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-2 sm:max-w-xs">
                <p className="text-sm font-medium">Filter by Record Slot</p>
                <Select value={selectedYear} onValueChange={handleYearChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select record slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Record Slots</SelectItem>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        {getSubmissionSlotLabel(year)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {!record ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center px-4 py-12 text-center sm:py-16">
                <FileText className="mb-4 h-16 w-16 text-muted-foreground" />
                <p className="mb-2 text-lg font-medium">No Record Found</p>
                <p className="max-w-md text-muted-foreground">
                  No medical record matched the selected record slot. Try another option or submit a form first.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {!isApproved && (
                <Card className="mb-1 border-l-4 border-l-yellow-500 sm:mb-3">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      {isPending || isInReview ? (
                        <>
                          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
                          <div>
                            <p className="font-medium text-yellow-800">Clearance Not Yet Available</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {isInReview
                                ? 'A clinic staff member is currently reviewing your medical record. Once approved, your medical certificate will be available for download here.'
                                : 'Your medical record is waiting to be picked up for review. Once clinic staff starts processing it, your status will update here.'}
                            </p>
                            <Badge variant="secondary" className="mt-2 bg-yellow-100 text-yellow-800">
                              <Clock className="mr-1 h-3 w-3" /> Pending
                            </Badge>
                          </div>
                        </>
                      ) : isReturned ? (
                        <>
                          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                          <div>
                            <p className="font-medium text-amber-900">Record Returned</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Your medical record has been returned for revision. Please check the staff notes and resubmit your record.
                            </p>
                            {record.staffNotes && (
                              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 p-3">
                                <p className="text-sm font-medium text-amber-900">Staff Notes:</p>
                                <p className="mt-1 text-sm text-amber-800">{record.staffNotes}</p>
                              </div>
                            )}
                            <div className="mt-3">
                              <Button
                                onClick={() =>
                                  navigate(
                                    `/student/privacy-waiver/${record.year || '1'}?edit=${encodeURIComponent(record.id)}`,
                                  )
                                }
                                size="sm"
                                className="w-full bg-amber-700 hover:bg-amber-800 sm:w-auto"
                              >
                                Edit and Resubmit
                              </Button>
                            </div>
                            <Badge variant="secondary" className="mt-2 bg-amber-100 text-amber-900">
                              <AlertCircle className="mr-1 h-3 w-3" /> Returned
                            </Badge>
                          </div>
                        </>
                      ) : isPhysicalExamDone ? (
                        <>
                          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                          <div>
                            <p className="font-medium text-amber-900">Physical Exam Completed</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Your checkup is complete, but the medical certificate is not yet finalized. Please wait for clinic approval.
                            </p>
                            <Badge variant="secondary" className="mt-2 bg-amber-100 text-amber-800">
                              <Clock className="mr-1 h-3 w-3" /> Awaiting Final Approval
                            </Badge>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-700" />
                          <div>
                            <p className="font-medium text-yellow-900">Clearance Not Available Yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Current status: <span className="font-medium">{normalizedStatus || 'unknown'}</span>. Your medical certificate will appear here once approved.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {isApproved ? (
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-green-600" />
                        <div>
                          <CardTitle>Medical Certificate</CardTitle>
                          <p className="mt-0.5 text-sm font-medium text-green-600">Approved - 3 copies on A4</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <InlinePdfViewer
                      title="Medical Certificate"
                      fileName={`${record.studentId || 'medical-certificate'}.pdf`}
                      documentKey={`student-certificate-${record.id}-${record.updatedAt || record.submittedAt || ''}-${clearanceAcademicYearLabel}`}
                      createBlob={createClearancePdfBlob}
                    />
                    <details className="rounded-lg border bg-muted/20">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-on-surface">
                        Show rendered medical certificate preview
                      </summary>
                      <div className="border-t bg-white px-1 py-1 sm:px-2 sm:py-2 lg:max-h-[72vh] lg:overflow-auto">
                        <div className="overflow-auto overscroll-contain">
                          <div className="w-max print:w-full lg:w-full">
                            <div className="print:w-[794px] lg:mx-auto" style={{ width: `${CLEARANCE_PREVIEW_BASE_WIDTH}px` }}>
                              <MedicalClearancePreview
                                ref={clearanceRef}
                                record={record}
                                academicYearLabel={clearanceAcademicYearLabel}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center px-4 py-12 text-center sm:py-16">
                    <FileText className="mb-4 h-16 w-16 text-muted-foreground opacity-40" />
                    <p className="text-muted-foreground">Medical certificate preview will appear here once your record is approved.</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
