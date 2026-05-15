import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ChevronDown, ChevronUp, Eye, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStaffSubmissionsQuery } from './staff-workflow-query';

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
  const [statusFilter, setStatusFilter] = useState('action_needed');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const { data: submissions = [], isLoading: loading, isError } = useStaffSubmissionsQuery();

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load submissions');
    }
  }, [isError]);

  const filteredSubmissions = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    const actionableStatuses = ['pending', 'in_review', 'returned', 'resubmitted'];
    const filtered = submissions.filter((sub) => {
      if (needle) {
        const matchesSearch =
          sub.firstName?.toLowerCase().includes(needle) ||
          sub.lastName?.toLowerCase().includes(needle) ||
          sub.studentId?.toLowerCase().includes(needle);
        if (!matchesSearch) return false;
      }
      if (statusFilter === 'action_needed' && !actionableStatuses.includes(sub.status)) return false;
      if (statusFilter !== 'all' && statusFilter !== 'action_needed' && sub.status !== statusFilter) return false;
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
    setStatusFilter('action_needed');
    setDepartmentFilter('all');
    setYearFilter('all');
    setSortOrder('desc');
    setShowAdvancedFilters(false);
  };

  const hasActiveFilters =
    searchQuery || statusFilter !== 'action_needed' || 
    departmentFilter !== 'all' || yearFilter !== 'all' || sortOrder !== 'desc';

  const pendingCount = submissions.filter((sub) => sub.status === 'pending').length;
  const inReviewCount = submissions.filter((sub) => sub.status === 'in_review').length;
  const returnedCount = submissions.filter((sub) => sub.status === 'returned').length;
  const resubmittedCount = submissions.filter((sub) => sub.status === 'resubmitted').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'in_review':
        return <Badge variant="secondary" className="bg-sky-100 text-sky-800">In Review</Badge>;
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
        <p className="text-muted-foreground">Focus on records that need clinic action first, then open advanced filters only when needed.</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                statusFilter === 'pending' ? 'border-amber-300 bg-amber-50' : 'border-border hover:bg-accent/50'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pending</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{pendingCount}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in_review')}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                statusFilter === 'in_review' ? 'border-sky-300 bg-sky-50' : 'border-border hover:bg-accent/50'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">In Review</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{inReviewCount}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('returned')}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                statusFilter === 'returned' ? 'border-red-300 bg-red-50' : 'border-border hover:bg-accent/50'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Returned</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{returnedCount}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('resubmitted')}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                statusFilter === 'resubmitted' ? 'border-orange-300 bg-orange-50' : 'border-border hover:bg-accent/50'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resubmitted</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{resubmittedCount}</p>
            </button>
          </div>

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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={statusFilter === 'action_needed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('action_needed')}
            >
              Needs Action
            </Button>
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              All Records
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              className="ml-auto"
            >
              {showAdvancedFilters ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              {showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
            </Button>
          </div>

          {showAdvancedFilters ? (
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
                <SelectItem value="action_needed">Needs Action</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
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
          ) : null}

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {statusFilter === 'action_needed' ? (
                <Badge variant="outline" className="text-xs">Needs Action</Badge>
              ) : null}
              {sortOrder !== 'desc' && (
                <Badge variant="outline" className="text-xs">Oldest First</Badge>
              )}
              {statusFilter !== 'all' && statusFilter !== 'action_needed' && (
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
                  className="flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center"
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
