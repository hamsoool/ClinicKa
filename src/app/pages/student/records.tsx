import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import type { MockSubmission } from '../../lib/mock-data';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Eye, X, ArrowLeft, AlertCircle } from 'lucide-react';
import MedicalRecordPreview from '../../components/medical-record-preview';
import { getStudentRecords } from '../../lib/api';
import { toast } from 'sonner';
import { useAuth } from '../../lib/auth';

export default function StudentRecords() {
  const [selectedRecord, setSelectedRecord] = useState<MockSubmission | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  const [isCompactPreview, setIsCompactPreview] = useState(false);
  const PREVIEW_BASE_WIDTH = 816;
  const { me } = useAuth();
  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const { data, isLoading: loading, isError } = useQuery({
    queryKey: ['studentRecords', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const response = await getStudentRecords(studentId);
      return Array.isArray(response?.records) ? response.records : [];
    },
    enabled: !!studentId,
  });

  const records = Array.isArray(data) ? data : [];

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load records');
    }
  }, [isError]);

  useLayoutEffect(() => {
    if (!selectedRecord) return;

    const updateScale = () => {
      const viewport = previewViewportRef.current;
      const canvas = previewCanvasRef.current;
      if (!viewport || !canvas) return;

      const availableWidth = Math.max(0, viewport.clientWidth - 6);
      const naturalHeight = canvas.scrollHeight;
      if (!naturalHeight) return;

      const compact = availableWidth < PREVIEW_BASE_WIDTH;
      const nextScale = compact ? availableWidth / PREVIEW_BASE_WIDTH : 1;
      setIsCompactPreview(compact);
      setPreviewScale(nextScale);
      setPreviewHeight(naturalHeight * nextScale);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    if (previewViewportRef.current) observer.observe(previewViewportRef.current);
    if (previewCanvasRef.current) observer.observe(previewCanvasRef.current);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [selectedRecord]);

  if (loading) {
    return <PortalPageSkeleton variant="table" />;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case 'returned':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Returned</Badge>;
      case 'resubmitted':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Resubmitted</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary mb-2">Record History</h1>
        <p className="text-muted-foreground">Track your submissions across years</p>
      </div>

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
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-outline-variant/25 bg-white p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-start"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold leading-tight">Year {record.year} Medical Record</p>
                      <div className="mt-1.5 flex flex-col gap-0.5">
                        <p className="flex items-center text-xs text-muted-foreground sm:text-sm">
                          <span className="mr-1 font-medium text-foreground">Submitted:</span>
                          {new Date(record.submittedAt).toLocaleDateString()}
                        </p>
                        {record.status === 'approved' && record.updatedAt && (
                          <p className="flex items-center text-xs font-medium text-green-600 sm:text-sm">
                            <span className="mr-1">Approved:</span>
                            {new Date(record.updatedAt).toLocaleDateString()}
                          </p>
                        )}
                        {record.status === 'resubmitted' && record.updatedAt && (
                          <p className="flex items-center text-xs font-medium text-orange-600 sm:text-sm">
                            <span className="mr-1">Resubmitted:</span>
                            {new Date(record.updatedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {record.staffNotes ? (
                        <div className="mt-3 hidden rounded-md border border-red-100 bg-red-50 p-2 text-xs text-red-700 sm:block sm:max-w-[320px]">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p className={`${expandedNotes[record.id] ? '' : 'line-clamp-2'}`}>
                              <strong>Staff Note:</strong> {record.staffNotes}
                            </p>
                          </div>
                          {record.staffNotes.length > 100 ? (
                            <button
                              type="button"
                              className="mt-1 text-[11px] font-semibold underline underline-offset-2"
                              onClick={() =>
                                setExpandedNotes((prev) => ({
                                  ...prev,
                                  [record.id]: !prev[record.id],
                                }))
                              }
                            >
                              {expandedNotes[record.id] ? 'See less' : 'See more'}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    {record.staffNotes ? (
                      <div className="w-full rounded-md border border-red-100 bg-red-50 p-2 text-xs text-red-700 sm:hidden">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <p className={`${expandedNotes[record.id] ? '' : 'line-clamp-2'}`}>
                            <strong>Staff Note:</strong> {record.staffNotes}
                          </p>
                        </div>
                        {record.staffNotes.length > 100 ? (
                          <button
                            type="button"
                            className="mt-1 text-[11px] font-semibold underline underline-offset-2"
                            onClick={() =>
                              setExpandedNotes((prev) => ({
                                ...prev,
                                [record.id]: !prev[record.id],
                              }))
                            }
                          >
                            {expandedNotes[record.id] ? 'See less' : 'See more'}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="self-start sm:self-auto">{getStatusBadge(record.status)}</div>
                    <Button
                      onClick={() => setSelectedRecord(record as MockSubmission)}
                      variant="outline"
                      size="sm"
                      className="mt-1 w-full sm:w-auto"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Detailed Form
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Preview Modal/Overlay */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl max-h-[92vh] h-auto rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 sm:h-[90vh]">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b flex items-center justify-between bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <h2 className="text-base sm:text-xl font-bold">Medical Record - Year {selectedRecord.year}</h2>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedRecord(null)}
                className="text-primary-foreground hover:bg-white/20"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
            
            <div ref={previewViewportRef} className="max-h-[68vh] overflow-auto bg-muted/30 p-2 sm:flex-1 sm:max-h-none sm:p-4 md:p-8">
              <div className="mx-auto max-w-[816px] overflow-hidden rounded-sm bg-white shadow-lg ring-1 ring-black/5">
                <div style={{ height: isCompactPreview ? (previewHeight ?? 'auto') : 'auto' }}>
                  <div
                    ref={previewCanvasRef}
                    style={{
                      width: `${PREVIEW_BASE_WIDTH}px`,
                      margin: isCompactPreview ? '0' : '0 auto',
                      transform: `scale(${previewScale})`,
                      transformOrigin: isCompactPreview ? 'top left' : 'top center',
                    }}
                  >
                    <MedicalRecordPreview record={selectedRecord} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-t bg-white flex justify-end">
              <Button onClick={() => setSelectedRecord(null)} className="w-full sm:w-auto">Close Preview</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
