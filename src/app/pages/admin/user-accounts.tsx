import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Filter, Search, UserPlus, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { getUserAccounts } from '../../lib/api';

const roleTone = (role: string) => {
  if (role === 'Administrator') {
    return 'bg-purple-100 text-purple-700';
  }
  if (role === 'Clinic Staff') {
    return 'bg-blue-100 text-blue-700';
  }
  return 'bg-slate-100 text-slate-700';
};

const statusTone = (status: string) => {
  if (status === 'Active') {
    return 'bg-green-100 text-green-700';
  }
  return 'bg-yellow-100 text-yellow-700';
};

export default function AdminUserAccounts() {
  const [userAccounts, setUserAccounts] = useState<any[]>([]);

  useEffect(() => {
    getUserAccounts()
      .then((data) => setUserAccounts(data.users || []))
      .catch((error) => {
        console.error('Error loading user accounts:', error);
        toast.error('Failed to load user accounts');
      });
  }, []);

  const exportToPDF = () => {
    window.print();
  };

  const exportToCSV = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "User ID,Name,Role,Status,Last Active\n";
      
      userAccounts.forEach(user => {
        csvContent += `${user.id},${user.name},${user.role},${user.status},${user.lastActive}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `user_accounts_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("User accounts exported successfully");
    } catch (e) {
      toast.error("Failed to export user accounts");
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">User Accounts</h1>
          <p className="text-muted-foreground">Manage access, roles, and account status</p>
        </div>
        <Button className="self-start md:self-auto">
          <UserPlus className="w-4 h-4 mr-2" />
          Create Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input className="pl-9" placeholder="Search by name, ID, or role" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={exportToPDF}>
                  <Printer className="w-4 h-4 mr-2" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportToCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userAccounts.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.id}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>
                    <Badge className={roleTone(user.role)}>{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusTone(user.status)}>{user.status}</Badge>
                  </TableCell>
                  <TableCell>{user.lastActive ? new Date(user.lastActive).toLocaleString() : '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">Reset</Button>
                      <Button variant="ghost" size="sm">Suspend</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
