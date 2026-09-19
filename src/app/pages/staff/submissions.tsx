import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import ListPagination from '../../components/list-pagination';
import PortalPageIntro from '../../components/portal-page-intro';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ChevronDown, ChevronUp, Eye, Search, X, SlidersHorizontal, ArrowRight, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../components/ui/utils';
import type { SubmissionSummaryRecord } from '../../lib/record-types';
import { getSubmissionSlotLabel, MAX_SUBMISSION_CYCLE } from '../../lib/academic-year';
import { useAuth } from '../../lib/auth';
import { getYearLevelLabel } from '../../lib/student-year';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { getRoleLabel } from '../../lib/api';
import { loadStaffWorkspacePreferences } from './staff-workspace-preferences';
import {
  staffSubmissionDetailQueryOptions,
  staffSubmissionSummariesQueryOptions,
  useStaffSubmissionSummariesQuery,
} from './staff-workflow-query';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
const YEAR_LABELS = Object.fromEntries(
  Array.from({ length: MAX_SUBMISSION_CYCLE }, (_, index) => {
    const slot = String(index + 1);
    return [slot, getSubmissionSlotLabel(slot)];
  }),
) as Record<string, string>;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20];
const STATUS_FILTER_VALUES = new Set([
  'action_needed',
  'all',
  'pending',
  'in_review',
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

function formatStudentYearLevel(value?: string) {
  const normalizedValue = String(value || '').trim();
  return normalizedValue ? getYearLevelLabel(normalizedValue) : 'Year Level --';
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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { me } = useAuth();
  const staffRoleLabel = getRoleLabel(me?.profile?.role, me?.staff?.position);
  const staffPreferenceId = String(me?.staff?.id || me?.profile.email || '').trim();
  const workspacePreferences = useMemo(
    () => loadStaffWorkspacePreferences(staffPreferenceId, staffRoleLabel),
    [staffPreferenceId, staffRoleLabel],
  );
  const currentStaffId = String(me?.profile?.id || '').trim();
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

  const summaryFilters = useMemo(() => ({
    searchQuery: deferredSearchQuery,
    statusFilter: queryStatusFilter,
    departmentFilter,
    yearFilter,
    sortOrder,
    page: currentPage,
    pageSize,
  }), [currentPage, deferredSearchQuery, departmentFilter, pageSize, queryStatusFilter, sortOrder, yearFilter]);

  const {
    data,
    isLoading: loading,
    isError,
  } = useStaffSubmissionSummariesQuery(summaryFilters);

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load submissions');
    }
  }, [isError]);

  const counts = useMemo(() => {
    const raw = (data?.counts || {}) as Record<string, unknown>;
    const pending = Number(raw.pending ?? 0) || 0;
    const inReview = Number(raw.inReview ?? raw.in_review ?? 0) || 0;
    const returned = Number(raw.returned ?? 0) || 0;
    const resubmitted = Number(raw.resubmitted ?? 0) || 0;
    const actionNeeded = Number(raw.actionNeeded ?? raw.action_needed ?? 0) || 0;

    return {
      pending,
      inReview,
      returned,
      resubmitted,
      actionNeeded,
    };
  }, [data?.counts]);

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

  useEffect(() => {
    if (loading || totalPages <= 1) return;
    if (currentPage < totalPages) {
      void queryClient.prefetchQuery(staffSubmissionSummariesQueryOptions({
        ...summaryFilters,
        page: currentPage + 1,
      }));
    }
    if (currentPage > 1) {
      void queryClient.prefetchQuery(staffSubmissionSummariesQueryOptions({
        ...summaryFilters,
        page: currentPage - 1,
      }));
    }
  }, [currentPage, loading, queryClient, summaryFilters, totalPages]);

  const prefetchSubmissionDetail = (submissionId: string) => {
    void queryClient.prefetchQuery(staffSubmissionDetailQueryOptions(submissionId));
  };

  const clearFilters = () => {
    setSearchQuery('');
    updateStatusFilter(defaultStatusFilter);
    setDepartmentFilter('all');
    setYearFilter('all');
    setSortOrder(defaultSortOrder);
    setShowAdvancedFilters(false);
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
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">In Review</Badge>;
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
    <div className="w-full min-w-0 space-y-8">
      <PortalPageIntro
        title="Review Queue"
      />

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => updateStatusFilter('pending')}
              className={`rounded-[14px] sm:rounded-[18px] border p-2.5 sm:px-4 sm:py-3.5 text-left transition-all cursor-pointer ${
                statusFilter === 'pending'
                  ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300/40 shadow-sm'
                  : 'border-border bg-card hover:border-amber-300 hover:bg-amber-50/40'
              }`}
            >
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground line-clamp-1">Pending Review</p>
              <p className="mt-1 text-lg sm:text-2xl font-bold text-foreground leading-none">{pendingDisplayCount}</p>
            </button>
            <button
              type="button"
              onClick={() => updateStatusFilter('returned')}
              className={`rounded-[14px] sm:rounded-[18px] border p-2.5 sm:px-4 sm:py-3.5 text-left transition-all cursor-pointer ${
                statusFilter === 'returned'
                  ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-300/40 shadow-sm'
                  : 'border-border bg-card hover:border-rose-300 hover:bg-rose-50/40'
              }`}
            >
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground line-clamp-1">Returned</p>
              <p className="mt-1 text-lg sm:text-2xl font-bold text-foreground leading-none">{counts.returned}</p>
            </button>
            <button
              type="button"
              onClick={() => updateStatusFilter('resubmitted')}
              className={`rounded-[14px] sm:rounded-[18px] border p-2.5 sm:px-4 sm:py-3.5 text-left transition-all cursor-pointer ${
                statusFilter === 'resubmitted'
                  ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-300/40 shadow-sm'
                  : 'border-border bg-card hover:border-orange-300 hover:bg-orange-50/40'
              }`}
            >
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground line-clamp-1">Resubmitted</p>
              <p className="mt-1 text-lg sm:text-2xl font-bold text-foreground leading-none">{counts.resubmitted}</p>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowAdvancedFilters(true)}
                className="h-10 w-full pl-10"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className="h-10 gap-2 px-3"
            >
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">{(showAdvancedFilters || hasActiveFilters) ? 'Hide Filters' : 'Filters'}</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button
              variant={statusFilter === 'action_needed' ? 'default' : 'outline'}
              size="default"
              onClick={() => updateStatusFilter('action_needed')}
              className={`h-9 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                statusFilter === 'action_needed' ? 'shadow-sm' : 'hover:bg-accent'
              }`}
            >
              <ClipboardCheck className="w-4 h-4 mr-1.5" />
              Needs Action ({counts.actionNeeded})
            </Button>
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="default"
              onClick={() => updateStatusFilter('all')}
              className={`h-9 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                statusFilter === 'all' ? 'shadow-sm' : 'hover:bg-accent'
              }`}
            >
              All Records
            </Button>
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 transition-all duration-300",
              (showAdvancedFilters || hasActiveFilters) ? "grid" : "hidden"
            )}
          >
            <div className="space-y-1">
              <p className="px-1 text-xs font-medium text-muted-foreground">Sort Order</p>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Sort Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest First</SelectItem>
                  <SelectItem value="asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="px-1 text-xs font-medium text-muted-foreground">Status</p>
              <Select value={statusFilter} onValueChange={updateStatusFilter}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="action_needed">Needs Action</SelectItem>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="resubmitted">Resubmitted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="px-1 text-xs font-medium text-muted-foreground">Department</p>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="h-10 w-full">
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
            </div>

            <div className="space-y-1">
              <p className="px-1 text-xs font-medium text-muted-foreground">Record Slot</p>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="All Record Slots" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Record Slots</SelectItem>
                  {Object.entries(YEAR_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
        </div>

        <div className="space-y-4">
          <div className="border-b border-border/40 pb-2">
            <h3 className="text-base font-semibold text-foreground">
              Submissions ({total}
              {hasActiveFilters && <span className="text-sm font-normal text-muted-foreground ml-1">matching current filters</span>})
            </h3>
          </div>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No submissions found{hasActiveFilters ? ' matching your filters' : ''}
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => {
                const isNeedsAction = submission.status === 'pending' || submission.status === 'resubmitted' || submission.status === 'in_review';
                const isMyReview = submission.status === 'in_review' && submission.reviewedByStaffId === currentStaffId;
                const isOtherStaffReview = submission.status === 'in_review' && submission.reviewedByStaffId && submission.reviewedByStaffId !== currentStaffId;

                return (
                  <div
                    key={submission.id}
                    onClick={() => navigate(`/staff/review/${submission.id}`)}
                    onFocus={() => prefetchSubmissionDetail(submission.id)}
                    onMouseEnter={() => prefetchSubmissionDetail(submission.id)}
                    className="group flex flex-col justify-between gap-4 rounded-[18px] border border-border/80 bg-card p-4 sm:p-5 transition-all hover:border-primary/50 hover:bg-accent/30 hover:shadow-md sm:flex-row sm:items-center cursor-pointer"
                  >
                    <div className="flex gap-4 items-start w-full sm:w-auto">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base font-bold flex-shrink-0">
                        {submission.firstName?.[0]}{submission.lastName?.[0]}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2.5 mb-2">
                          <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                            {submission.firstName} {submission.lastName}
                          </h4>
                          <Badge variant="outline" className="bg-secondary/60 text-secondary-foreground font-medium">
                            {formatStudentYearLevel(submission.studentYearLevel)}
                          </Badge>
                          {getStatusBadge(submission.status)}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground space-y-0.5">
                          <p><span className="font-medium text-foreground/80">Student ID:</span> {submission.studentId}</p>
                          <p>
                            {submission.department ? (
                              <>
                                <span className="font-medium text-foreground/80">{submission.department}</span>
                                {submission.course && submission.course !== submission.department ? (
                                  <span className="ml-1.5 opacity-75">• {submission.course}</span>
                                ) : null}
                              </>
                            ) : (
                              <span>{submission.course}</span>
                            )}
                          </p>
                          <p><span className="font-medium text-foreground/80">Record Slot:</span> {YEAR_LABELS[String(submission.year || '')] || 'Record Slot --'}</p>
                          <p><span className="font-medium text-foreground/80">Submitted:</span> {formatTimestamp(submission.submittedAt)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 sm:mt-0 flex-shrink-0">
                      {isOtherStaffReview ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full sm:w-auto h-11 px-5 rounded-xl font-medium shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/staff/review/${submission.id}`);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Record
                        </Button>
                      ) : isNeedsAction ? (
                        <Button
                          type="button"
                          className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 flex items-center justify-center gap-2 group-hover:scale-[1.02] transition-transform"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/staff/review/${submission.id}`);
                          }}
                        >
                          <ClipboardCheck className="w-4 h-4" />
                          <span>{isMyReview ? 'Continue Review' : 'Start Review'}</span>
                          <ArrowRight className="w-4 h-4 ml-0.5" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto h-11 px-5 rounded-xl font-medium border-border/80 hover:bg-accent shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/staff/review/${submission.id}`);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
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
        </div>
      </div>
    );
  }
