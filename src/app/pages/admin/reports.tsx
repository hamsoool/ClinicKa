import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { getAnalytics, getSubmissions } from '../../lib/api';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAS', 'CED'];
const YEAR_LABELS: Record<string, string> = {
  '1': '1st Year',
  '2': '2nd Year',
  '3': '3rd Year',
  '4': '4th Year',
};

export default function AdminReports() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsData, submissionsData] = await Promise.all([
        getAnalytics(),
        getSubmissions(),
      ]);
      setAnalytics(analyticsData);
      setSubmissions(submissionsData.submissions || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredSubmissions = () => {
    let filtered = submissions;
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(sub =>
        sub.department === departmentFilter || sub.course?.includes(departmentFilter)
      );
    }
    if (yearFilter !== 'all') {
      filtered = filtered.filter(sub => String(sub.year) === yearFilter);
    }
    return filtered;
  };

  const getCourseData = () => {
    const courseCounts = getFilteredSubmissions().reduce((acc, sub) => {
      const course = sub.course || 'Unknown';
      acc[course] = (acc[course] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(courseCounts)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  const getMonthlyData = () => {
    const monthlyCounts = getFilteredSubmissions().reduce((acc, sub) => {
      const date = new Date(sub.submittedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      acc[monthKey] = (acc[monthKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(monthlyCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
  };

  const getMedicalConditionsData = () => {
    const conditionCounts: Record<string, number> = {};
    
    getFilteredSubmissions().forEach(sub => {
      if (sub.medicalHistory) {
        Object.entries(sub.medicalHistory).forEach(([condition, hasIt]) => {
          if (hasIt) {
            const readableName = condition.replace(/([A-Z])/g, ' $1').trim();
            conditionCounts[readableName] = (conditionCounts[readableName] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(conditionCounts)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count);
  };

  const exportToPDF = () => {
    window.print();
  };

  const exportToExcel = () => {
    try {
      // 1. Generate Summary Stats String
      const filtered = getFilteredSubmissions();
      const totalFiltered = filtered.length;
      const approved = filtered.filter(s => s.status === 'approved').length;
      const pending = filtered.filter(s => s.status === 'pending').length;
      const approvalRate = totalFiltered > 0 ? Math.round((approved / totalFiltered) * 100) : 0;

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "ADMIN REPORT SUMMARY\n";
      csvContent += `Filters,Department: ${departmentFilter === 'all' ? 'All' : departmentFilter} | Year: ${yearFilter === 'all' ? 'All' : YEAR_LABELS[yearFilter]}\n`;
      csvContent += `Total Submissions,${totalFiltered}\n`;
      csvContent += `Approved,${approved}\n`;
      csvContent += `Pending,${pending}\n`;
      csvContent += `Approval Rate,${approvalRate}%\n\n`;

      // 2. Generate Medical Conditions String
      csvContent += "MEDICAL CONDITIONS REPORTED\nCondition,Count\n";
      getMedicalConditionsData().forEach(c => {
        csvContent += `${c.name},${c.count}\n`;
      });
      csvContent += "\n";

      // 3. Generate Course Breakdown String
      csvContent += "SUBMISSIONS BY COURSE\nCourse,Count\n";
      getCourseData().forEach(c => {
        csvContent += `${c.name},${c.count}\n`;
      });

      // 4. Download file
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `admin_clinic_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Admin report data exported successfully");
    } catch (e) {
      toast.error("Failed to export report");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading reports...</div>
      </div>
    );
  }

  // Calculate dynamic stats based on filters
  const fSubmissions = getFilteredSubmissions();
  const dynamicTotal = fSubmissions.length;
  const dynamicApproved = fSubmissions.filter(s => s.status === 'approved').length;
  const dynamicPending = fSubmissions.filter(s => s.status === 'pending').length;
  const dynamicApprovalRate = dynamicTotal > 0 ? Math.round((dynamicApproved / dynamicTotal) * 100) : 0;

  return (
    <div className="print:m-0 print:p-0">
      <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">Admin: Reports & Analytics</h1>
          <p className="text-muted-foreground">Detailed system-wide insights and statistics</p>
        </div>
        
        {/* Actions & Filters */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Depts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Depts</SelectItem>
                {DEPARTMENTS.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {Object.entries(YEAR_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToPDF} className="bg-white">
              <Printer className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button onClick={exportToExcel}>
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card className="print:shadow-none print:border-gray-200">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Students</p>
            <p className="text-3xl font-bold text-primary">{departmentFilter === 'all' && yearFilter === 'all' ? analytics?.totalStudents || 0 : '?'}</p>
            {(departmentFilter !== 'all' || yearFilter !== 'all') && (
              <p className="text-xs text-muted-foreground mt-1">Filtered by submissions</p>
            )}
          </CardContent>
        </Card>
        <Card className="print:shadow-none print:border-gray-200">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Submissions (Filtered)</p>
            <p className="text-3xl font-bold">{dynamicTotal}</p>
          </CardContent>
        </Card>
        <Card className="print:shadow-none print:border-gray-200">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Approval Rate</p>
            <p className="text-3xl font-bold text-green-600">{dynamicApprovalRate}%</p>
          </CardContent>
        </Card>
        <Card className="print:shadow-none print:border-gray-200">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending Review</p>
            <p className="text-3xl font-bold text-yellow-600">{dynamicPending}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        <Card className="print:break-inside-avoid print:shadow-none print:border-gray-200">
          <CardHeader>
            <CardTitle>Submissions by Course</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={getCourseData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#16a34a" name="Submissions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="print:break-inside-avoid print:shadow-none print:border-gray-200">
          <CardHeader>
            <CardTitle>Submissions Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getMonthlyData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#16a34a" name="Submissions" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="print:break-inside-avoid print:shadow-none print:border-gray-200">
          <CardHeader>
            <CardTitle>Medical Conditions Reported</CardTitle>
          </CardHeader>
          <CardContent>
            {getMedicalConditionsData().length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={getMedicalConditionsData()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#16a34a" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No medical conditions reported yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

