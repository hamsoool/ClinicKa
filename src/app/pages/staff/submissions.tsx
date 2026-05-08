import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import { getSubmissions } from '../../lib/api';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
const YEAR_LABELS: Record<string, string> = {
  '1': '1st Year',
  '2': '2nd Year',
  '3': '3rd Year',
  '4': '4th Year',
};

export default function StaffSubmissions() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');

  const { data: queryData, isLoading: loading, isError } = useQuery({
    queryKey: ['staffSubmissions'],
    queryFn: async () => {
      const data = await getSubmissions();
      return data.submissions || [];
    }
  });

  const submissions = queryData || [];

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load submissions');
    }
  }, [isError]);

  const filteredSubmissions = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    const filtered = submissions.filter((sub) => {
      if (needle) {
        const matchesSearch =
          sub.firstName?.toLowerCase().includes(needle) ||
          sub.lastName?.toLowerCase().includes(needle) ||
          sub.studentId?.toLowerCase().includes(needle);
        if (!matchesSearch) return false;
      }
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
      if (
        departmentFilter !== 'all' &&
        !(sub.department === departmentFilter || sub.course?.includes(departmentFilter))
      ) {
        return false;
      }
      if (yearFilter !== 'all' && String(sub.year) !== yearFilter) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const timeA = new Date(a.submittedAt).getTime();
      const timeB = new Date(b.submittedAt).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return filtered;
  }, [departmentFilter, searchQuery, sortOrder, statusFilter, submissions, yearFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setYearFilter('all');
    setSortOrder('desc');
  };

  const hasActiveFilters =
    searchQuery || statusFilter !== 'all' || 
    departmentFilter !== 'all' || yearFilter !== 'all' || sortOrder !== 'desc';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'physical_exam_done':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Physical Exam Done</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case 'returned':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Returned</Badge>;
      case 'resubmitted':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Resubmitted</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const queueNumbersBySubmissionId = useMemo(() => {
    const groups = new Map<string, Array<{ id: string; submittedAt: string }>>();
    for (const submission of submissions) {
      if (!submission?.id || !submission?.submittedAt) continue;
      const submitDate = new Date(submission.submittedAt).toDateString();
      if (!groups.has(submitDate)) groups.set(submitDate, []);
      groups.get(submitDate)!.push({ id: submission.id, submittedAt: submission.submittedAt });
    }

    const queueMap = new Map<string, number>();
    for (const entries of groups.values()) {
      entries.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
      entries.forEach((entry, index) => {
        queueMap.set(entry.id, index + 1);
      });
    }
    return queueMap;
  }, [submissions]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Student Submissions</h1>
        <p className="text-muted-foreground">Review and process medical record submissions</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name or student ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger>
                <SelectValue placeholder="Sort Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="physical_exam_done">Physical Exam Done</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="resubmitted">Resubmitted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Year Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Year Levels</SelectItem>
                {Object.entries(YEAR_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {sortOrder !== 'desc' && (
                <Badge variant="outline" className="text-xs">Oldest First</Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant="outline" className="text-xs">{statusFilter}</Badge>
              )}
              {departmentFilter !== 'all' && (
                <Badge variant="outline" className="text-xs">{departmentFilter}</Badge>
              )}
              {yearFilter !== 'all' && (
                <Badge variant="outline" className="text-xs">{YEAR_LABELS[yearFilter]}</Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
                <X className="w-3 h-3 mr-1" /> Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Submissions ({filteredSubmissions.length}
            {hasActiveFilters && <span className="text-sm font-normal text-muted-foreground ml-1">filtered</span>})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading submissions...</div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No submissions found{hasActiveFilters ? ' matching your filters' : ''}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-4"
                >
                  <div className="flex gap-4 items-start w-full sm:w-auto">
                    {/* Student photo thumbnail */}
                    {submission.photoUrl ? (
                      <img
                        src={submission.photoUrl}
                        alt="Student"
                        className="w-12 h-12 rounded-full object-cover border flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-lg font-bold flex-shrink-0">
                        {submission.firstName?.[0]}{submission.lastName?.[0]}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h4 className="font-semibold">
                          {submission.firstName} {submission.lastName}
                        </h4>
                        <Badge variant="outline" className="bg-secondary/50 text-secondary-foreground">
                          Queue #{queueNumbersBySubmissionId.get(submission.id) || 0}
                        </Badge>
                        {getStatusBadge(submission.status)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <p>Student ID: {submission.studentId}</p>
                        <p>
                          {submission.department || submission.course}
                        </p>
                        <p>Submitted: {new Date(submission.submittedAt).toLocaleDateString()} at {new Date(submission.submittedAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 sm:mt-0">
                    <Button
                      onClick={() => navigate(`/staff/review/${submission.id}`)}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
