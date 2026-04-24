import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getStudentRecords } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const displayName = [
    me?.student?.first_name || me?.profile.first_name || '',
    me?.student?.last_name || me?.profile.last_name || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Student';
  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
    }
    if (studentId) {
      loadRecords();
    }
  }, [studentId]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await getStudentRecords();
      setRecords(data.records || []);
    } catch (error) {
      console.error('Error loading records:', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pending Review</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'returned':
        return <Badge variant="secondary" className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" /> Returned</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Welcome</p>
          <h2 className="text-2xl font-semibold">Welcome, {displayName}</h2>
        </div>

        {studentId && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Student ID:</span>
                  <span className="font-semibold text-base">{studentId}</span>
                </div>
                <span className="text-sm text-muted-foreground">{me?.student?.course || me?.profile.course}</span>
              </div>
              <Button
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => navigate('/student/year-selection')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Submit New Medical Record
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Yearly Status Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Yearly Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Year Level</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Last Action Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[1, 2, 3, 4].map((year) => {
                    const record = records.find(r => parseInt(r.year) === year);
                    return (
                      <tr key={year} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{year}{year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th'} Year</td>
                        <td className="px-4 py-3">
                          {record ? getStatusBadge(record.status) : <Badge variant="outline" className="text-muted-foreground">Not Submitted</Badge>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground italic">
                          {record ? new Date(record.updatedAt || record.submittedAt).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Submission Status</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading status...</div>
              ) : records.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No submissions yet.
                </div>
              ) : (
                <div className="rounded-lg border bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Latest submission</p>
                      <p className="font-semibold">Year {records[0]?.year} Medical Record</p>
                    </div>
                    {getStatusBadge(records[0]?.status)}
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-muted-foreground">
                      Submitted on {new Date(records[0]?.submittedAt).toLocaleDateString()}
                    </p>
                    {records[0]?.status === 'approved' && records[0]?.updatedAt && (
                      <p className="text-sm text-green-600 font-medium">
                        Approved on {new Date(records[0]?.updatedAt).toLocaleDateString()}
                      </p>
                    )}
                    {records[0]?.status === 'returned' && records[0]?.updatedAt && (
                      <p className="text-sm text-red-600 font-medium">
                        Returned on {new Date(records[0]?.updatedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Medical Record History</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/student/records')}>
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading records...</div>
              ) : records.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No medical records found.
                </div>
              ) : (
                <div className="space-y-3">
                  {records.slice(0, 2).map((record) => (
                    <div key={record.id} className="rounded-lg border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">Year {record.year} Medical Record</p>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-xs text-muted-foreground">
                              Submitted on {new Date(record.submittedAt).toLocaleDateString()}
                            </p>
                            {record.status === 'approved' && record.updatedAt && (
                              <p className="text-xs text-green-600 font-medium">
                                Approved on {new Date(record.updatedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(record.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
