import { useEffect, useMemo, useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Plus, Search, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { createAdminStaff, getStaffUsers } from '../../lib/api';

const statusTone = (status: string) => {
  if (status === 'Active') {
    return 'bg-green-100 text-green-700';
  }
  return 'bg-yellow-100 text-yellow-700';
};

export default function AdminStaffManagement() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    position: 'Clinic Staff',
    staffCode: '',
  });

  const loadStaff = () =>
    getStaffUsers()
      .then((data) => setStaffList(data.staff || []))
      .catch((error) => {
        console.error('Error loading staff:', error);
        toast.error('Failed to load staff directory');
      });

  useEffect(() => {
    loadStaff();
  }, []);

  const submitCreate = async () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      toast.error('Email, password, first name, and last name are required');
      return;
    }
    try {
      setIsSubmitting(true);
      await createAdminStaff({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        position: form.position.trim() || 'Clinic Staff',
        staffCode: form.staffCode.trim() || undefined,
      });
      toast.success('Staff account created without email verification');
      setOpenCreate(false);
      setForm({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        position: 'Clinic Staff',
        staffCode: '',
      });
      await loadStaff();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  const exportToCSV = () => {
    try {
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += 'Staff ID,Name,Role,Status,Email\n';

      filteredStaffList.forEach((staff) => {
        csvContent += `${staff.id},${staff.name},${staff.role},${staff.status},${staff.email}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `staff_directory_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Staff directory exported successfully');
    } catch {
      toast.error('Failed to export staff list');
    }
  };

  const filteredStaffList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return staffList;
    return staffList.filter((staff) =>
      [staff.id, staff.name, staff.role, staff.status, staff.email]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')
        .includes(query),
    );
  }, [searchQuery, staffList]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">Clinic Staff Management</h1>
          <p className="text-muted-foreground">Manage staff roles, access, and availability</p>
        </div>
        <Button className="w-full md:w-auto md:self-auto" onClick={() => setOpenCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Staff
        </Button>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="w-[calc(100%-1.5rem)] rounded-xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Staff</DialogTitle>
            <DialogDescription>Admin-created staff bypasses email verification.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sm-email">Email</Label>
              <Input id="sm-email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sm-password">Password</Label>
              <Input id="sm-password" type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="sm-first">First Name</Label>
                <Input id="sm-first" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sm-last">Last Name</Label>
                <Input id="sm-last" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="sm-position">Position</Label>
                <Input id="sm-position" value={form.position} onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sm-code">Staff Code (optional)</Label>
                <Input id="sm-code" value={form.staffCode} onChange={(e) => setForm((prev) => ({ ...prev, staffCode: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setOpenCreate(false)} disabled={isSubmitting} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={submitCreate} disabled={isSubmitting} className="w-full sm:w-auto">{isSubmitting ? 'Adding...' : 'Add Staff'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Staff Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Search by name, role, status, or ID"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row print:hidden text-muted-foreground">
              <Button variant="outline" size="sm" onClick={exportToPDF} className="w-full sm:w-auto">
                <Printer className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV} className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>

          {filteredStaffList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-muted-foreground">
              No staff accounts matched your search.
            </div>
          ) : null}

          <div className="space-y-3 md:hidden">
            {filteredStaffList.map((staff) => (
              <Card key={staff.id} className="border-outline-variant/40">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{staff.name}</p>
                      <p className="text-xs text-muted-foreground">{staff.id}</p>
                    </div>
                    <Badge className={statusTone(staff.status)}>{staff.status}</Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium text-on-surface">Role:</span> {staff.role}</p>
                    <p className="break-all"><span className="font-medium text-on-surface">Email:</span> {staff.email || '-'}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="w-full">Edit</Button>
                    <Button variant="ghost" size="sm" className="w-full">Deactivate</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaffList.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.id}</TableCell>
                    <TableCell>{staff.name}</TableCell>
                    <TableCell>{staff.role}</TableCell>
                    <TableCell>
                      <Badge className={statusTone(staff.status)}>{staff.status}</Badge>
                    </TableCell>
                    <TableCell>{staff.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="ghost" size="sm">Deactivate</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
