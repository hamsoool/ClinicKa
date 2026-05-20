import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import PortalPageIntro from '../../components/portal-page-intro';
import { ChevronDown, Search, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import type { ApprovedStudentSummary } from '../../lib/record-types';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { useStaffApprovedStudentsQuery } from './staff-workflow-query';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
const YEAR_LABELS: Record<string, string> = {
  '1': '1st Year',
  '2': '2nd Year',
  '3': '3rd Year',
  '4': '4th Year',
};
const PAGE_SIZE = 20;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery.trim());

  useEffect(() => {
    setCurrentPage(1);
    setExpandedStudentId(null);
  }, [deferredSearchQuery, departmentFilter, yearFilter, courseFilter, fromDate, toDate]);

  const {
    data,
    isLoading: loading,
    isFetching,
    isError,
  } = useStaffApprovedStudentsQuery({
    searchQuery: deferredSearchQuery,
    departmentFilter,
    yearFilter,
    courseFilter,
    fromDate,
    toDate,
    page: currentPage,
    pageSize: PAGE_SIZE,
  });

  const students = useMemo(
    () => ((data?.students || []) as ApprovedStudentSummary[]),
    [data?.students],
  );
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

  return (
    <div className={embedded ? 'min-w-0' : 'mx-auto w-full max-w-[100rem]'}>
      {!embedded ? (
        <PortalPageIntro
          className="mb-8"
          title="Records Archive"
          description="Approved medical clearances and records."
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
              <p className="px-1 text-xs font-medium text-muted-foreground">Year Level</p>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="h-10 w-full">
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
            Approved Medical Records ({total} Students)
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
                              <p className="font-medium">Year {record.year} Medical Record</p>
                              <p className="text-sm text-muted-foreground">
                                Approved on {formatDate(record.updatedAt || record.submittedAt)}
                              </p>
                            </div>
                            <Badge className="bg-green-100 text-green-800">Approved</Badge>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && totalPages > 1 ? (
            <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
