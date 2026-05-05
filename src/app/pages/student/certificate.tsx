import { useEffect, useRef } from 'react';
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
  const navigate = useNavigate();
  const clearanceRef = useRef<HTMLDivElement>(null);
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

  const downloadClearancePDF = () => {
    if (!clearanceRef.current || !record) return;

    const content = clearanceRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=794,height=1123');
    if (!printWindow) {
      toast.error('Please allow pop-ups to download the certificate');
      return;
    }

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Medical Clearance - ${record.firstName} ${record.lastName}</title>
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

  if (loading) {
    return <PortalPageSkeleton variant="certificate" />;
  }

  if (!record) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Medical Clearance</h1>
          <p className="text-muted-foreground">View and download your medical clearance certificate</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No Record Found</p>
            <p className="text-muted-foreground text-center max-w-md">
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
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Medical Clearance</h1>
        <p className="text-muted-foreground">View and download your medical clearance certificate (3 copies)</p>
      </div>

      {/* Status Banner */}
      {!isApproved && (
        <Card className="mb-6 border-l-4 border-l-yellow-500">
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
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-red-800">Record Returned</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your medical record has been returned for revision. Please check the staff notes and resubmit your record.
                    </p>
                    {record.staffNotes && (
                      <div className="mt-2 p-3 bg-red-50 rounded-md border border-red-100">
                        <p className="text-sm font-medium text-red-800">Staff Notes:</p>
                        <p className="text-sm text-red-700 mt-1">{record.staffNotes}</p>
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
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Edit and Resubmit
                      </Button>
                    </div>
                    <Badge variant="secondary" className="bg-red-100 text-red-800 mt-2">
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
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                <div>
                  <CardTitle>Medical Clearance Certificate</CardTitle>
                  <p className="text-sm text-green-600 font-medium mt-0.5">Approved - 3 copies on A4</p>
                </div>
              </div>
              <Button onClick={downloadClearancePDF} className="bg-primary text-on-primary hover:bg-primary/90">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto bg-white p-2">
              <MedicalClearancePreview ref={clearanceRef} record={record} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-16 h-16 text-muted-foreground mb-4 opacity-40" />
            <p className="text-muted-foreground text-center">
              Medical clearance preview will appear here once your record is approved.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


