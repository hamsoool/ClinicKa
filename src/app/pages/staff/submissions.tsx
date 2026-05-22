import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import ListPagination from '../../components/list-pagination';
import PortalPageIntro from '../../components/portal-page-intro';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ChevronDown, ChevronUp, Eye, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import type { SubmissionSummaryRecord } from '../../lib/record-types';
import { useAuth } from '../../lib/auth';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { getRoleLabel } from '../../lib/api';
import { loadStaffWorkspacePreferences } from './staff-workspace-preferences';
import { useStaffSubmissionSummariesQuery } from './staff-workflow-query';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
const YEAR_LABELS: Record<string, string> = {
  '1': '1st Year',
  '2': '2nd Year',
  '3': '3rd Year',
  '4': '4th Year',
};
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20];
const STATUS_FILTER_VALUES = new Set([
  'action_needed',
  'all',
  'pending',
  'in_review',
  'physical_exam_done',
  'approved',
  'returned',
  'resubmitted',
]);

function parseStatusFilter(value: string | null) {
  if (!value) return 'action_needed';
  if (value === 'in_review') return 'action_needed';
  return STATUS_FILTER_VALUES.has(value) ? value : 'action_needed';
}

function formatTimestamp(value?: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
}

function getStatusFilterLabel(status: string) {
  switch (status) {
    case 'action_needed':
      return 'Needs Action';
    case 'all':
      return 'All Records';
    case 'pending':
      return 'Pending';
    case 'in_review':
      return 'In Review';
    case 'physical_exam_done':
      return 'Physical Exam Done';
    case 'approved':
      return 'Approved';
    case 'returned':
      return 'Returned';
    case 'resubmitted':
      return 'Resubmitted';
    default:
      return status;
  }
}

export default function StaffSubmissions() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { me } = useAuth();
  const staffRoleLabel = getRoleLabel(me?.profile?.role, me?.staff?.position);
  const staffPreferenceId = String(me?.staff?.id || me?.profile.email || '').trim();
  const workspacePreferences = useMemo(
    () => loadStaffWorkspacePreferences(staffPreferenceId, staffRoleLabel),
    [staffPreferenceId, staffRoleLabel],
  );
  const currentStaffId = String(me?.staff?.id || '').trim();
  const defaultStatusFilter = workspacePreferences.reviewQueueStatus;
  const defaultSortOrder = workspacePreferences.reviewSortOrder;
  const defaultShowAdvancedFilters = workspacePreferences.showAdvancedQueueFilters;
  const statusFilter = parseStatusFilter(searchParams.get('status') ?? defaultStatusFilter);
  const queryStatusFilter = statusFilter === 'pending' ? 'action_needed' : statusFilter;
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>(defaultSortOrder);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(defaultShowAdvancedFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery.trim());

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchQuery, statusFilter, departmentFilter, yearFilter, sortOrder, pageSize]);

  useEffect(() => {
    setSortOrder(defaultSortOrder);
    setShowAdvancedFilters(defaultShowAdvancedFilters);
  }, [defaultShowAdvancedFilters, defaultSortOrder]);

  const updateStatusFilter = (nextStatus: string) => {
    const normalizedStatus = parseStatusFilter(nextStatus);
    const nextParams = new URLSearchParams(searchParams);
    if (normalizedStatus === defaultStatusFilter) {
      nextParams.delete('status');
    } else {
      nextParams.set('status', normalizedStatus);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const {
    data,
    isLoading: loading,
    isFetching,
    isError,
  } = useStaffSubmissionSummariesQuery({
    searchQuery: deferredSearchQuery,
    statusFilter: queryStatusFilter,
    departmentFilter,
    yearFilter,
    sortOrder,
    page: currentPage,
    pageSize,
  });

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load submissions');
    }
  }, [isError]);

  const counts = data?.counts || {
    pending: 0,
    inReview: 0,
    returned: 0,
    resubmitted: 0,
    actionNeeded: 0,
  };
  const pendingDisplayCount =
    counts.actionNeeded === (counts.pending + counts.returned + counts.resubmitted)
      ? counts.pending
      : counts.pending + counts.inReview;
  const submissions = useMemo(() => {
    const items = ((data?.items || []) as SubmissionSummaryRecord[]);
    if (statusFilter !== 'pending') return items;
    return items.filter((submission) => submission.status === 'pending' || submission.status === 'in_review');
  }, [data?.items, statusFilter]);
  const total = statusFilter === 'pending' ? pendingDisplayCount : (data?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const clearFilters = () => {
    setSearchQuery('');
    updateStatusFilter(defaultStatusFilter);
    setDepartmentFilter('all');
    setYearFilter('all');
    setSortOrder(defaultSortOrder);
    setShowAdvancedFilters(defaultShowAdvancedFilters);
  };

  const hasActiveFilters =
    searchQuery ||
    statusFilter !== defaultStatusFilter ||
    departmentFilter !== 'all' ||
    yearFilter !== 'all' ||
    sortOrder !== defaultSortOrder;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'in_review':
        return null;
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

  return (
    <div className="mx-auto w-full max-w-[100rem]">
      <PortalPageIntro
        className="mb-8"
        title="Student Submissions"
        description="Staff queue data is loaded in smaller server-filtered batches so the clinic dashboard stays responsive during heavy submission days."
      />

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3">
            <button
              type="button"
              onClick={() => updateStatusFilter('pending')}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                statusFilter === 'pending' ? 'border-amber-300 bg-amber-50' : 'border-border hover:bg-accent/50'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pending</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{pendingDisplayCount}</p>
            </button>
            <button
              type="button"
              onClick={() => updateStatusFilter('returned')}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                statusFilter === 'returned' ? 'border-red-300 bg-red-50' : 'border-border hover:bg-accent/50'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Returned</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{counts.returned}</p>
            </button>
            <button
              type="button"
              onClick={() => updateStatusFilter('resubmitted')}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                statusFilter === 'resubmitted' ? 'border-orange-300 bg-orange-50' : 'border-border hover:bg-accent/50'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resubmitted</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{counts.resubmitted}</p>
            </button>
          </div>

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
              onClick={() => updateStatusFilter('action_needed')}
            >
              Needs Action
            </Button>
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateStatusFilter('all')}
            >
              All Records
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {!loading && isFetching ? (
                <span className="text-xs text-muted-foreground">Refreshing queue...</span>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
              >
                {showAdvancedFilters ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                {showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
              </Button>
            </div>
          </div>

          {showAdvancedFilters ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest First</SelectItem>
                  <SelectItem value="asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={updateStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="action_needed">Needs Action</SelectItem>
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
                  {DEPARTMENTS.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Year Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Year Levels</SelectItem>
                  {Object.entries(YEAR_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {statusFilter !== defaultStatusFilter && (
                <Badge variant="outline" className="text-xs">{getStatusFilterLabel(statusFilter)}</Badge>
              )}
              {sortOrder !== defaultSortOrder && (
                <Badge variant="outline" className="text-xs">
                  {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                </Badge>
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
            Submissions ({total}
            {hasActiveFilters && <span className="text-sm font-normal text-muted-foreground ml-1">matching current filters</span>})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No submissions found{hasActiveFilters ? ' matching your filters' : ''}
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center"
                >
                  <div className="flex gap-4 items-start w-full sm:w-auto">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-lg font-bold flex-shrink-0">
                      {submission.firstName?.[0]}{submission.lastName?.[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h4 className="font-semibold">
                          {submission.firstName} {submission.lastName}
                        </h4>
                        <Badge variant="outline" className="bg-secondary/50 text-secondary-foreground">
                          Year {submission.year || '--'}
                        </Badge>
                        {getStatusBadge(submission.status)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <p>Student ID: {submission.studentId}</p>
                        <p>{submission.department || submission.course}</p>
                        <p>Submitted: {formatTimestamp(submission.submittedAt)}</p>
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
                      {submission.status === 'in_review' && submission.reviewedByStaffId && submission.reviewedByStaffId !== currentStaffId
                        ? 'View'
                        : 'Review'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading ? (
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              itemLabel="submissions"
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
