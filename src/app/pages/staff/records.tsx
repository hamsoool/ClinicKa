import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { useStaffSubmissionsQuery } from './staff-workflow-query';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
const YEAR_LABELS: Record<string, string> = {
  '1': '1st Year',
  '2': '2nd Year',
  '3': '3rd Year',
  '4': '4th Year',
};

export default function StaffRecords() {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data: submissions = [], isLoading: loading, isError } = useStaffSubmissionsQuery();
  const records = submissions.filter((r: any) => r.status === 'approved');
  const availableCourses = useMemo(
    () =>
      Array.from(new Set(records.map((record: any) => String(record.course || '').trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [records],
  );

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load records');
    }
  }, [isError]);

  const filteredRecords = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

    return records.filter((record) => {
      if (needle) {
        const matchesSearch =
          record.firstName?.toLowerCase().includes(needle) ||
          record.lastName?.toLowerCase().includes(needle) ||
          record.studentId?.toLowerCase().includes(needle) ||
          record.course?.toLowerCase().includes(needle);
        if (!matchesSearch) return false;
      }
      if (
        departmentFilter !== 'all' &&
        !(record.department === departmentFilter || record.course?.includes(departmentFilter))
      ) {
        return false;
      }
      if (yearFilter !== 'all' && String(record.year) !== yearFilter) return false;
      if (courseFilter !== 'all' && String(record.course || '') !== courseFilter) return false;
      if (fromTs !== null || toTs !== null) {
        const dateValue = new Date(record.updatedAt || record.submittedAt || 0).getTime();
        if (!Number.isFinite(dateValue)) return false;
        if (fromTs !== null && dateValue < fromTs) return false;
        if (toTs !== null && dateValue > toTs) return false;
      }
      return true;
    });
  }, [courseFilter, departmentFilter, fromDate, records, searchQuery, toDate, yearFilter]);
  
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

  // Group records by student
  const groupedRecords = useMemo(
    () =>
      filteredRecords.reduce((acc, record) => {
        const studentId = record.studentId;
        if (!acc[studentId]) {
          acc[studentId] = {
            student: record,
            records: [],
          };
        }
        acc[studentId].records.push(record);
        return acc;
      }, {} as Record<string, any>),
    [filteredRecords],
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Medical Records</h1>
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
              className="pl-10 max-w-md"
            />
          </div>
          
          <div className="flex flex-wrap items-end gap-3">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Year Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Year Levels</SelectItem>
                {Object.entries(YEAR_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-[260px]">
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
                className="w-[180px]"
                aria-label="From date"
              />
            </div>

            <div className="space-y-1">
              <p className="px-1 text-xs font-medium text-muted-foreground">To</p>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-[180px]"
                aria-label="To date"
              />
            </div>
          </div>

          {/* Active filter chips */}
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
            Approved Medical Records ({Object.keys(groupedRecords).length} Students)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading records...</div>
          ) : Object.keys(groupedRecords).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No approved records found
            </div>
          ) : (
            <div className="space-y-4">
              {Object.values(groupedRecords).map((group: any) => (
                <Card key={group.student.studentId} className="border">
                  <CardContent className="pt-6">
                    <div className="mb-4">
                      <h4 className="font-semibold text-lg">
                        {group.student.firstName} {group.student.lastName}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {group.student.studentId} • {group.student.course}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      {group.records.map((record: any) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between p-3 bg-muted rounded"
                        >
                          <div>
                            <p className="font-medium">Year {record.year} Medical Record</p>
                            <p className="text-sm text-muted-foreground">
                              Approved on {new Date(record.updatedAt || record.submittedAt).toLocaleDateString()}
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
        </CardContent>
      </Card>
    </div>
  );
}
