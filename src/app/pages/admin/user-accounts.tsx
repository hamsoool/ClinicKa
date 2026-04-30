import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
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
import { createAdminAccount, getUserAccounts } from '../../lib/api';

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
  const [openCreate, setOpenCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'student' as 'student' | 'staff' | 'admin',
    firstName: '',
    lastName: '',
    studentId: '',
    department: '',
    course: '',
  });

  const loadUsers = () =>
    getUserAccounts()
      .then((data) => setUserAccounts(data.users || []))
      .catch((error) => {
        console.error('Error loading user accounts:', error);
        toast.error('Failed to load user accounts');
      });

  useEffect(() => {
    loadUsers();
  }, []);

  const submitCreate = async () => {
    if (!form.email || !form.password) {
      toast.error('Email and password are required');
      return;
    }
    if (form.role === 'student' && !form.studentId.trim()) {
      toast.error('Student ID is required for student accounts');
      return;
    }

    try {
      setIsSubmitting(true);
      await createAdminAccount({
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        studentId: form.role === 'student' ? form.studentId.trim() : undefined,
        department: form.department.trim() || undefined,
        course: form.course.trim() || undefined,
      });
      toast.success('Account created without email verification');
      setOpenCreate(false);
      setForm({
        email: '',
        password: '',
        role: 'student',
        firstName: '',
        lastName: '',
        studentId: '',
        department: '',
        course: '',
      });
      await loadUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <Button className="self-start md:self-auto" onClick={() => setOpenCreate(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Create Account
        </Button>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Account</DialogTitle>
            <DialogDescription>Admin-created accounts bypass email verification.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ua-email">Email</Label>
              <Input id="ua-email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ua-password">Password</Label>
              <Input id="ua-password" type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(value: 'student' | 'staff' | 'admin') => setForm((prev) => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ua-first">First Name</Label>
                <Input id="ua-first" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ua-last">Last Name</Label>
                <Input id="ua-last" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} />
              </div>
            </div>
            {form.role === 'student' ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ua-student-id">Student ID</Label>
                  <Input id="ua-student-id" value={form.studentId} onChange={(e) => setForm((prev) => ({ ...prev, studentId: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ua-department">Department</Label>
                  <Input id="ua-department" value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ua-course">Course</Label>
                  <Input id="ua-course" value={form.course} onChange={(e) => setForm((prev) => ({ ...prev, course: e.target.value }))} />
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={submitCreate} disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Account'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
