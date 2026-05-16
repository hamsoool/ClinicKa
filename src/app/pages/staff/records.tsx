import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, X } from 'lucide-react';
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

function formatDate(value?: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString();
}

export default function StaffRecords() {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery.trim());

  useEffect(() => {
    setCurrentPage(1);
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
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-primary sm:text-3xl">Medical Records</h1>
        <p className="text-muted-foreground">Approved medical clearances and records</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, student ID, or course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 sm:max-w-md"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full">
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
              <SelectTrigger className="w-full">
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

            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-full">
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

            <div className="space-y-1">
              <p className="px-1 text-xs font-medium text-muted-foreground">From</p>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full"
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
                className="w-full"
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
            <div className="space-y-4">
              {students.map((student) => (
                <Card key={student.studentId} className="border">
                  <CardContent className="pt-6">
                    <div className="mb-4">
                      <h4 className="font-semibold text-lg">
                        {student.firstName} {student.lastName}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {student.studentId} • {student.course}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {student.records.map((record) => (
                        <div
                          key={record.id}
                          className="flex flex-col gap-3 rounded bg-muted p-3 sm:flex-row sm:items-center sm:justify-between"
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
                  </CardContent>
                </Card>
              ))}
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
