import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { getSubmissions } from '../../lib/api';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAS', 'CED'];
const YEAR_LABELS: Record<string, string> = {
  '1': '1st Year',
  '2': '2nd Year',
  '3': '3rd Year',
  '4': '4th Year',
};

export default function StaffRecords() {
  const [records, setRecords] = useState<any[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    filterRecords();
  }, [searchQuery, departmentFilter, yearFilter, records]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await getSubmissions();
      // Only show approved records
      const approvedRecords = (data.submissions || []).filter((r: any) => r.status === 'approved');
      setRecords(approvedRecords);
    } catch (error) {
      console.error('Error loading records:', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const filterRecords = () => {
    let filtered = records;

    if (searchQuery) {
      filtered = filtered.filter(record =>
        record.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.studentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.course?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(record =>
        record.department === departmentFilter || record.course?.includes(departmentFilter)
      );
    }
    
    if (yearFilter !== 'all') {
      filtered = filtered.filter(record => String(record.year) === yearFilter);
    }

    setFilteredRecords(filtered);
  };
  
  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('all');
    setYearFilter('all');
  };

  const hasActiveFilters = searchQuery || departmentFilter !== 'all' || yearFilter !== 'all';

  // Group records by student
  const groupedRecords = filteredRecords.reduce((acc, record) => {
    const studentId = record.studentId;
    if (!acc[studentId]) {
      acc[studentId] = {
        student: record,
        records: [],
      };
    }
    acc[studentId].records.push(record);
    return acc;
  }, {} as Record<string, any>);

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
          
          <div className="flex flex-wrap gap-3">
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
