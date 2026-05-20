import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Download, FileText, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import StudentPageIntro from '../../components/student-page-intro';
import type { SubmissionRecord } from '../../lib/record-types';
import MedicalClearancePreview from '../../components/medical-clearance-preview';
import MedicalRecordPreview from '../../components/medical-record-preview';
import { toast } from 'sonner';
import { useAuth } from '../../lib/auth';
import { useStudentRecordsQuery } from './student-records-query';

type StudentClearanceTab = 'history' | 'form' | 'medical-clearance';

const clearanceTabs = new Set<StudentClearanceTab>(['history', 'form', 'medical-clearance']);

function normalizeClearanceTab(value: string | null): StudentClearanceTab {
  return clearanceTabs.has(value as StudentClearanceTab) ? (value as StudentClearanceTab) : 'history';
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
  const clearanceRef = useRef<HTMLDivElement>(null);
  const activeTab = normalizeClearanceTab(searchParams.get('tab'));
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const { me } = useAuth();
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

  useEffect(() => {
    if (selectedYear !== 'all' && !yearOptions.includes(selectedYear)) {
      setSelectedYear('all');
    }
  }, [selectedYear, yearOptions]);

  const filteredRecords = useMemo(
    () => (selectedYear === 'all' ? records : records.filter((entry) => String(entry.year || '') === selectedYear)),
    [records, selectedYear],
  );
  const record =
    filteredRecords.find((entry) => entry.status === 'approved' && entry.clearanceInfo?.controlNo) ||
    filteredRecords.find((entry) => entry.status === 'approved') ||
    filteredRecords[0] ||
    null;
  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.updatedAt || b.submittedAt).getTime() - new Date(a.updatedAt || a.submittedAt).getTime(),
  );
  const profileRecord = sortedRecords[0] || null;
  const examCompletenessScore = (entry: SubmissionRecord) => {
    const exam = entry.staffMeasurements || {};
    const values = [
      exam.bloodPressure,
      exam.cardiacRate,
      exam.respiratoryRate,
      exam.temperature,
      exam.weight,
      exam.height,
      exam.bmi,
      exam.visualAcuity,
      exam.skin,
      exam.heent,
      exam.chestLungs,
      exam.heart,
      exam.abdomen,
      exam.extremities,
      exam.others,
      exam.examinedBy,
      entry.bloodPressure,
      entry.weight,
      entry.height,
      entry.bmi,
    ];

    return values.filter((value) => String(value || '').trim().length > 0).length;
  };

  const latestRecordPerYear = records.reduce<Partial<Record<1 | 2 | 3 | 4, SubmissionRecord>>>((acc, item) => {
    const yearNum = Number.parseInt(String(item.year || ''), 10) as 1 | 2 | 3 | 4;
    if (![1, 2, 3, 4].includes(yearNum)) return acc;
    const current = acc[yearNum];
    if (!current) {
      acc[yearNum] = item;
      return acc;
    }
    const currentScore = examCompletenessScore(current);
    const nextScore = examCompletenessScore(item);
    if (nextScore > currentScore) {
      acc[yearNum] = item;
      return acc;
    }
    if (currentScore > nextScore) {
      return acc;
    }
    const currentTs = new Date(current.updatedAt || current.submittedAt).getTime();
    const nextTs = new Date(item.updatedAt || item.submittedAt).getTime();
    if (nextTs >= currentTs) acc[yearNum] = item;
    return acc;
  }, {});

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load clearance details');
    }
  }, [isError]);

  const downloadClearancePDF = async () => {
    if (!clearanceRef.current || !record) return;
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const exportRoot = document.createElement('div');
      exportRoot.style.position = 'fixed';
      exportRoot.style.left = '-10000px';
      exportRoot.style.top = '0';
      exportRoot.style.width = `${CLEARANCE_PREVIEW_BASE_WIDTH}px`;
      exportRoot.style.background = '#fff';
      exportRoot.style.padding = '0';
      exportRoot.style.margin = '0';

      const clone = clearanceRef.current.cloneNode(true) as HTMLDivElement;
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
      pdf.save(`medical_clearance_${record.lastName}_${record.firstName}.pdf`);
      toast.success('Medical clearance PDF downloaded.');
    } catch (error) {
      console.error('Failed to generate clearance PDF:', error);
      toast.error('Failed to download PDF. Please try again.');
    }
  };

  const handleTabChange = (value: string) => {
    const nextTab = normalizeClearanceTab(value);
    const nextParams = new URLSearchParams(searchParams);

    if (nextTab === 'history') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending Review</Badge>;
      case 'in_review':
        return <Badge className="bg-sky-100 text-sky-800 border-sky-200">In Review</Badge>;
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
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
      <StudentPageIntro
        title="Records & Clearance"
        description="Track your submissions, open your medical form, and download your clearance when approved."
      />

      <Tabs className="min-w-0" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-auto w-full flex-col items-stretch gap-1 p-1 sm:grid sm:grid-cols-3">
          <TabsTrigger value="history" className="min-h-11 justify-center px-3 text-center whitespace-normal">History</TabsTrigger>
          <TabsTrigger value="form" className="min-h-11 justify-center px-3 text-center whitespace-normal">Form</TabsTrigger>
          <TabsTrigger value="medical-clearance" className="min-h-11 justify-center px-3 text-center whitespace-normal">Medical Clearance</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="min-w-0 space-y-4 animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Medical Record History</CardTitle>
              <p className="text-sm text-muted-foreground">Track every submitted record and review status by year.</p>
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
                      className="flex flex-col justify-between gap-3 rounded-xl border border-outline-variant/25 bg-white p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-start"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-bold leading-tight">Year {entry.year} Medical Record</p>
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
                  Submit a new yearly medical record or continue an existing one before clearance is issued.
                </p>
              </div>
              <Button onClick={() => navigate('/student/year-selection')} className="w-full shrink-0 sm:w-auto">
                Open Form
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medical Record Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profileRecord ? (
                <>
                  <p className="text-xs text-muted-foreground lg:hidden">
                    Swipe sideways on mobile to view the full medical record.
                  </p>
                  <div className="overflow-hidden rounded-lg border bg-muted/30">
                    <div className="px-2 py-2 sm:px-4 sm:py-4 lg:max-h-[72vh] lg:overflow-auto">
                      <div className="overflow-x-auto overscroll-x-contain">
                        <div className="flex min-w-full justify-start lg:justify-center">
                          <div
                            className="w-[816px] shrink-0 overflow-hidden rounded-sm bg-white shadow-lg ring-1 ring-black/5"
                            style={{ width: `${RECORD_PREVIEW_BASE_WIDTH}px` }}
                          >
                            <MedicalRecordPreview record={profileRecord} yearlyRecords={latestRecordPerYear} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
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
                <p className="text-sm font-medium">Filter by Year</p>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        Year {year}
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
                  No medical record matched the selected year. Try another year or submit a form first.
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
                          <Clock className={`mt-0.5 h-5 w-5 shrink-0 ${isInReview ? 'text-sky-600' : 'text-yellow-600'}`} />
                          <div>
                            <p className={`font-medium ${isInReview ? 'text-sky-800' : 'text-yellow-800'}`}>Clearance Not Yet Available</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {isInReview
                                ? 'A clinic staff member is currently reviewing your medical record. Once approved, your medical clearance will be available for download here.'
                                : 'Your medical record is waiting to be picked up for review. Once clinic staff starts processing it, your status will update here.'}
                            </p>
                            <Badge variant="secondary" className={`mt-2 ${isInReview ? 'bg-sky-100 text-sky-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              <Clock className="mr-1 h-3 w-3" /> {isInReview ? 'In Review' : 'Pending Review'}
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
                              Your checkup is complete, but the clearance is not yet finalized. Please wait for clinic approval.
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
                              Current status: <span className="font-medium">{normalizedStatus || 'unknown'}</span>. Your medical clearance will appear here once approved.
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
                          <CardTitle>Medical Clearance Certificate</CardTitle>
                          <p className="mt-0.5 text-sm font-medium text-green-600">Approved - 3 copies on A4</p>
                        </div>
                      </div>
                      <Button onClick={downloadClearancePDF} className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto">
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground lg:hidden">
                      Swipe sideways on mobile to view the full medical clearance.
                    </p>
                    <div className="overflow-hidden rounded-lg border bg-white">
                      <div className="px-1 py-1 sm:px-2 sm:py-2 lg:max-h-[72vh] lg:overflow-auto">
                        <div className="overflow-x-auto overscroll-x-contain">
                          <div className="mx-auto w-max">
                            <div style={{ width: `${CLEARANCE_PREVIEW_BASE_WIDTH}px` }}>
                              <MedicalClearancePreview ref={clearanceRef} record={record} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center px-4 py-12 text-center sm:py-16">
                    <FileText className="mb-4 h-16 w-16 text-muted-foreground opacity-40" />
                    <p className="text-muted-foreground">Medical clearance preview will appear here once your record is approved.</p>
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