import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, Clock, CheckCircle, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getAnalytics, getSubmissions } from '../../lib/api';

export default function StaffDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getYearData = () => {
    const yearCounts = submissions.reduce((acc, sub) => {
      const year = sub.year || '1';
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: '1st Year', count: yearCounts['1'] || 0 },
      { name: '2nd Year', count: yearCounts['2'] || 0 },
      { name: '3rd Year', count: yearCounts['3'] || 0 },
      { name: '4th Year', count: yearCounts['4'] || 0 },
    ];
  };

  const getStatusData = () => {
    const statusCounts = submissions.reduce((acc, sub) => {
      acc[sub.status] = (acc[sub.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: 'Pending', value: statusCounts['pending'] || 0, color: '#f59e0b' },
      { name: 'Approved', value: statusCounts['approved'] || 0, color: '#10b981' },
      { name: 'Returned', value: statusCounts['returned'] || 0, color: '#ef4444' },
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Students',
      value: analytics?.totalStudents || 0,
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Pending Records',
      value: analytics?.pendingRecords || 0,
      icon: Clock,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      title: 'Approved Clearances',
      value: analytics?.approvedRecords || 0,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Total Submissions',
      value: analytics?.totalSubmissions || 0,
      icon: FileText,
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Staff Dashboard</h1>
        <p className="text-muted-foreground">Overview of medical record submissions and analytics</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
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

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Submissions by Year Level</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getYearData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#16a34a" name="Submissions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submission Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getStatusData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getStatusData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Submissions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No submissions yet
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.slice(0, 5).map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      {submission.firstName} {submission.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {submission.studentId} • Year {submission.year}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      submission.status === 'pending' ? 'text-yellow-600' :
                      submission.status === 'approved' ? 'text-green-600' :
                      'text-red-600'
                    }`}>
                      {submission.status.toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(submission.submittedAt).toLocaleDateString()}
                    </p>
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
