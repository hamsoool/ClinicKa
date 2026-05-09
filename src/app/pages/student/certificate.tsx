import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Download, FileText, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import type { MockSubmission } from '../../lib/mock-data';
import MedicalClearancePreview from '../../components/medical-clearance-preview';
import { toast } from 'sonner';
import { getStudentRecords } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function StudentCertificate() {
  const PREVIEW_BASE_WIDTH = 794;
  const navigate = useNavigate();
  const clearanceRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  const [isCompactPreview, setIsCompactPreview] = useState(false);
  const { me } = useAuth();
  const studentId = me?.student?.student_id || me?.profile.student_id || '';

  const { data, isLoading: loading, isError } = useQuery({
    queryKey: ['studentRecords', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const response = await getStudentRecords(studentId);
      return Array.isArray(response?.records) ? response.records : [];
    },
    enabled: !!studentId,
  });
  const records = Array.isArray(data) ? data : [];
  const record =
    records.find((entry) => entry.status === 'approved' && entry.clearanceInfo?.controlNo) ||
    records.find((entry) => entry.status === 'approved') ||
    records[0] ||
    null;

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load certificate');
    }
  }, [isError]);

  useLayoutEffect(() => {
    if (!record) return;

    const updateScale = () => {
      const viewport = previewViewportRef.current;
      const canvas = previewCanvasRef.current;
      if (!viewport || !canvas) return;

      const availableWidth = viewport.clientWidth - 4;
      const naturalHeight = canvas.scrollHeight;
      if (!naturalHeight) return;

      const useCompact = availableWidth < PREVIEW_BASE_WIDTH;
      const nextScale = useCompact ? availableWidth / PREVIEW_BASE_WIDTH : 1;
      setIsCompactPreview(useCompact);
      setPreviewScale(nextScale);
      setPreviewHeight(naturalHeight * nextScale);
    };

    updateScale();

    const observer = new ResizeObserver(() => {
      updateScale();
    });

    if (previewViewportRef.current) observer.observe(previewViewportRef.current);
    if (previewCanvasRef.current) observer.observe(previewCanvasRef.current);

    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
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

  if (!record) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <div className="mb-2 sm:mb-4">
          <h1 className="mb-2 text-2xl font-bold text-primary sm:text-3xl">Medical Clearance</h1>
          <p className="text-muted-foreground">View and download your medical clearance certificate</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-4 py-12 text-center sm:py-16">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No Record Found</p>
            <p className="max-w-md text-muted-foreground">
              You need to submit your medical record first before a clearance can be generated. Please go to <strong>Submit Record</strong> to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const normalizedStatus = String(record.status || '').toLowerCase();
  const isApproved = normalizedStatus === 'approved';
  const isPending = normalizedStatus === 'pending';
  const isReturned = normalizedStatus === 'returned';
  const isPhysicalExamDone = normalizedStatus === 'physical_exam_done';

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="mb-2 sm:mb-4">
        <h1 className="mb-2 text-2xl font-bold text-primary sm:text-3xl">Medical Clearance</h1>
        <p className="text-muted-foreground">View and download your medical clearance certificate (3 copies)</p>
      </div>

      {/* Status Banner */}
      {!isApproved && (
        <Card className="mb-1 border-l-4 border-l-yellow-500 sm:mb-3">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {isPending ? (
                <>
                  <Clock className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-yellow-800">Clearance Not Yet Available</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your medical record is still under review. Once approved by the clinic staff, your medical clearance will be available for download here.
                    </p>
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 mt-2">
                      <Clock className="w-3 h-3 mr-1" /> Pending Review
                    </Badge>
                  </div>
                </>
              ) : isReturned ? (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-900">Record Returned</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your medical record has been returned for revision. Please check the staff notes and resubmit your record.
                    </p>
                    {record.staffNotes && (
                      <div className="mt-2 p-3 rounded-md border border-amber-200 bg-amber-50/70">
                        <p className="text-sm font-medium text-amber-900">Staff Notes:</p>
                        <p className="text-sm text-amber-800 mt-1">{record.staffNotes}</p>
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
                    <Badge variant="secondary" className="bg-amber-100 text-amber-900 mt-2">
                      <AlertCircle className="w-3 h-3 mr-1" /> Returned
                    </Badge>
                  </div>
                </>
              ) : isPhysicalExamDone ? (
                <>
                  <Clock className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-900">Physical Exam Completed</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your checkup is complete, but the clearance is not yet finalized. Please wait for clinic approval.
                    </p>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 mt-2">
                      <Clock className="w-3 h-3 mr-1" /> Awaiting Final Approval
                    </Badge>
                  </div>
                </>
              ) : null}
              {!isPending && !isReturned && !isPhysicalExamDone ? (
                <>
                  <AlertCircle className="w-5 h-5 text-yellow-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-yellow-900">Clearance Not Available Yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Current status: <span className="font-medium">{normalizedStatus || 'unknown'}</span>. Your medical clearance will appear here once approved.
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clearance Preview - 3 copies */}
      {isApproved ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                <div>
                  <CardTitle>Medical Clearance Certificate</CardTitle>
                  <p className="text-sm text-green-600 font-medium mt-0.5">Approved - 3 copies on A4</p>
                </div>
              </div>
              <Button onClick={downloadClearancePDF} className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={previewViewportRef} className="overflow-hidden rounded-lg border bg-white p-1 sm:p-2">
              <div style={{ height: isCompactPreview ? (previewHeight ?? 'auto') : 'auto' }}>
                <div
                  ref={previewCanvasRef}
                  style={{
                    transform: `scale(${previewScale})`,
                    transformOrigin: isCompactPreview ? 'top left' : 'top center',
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
            <FileText className="w-16 h-16 text-muted-foreground mb-4 opacity-40" />
            <p className="text-muted-foreground">
              Medical clearance preview will appear here once your record is approved.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


