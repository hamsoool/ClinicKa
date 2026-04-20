import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, UserRoundCog, ShieldCheck, Settings, Activity, Download, Printer } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { getAnalytics, getSubmissions } from '../../lib/api';

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [analyticsData, submissionsData] = await Promise.all([
          getAnalytics(),
          getSubmissions(),
        ]);
        setAnalytics(analyticsData);
        setRecentSubmissions((submissionsData.submissions || []).slice(0, 5));
      } catch (error) {
        console.error('Error loading admin dashboard:', error);
      }
    };

    loadData();
  }, []);

  const exportToPDF = () => {
    window.print();
  };

  const exportToCSV = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Submission ID,Student,Status,Submitted At\n";
      
      recentSubmissions.forEach(item => {
        csvContent += `${item.id},${item.firstName} ${item.lastName},${item.status},${item.submittedAt}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `admin_actions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Admin actions exported successfully");
    } catch (e) {
      toast.error("Failed to export actions");
    }
  };

  const stats = [
    {
      title: 'Active Students',
      value: analytics?.totalStudents || 0,
      icon: Users,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Pending Records',
      value: analytics?.pendingRecords || 0,
      icon: Settings,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Approved Records',
      value: analytics?.approvedRecords || 0,
      icon: ShieldCheck,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Returned Records',
      value: analytics?.returnedRecords || 0,
      icon: UserRoundCog,
      color: 'bg-yellow-100 text-yellow-700',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Administrator Dashboard</h1>
        <p className="text-muted-foreground">System overview and management shortcuts</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-2">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Recent Administrative Actions</CardTitle>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <Printer className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                <TableHead>Action</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSubmissions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.status}</TableCell>
                    <TableCell>{item.firstName} {item.lastName}</TableCell>
                    <TableCell>{new Date(item.submittedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">API Status</p>
                <p className="text-sm text-muted-foreground">Operational</p>
              </div>
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Storage Usage</p>
                <p className="text-sm text-muted-foreground">62% utilized</p>
              </div>
              <span className="text-sm font-semibold text-primary">12.4 GB</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Last Backup</p>
                <p className="text-sm text-muted-foreground">Today, 2:05 AM</p>
              </div>
              <span className="text-sm font-semibold text-green-600">Success</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
