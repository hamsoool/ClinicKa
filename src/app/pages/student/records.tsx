import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import type { MockSubmission } from '../../lib/mock-data';
import { useEffect, useState } from 'react';
import { FileText, Eye, X, ArrowLeft, AlertCircle } from 'lucide-react';
import MedicalRecordPreview from '../../components/medical-record-preview';
import { getStudentRecords } from '../../lib/api';
import { toast } from 'sonner';

export default function StudentRecords() {
  const [selectedRecord, setSelectedRecord] = useState<MockSubmission | null>(null);
  const [records, setRecords] = useState<MockSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRecords = async () => {
      try {
        const data = await getStudentRecords();
        setRecords(data.records || []);
      } catch (error) {
        console.error('Error loading student records:', error);
        toast.error('Failed to load records');
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case 'returned':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Returned</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Record History</h1>
        <p className="text-muted-foreground">Track your submissions across years</p>
      </div>

      <Card>
        <CardHeader>
        <CardTitle>Medical Record History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading records...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No records found</p>
              <p className="text-sm">Submit your first medical record to see your history here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border rounded-xl hover:shadow-md transition-shadow bg-white gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">Year {record.year} Medical Record</p>
                      <div className="flex flex-col gap-1 mt-1">
                        <p className="text-sm text-muted-foreground flex items-center">
                          <span className="font-medium mr-1 text-foreground">Submitted:</span> 
                          {new Date(record.submittedAt).toLocaleDateString()}
                        </p>
                        {record.status === 'approved' && record.updatedAt && (
                          <p className="text-sm text-green-600 flex items-center font-medium">
                            <span className="mr-1">Approved:</span>
                            {new Date(record.updatedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {record.staffNotes && (
                        <div className="mt-3 p-2 bg-red-50 text-red-700 rounded text-xs border border-red-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span><strong>Staff Note:</strong> {record.staffNotes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 items-end">
                    {getStatusBadge(record.status)}
                    <Button 
                      onClick={() => setSelectedRecord(record as MockSubmission)}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto mt-2"
                    >
                      <Eye className="w-4 h-4 mr-2" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <h2 className="text-xl font-bold">Medical Record - Year {selectedRecord.year}</h2>
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
            
            <div className="flex-1 overflow-auto p-4 md:p-8 bg-muted/30">
              <div className="max-w-[816px] mx-auto shadow-lg ring-1 ring-black/5 bg-white rounded-sm">
                <MedicalRecordPreview record={selectedRecord} />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t bg-white flex justify-end">
              <Button onClick={() => setSelectedRecord(null)}>Close Preview</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
