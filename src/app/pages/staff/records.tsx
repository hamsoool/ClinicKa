import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import ListPagination from '../../components/list-pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import PortalPageIntro from '../../components/portal-page-intro';
import { ChevronDown, Pencil, Search, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import type { ApprovedStudentSummary } from '../../lib/record-types';
import { getSubmissionSlotLabel, MAX_SUBMISSION_CYCLE } from '../../lib/academic-year';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import {
  staffApprovedStudentsQueryOptions,
  staffSubmissionDetailQueryOptions,
  useStaffApprovedStudentsQuery,
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

type StaffRecordsProps = {
  embedded?: boolean;
};

function formatDate(value?: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString();
}

export default function StaffRecords({ embedded = false }: StaffRecordsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery.trim());

  useEffect(() => {
    setCurrentPage(1);
    setExpandedStudentId(null);
  }, [deferredSearchQuery, departmentFilter, yearFilter, courseFilter, fromDate, toDate, pageSize]);

  const approvedStudentFilters = useMemo(() => ({
    searchQuery: deferredSearchQuery,
    departmentFilter,
    yearFilter,
    courseFilter,
    fromDate,
    toDate,
    page: currentPage,
    pageSize,
  }), [courseFilter, currentPage, deferredSearchQuery, departmentFilter, fromDate, pageSize, toDate, yearFilter]);

  const {
    data,
    isLoading: loading,
    isFetching,
    isError,
  } = useStaffApprovedStudentsQuery(approvedStudentFilters);

  const students = useMemo(
    () => ((data?.students || []) as ApprovedStudentSummary[]),
    [data?.students],
  );
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const availableCourses = useMemo(
    () => (data?.availableCourses || []).slice().sort((a, b) => a.localeCompare(b)),
    [data?.availableCourses],
  );

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load records');
    }
  }, [isError]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (loading || totalPages <= 1) return;
    if (currentPage < totalPages) {
      void queryClient.prefetchQuery(staffApprovedStudentsQueryOptions({
        ...approvedStudentFilters,
        page: currentPage + 1,
      }));
    }
    if (currentPage > 1) {
      void queryClient.prefetchQuery(staffApprovedStudentsQueryOptions({
        ...approvedStudentFilters,
        page: currentPage - 1,
      }));
    }
  }, [approvedStudentFilters, currentPage, loading, queryClient, totalPages]);

  useEffect(() => {
    if (expandedStudentId && !students.some((student) => student.studentId === expandedStudentId)) {
      setExpandedStudentId(null);
    }
  }, [expandedStudentId, students]);

  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('all');
    setYearFilter('all');
    setCourseFilter('all');
    setFromDate('');
    setToDate('');
  };

  const hasActiveFilters =
    searchQuery || departmentFilter !== 'all' || yearFilter !== 'all' || courseFilter !== 'all' || fromDate || toDate;

  const prefetchSubmissionDetail = (submissionId: string) => {
    void queryClient.prefetchQuery(staffSubmissionDetailQueryOptions(submissionId));
  };

  return (
    <div className={embedded ? 'min-w-0' : 'mx-auto w-full max-w-[100rem]'}>
      {!embedded ? (
        <PortalPageIntro
          className="mb-8"
          title="Records Archive"
        />
      ) : null}

      <Card className="mb-6">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1">
              <p className="px-1 text-xs font-medium text-muted-foreground">Search</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Name, student ID, or course"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full pl-10"
                />
              </div>
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

            <div className="space-y-1">
              <p className="px-1 text-xs font-medium text-muted-foreground">Course</p>
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {availableCourses.map((course) => (
                    <SelectItem key={course} value={course}>
                      {course}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="px-1 text-xs font-medium text-muted-foreground">From</p>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-10 w-full"
                aria-label="From date"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-medium text-muted-foreground">To</p>
                {!loading && isFetching ? (
                  <span className="text-[11px] text-muted-foreground">Refreshing...</span>
                ) : null}
              </div>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-10 w-full"
                aria-label="To date"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {departmentFilter !== 'all' && (
                <Badge variant="outline" className="text-xs">{departmentFilter}</Badge>
              )}
              {yearFilter !== 'all' && (
                <Badge variant="outline" className="text-xs">{YEAR_LABELS[yearFilter]}</Badge>
              )}
              {courseFilter !== 'all' && (
                <Badge variant="outline" className="text-xs">{courseFilter}</Badge>
              )}
              {fromDate && (
                <Badge variant="outline" className="text-xs">From: {fromDate}</Badge>
              )}
              {toDate && (
                <Badge variant="outline" className="text-xs">To: {toDate}</Badge>
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
            Approved Medical Records ({total} Records)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading records...</div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No approved records found
            </div>
          ) : (
            <div className="space-y-3">
              {students.map((student) => {
                const isExpanded = expandedStudentId === student.studentId;
                const approvedCount = student.records.length;

                return (
                  <div key={student.studentId} className="overflow-hidden rounded-xl border border-outline-variant/35 bg-white">
                    <button
                      type="button"
                      className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-surface-container-lowest sm:flex-row sm:items-center sm:justify-between"
                      onClick={() => setExpandedStudentId((current) => (current === student.studentId ? null : student.studentId))}
                      aria-expanded={isExpanded}
                    >
                      <div className="min-w-0">
                        <h4 className="text-base font-semibold text-on-surface sm:text-lg">
                          {student.firstName} {student.lastName}
                        </h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {student.studentId} • {student.course}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant="outline" className="bg-green-50 text-green-800">
                          {approvedCount} approved
                        </Badge>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="space-y-2 border-t border-outline-variant/25 bg-surface-container-lowest/60 p-4">
                        {student.records.map((record) => (
                          <div
                            key={record.id}
                            className="flex flex-col gap-3 rounded-md bg-muted p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-medium">{YEAR_LABELS[String(record.year || '')] || 'Record Slot'} Medical Record</p>
                              <p className="text-sm text-muted-foreground">
                                Approved on {formatDate(record.updatedAt || record.submittedAt)}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onFocus={() => prefetchSubmissionDetail(record.id)}
                                onMouseEnter={() => prefetchSubmissionDetail(record.id)}
                                onClick={() => navigate(`/staff/review/${record.id}?archiveEdit=1`)}
                              >
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Badge className="bg-green-100 text-green-800">Approved</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
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
              itemLabel="records"
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
