import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Download, FileText, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import type { MockSubmission } from '../../lib/mock-data';
import MedicalClearancePreview from '../../components/medical-clearance-preview';
import MedicalRecordPreview from '../../components/medical-record-preview';
import { toast } from 'sonner';
import { useAuth } from '../../lib/auth';
import { useStudentRecordsQuery } from './student-records-query';

export default function StudentClearance() {
  const PREVIEW_BASE_WIDTH = 794;
  const navigate = useNavigate();
  const clearanceRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const [isCompactPreview, setIsCompactPreview] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const { me } = useAuth();
  const studentId = me?.student?.student_id || me?.profile.student_id || '';

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
  const latestRecordPerYear = records.reduce<Partial<Record<1 | 2 | 3 | 4, MockSubmission>>>((acc, item) => {
    const yearNum = Number.parseInt(String(item.year || ''), 10) as 1 | 2 | 3 | 4;
    if (![1, 2, 3, 4].includes(yearNum)) return acc;
    const current = acc[yearNum];
    if (!current) {
      acc[yearNum] = item;
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

  useLayoutEffect(() => {
    if (!record) return;

    const updatePreviewMode = () => {
      const viewport = previewViewportRef.current;
      if (!viewport) return;

      setIsCompactPreview(viewport.clientWidth < PREVIEW_BASE_WIDTH);
    };

    updatePreviewMode();

    const observer = new ResizeObserver(() => {
      updatePreviewMode();
    });

    if (previewViewportRef.current) observer.observe(previewViewportRef.current);

    window.addEventListener('resize', updatePreviewMode);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePreviewMode);
    };
  }, [record]);

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
      exportRoot.style.width = `${PREVIEW_BASE_WIDTH}px`;
      exportRoot.style.background = '#fff';
      exportRoot.style.padding = '0';
      exportRoot.style.margin = '0';

      const clone = clearanceRef.current.cloneNode(true) as HTMLDivElement;
      clone.style.width = `${PREVIEW_BASE_WIDTH}px`;
      clone.style.maxWidth = `${PREVIEW_BASE_WIDTH}px`;
      clone.style.margin = '0';
      clone.style.padding = '0';
      clone.style.transform = 'none';

      exportRoot.appendChild(clone);
      document.body.appendChild(exportRoot);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: PREVIEW_BASE_WIDTH,
        windowWidth: PREVIEW_BASE_WIDTH,
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
    <div className="space-y-5 sm:space-y-6">
      <div className="mb-2 sm:mb-4">
        <h1 className="mb-2 text-2xl font-bold text-primary sm:text-3xl">Clearance</h1>
        <p className="text-muted-foreground">Manage your medical form and medical clearance in one place.</p>
      </div>

      <Tabs defaultValue="form">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="medical-clearance">Medical Clearance</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Medical Record Form</CardTitle>
              <p className="text-sm text-muted-foreground">
                Start a new submission or continue updating your current year medical record.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Use this to submit your yearly medical form before clearance is issued.
              </p>
              <Button onClick={() => navigate('/student/year-selection')} className="w-full sm:w-auto">
                Go to Form
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medical Record Preview (Combined Year 1-4)</CardTitle>
            </CardHeader>
            <CardContent>
              {profileRecord ? (
                <div className="max-h-[68vh] overflow-auto rounded-lg border bg-muted/30 p-2 sm:p-4 md:p-8">
                  <div className="mx-auto max-w-[816px] overflow-hidden rounded-sm bg-white shadow-lg ring-1 ring-black/5">
                    <MedicalRecordPreview record={profileRecord} yearlyRecords={latestRecordPerYear} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Medical form preview will appear here once you have at least one submitted record.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medical-clearance" className="space-y-4">
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
                  <CardContent>
                    {isCompactPreview ? (
                      <p className="mb-3 text-xs text-muted-foreground">
                        Swipe sideways to view the full medical clearance.
                      </p>
                    ) : null}
                    <div
                      ref={previewViewportRef}
                      className="overflow-x-auto overflow-y-hidden rounded-lg border bg-white p-1 sm:p-2"
                    >
                      <div className="min-w-max">
                        <div
                          style={{
                            width: `${PREVIEW_BASE_WIDTH}px`,
                            margin: isCompactPreview ? '0' : '0 auto',
                          }}
                        >
                          <MedicalClearancePreview ref={clearanceRef} record={record} />
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
