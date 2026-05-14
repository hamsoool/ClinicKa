import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
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
import { Plus, Search, Download, Printer, Archive } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { archiveUserAccount, createAdminStaff, getStaffUsers } from '../../lib/api';

const statusTone = (status: string) => {
  if (status === 'Active') {
    return 'bg-green-100 text-green-700';
  }
  return 'bg-yellow-100 text-yellow-700';
};

const roleTone = (role: string) => {
  if (role === 'Clinic Doctor') {
    return 'bg-indigo-100 text-indigo-700';
  }
  return 'bg-blue-100 text-blue-700';
};

export default function AdminStaffManagement() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<any | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    position: 'Clinic Staff',
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
      });
      toast.success('Staff account created without email verification');
      setOpenCreate(false);
      setForm({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        position: 'Clinic Staff',
      });
      await loadStaff();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      setIsArchiving(true);
      await archiveUserAccount({
        userId: archiveTarget.userId,
        reason: archiveReason.trim() || undefined,
      });
      toast.success(`${archiveTarget.name} has been archived`);
      setArchiveTarget(null);
      setArchiveReason('');
      await loadStaff();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to archive staff');
    } finally {
      setIsArchiving(false);
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
            <div className="grid gap-1.5">
              <Label htmlFor="sm-position">Position</Label>
              <Select value={form.position} onValueChange={(value) => setForm((prev) => ({ ...prev, position: value }))}>
                <SelectTrigger id="sm-position">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Clinic Staff">Clinic Staff</SelectItem>
                  <SelectItem value="Clinic Doctor">Clinic Doctor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setOpenCreate(false)} disabled={isSubmitting} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={submitCreate} disabled={isSubmitting} className="w-full sm:w-auto">{isSubmitting ? 'Adding...' : 'Add Staff'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(archiveTarget)} onOpenChange={(open) => {
        if (!open) {
          setArchiveTarget(null);
          setArchiveReason('');
        }
      }}>
        <DialogContent className="w-[calc(100%-1.5rem)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive Staff Account</DialogTitle>
            <DialogDescription>
              {archiveTarget
                ? `Archive ${archiveTarget.name}? They will be removed from the active staff directory and blocked from accessing the system.`
                : 'Archive this staff account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This keeps the account data in the database for review. The account can be restored later from the User Accounts archive tab.
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="staff-archive-reason">Archive note (optional)</Label>
              <Textarea
                id="staff-archive-reason"
                placeholder="Add context for why this staff member is being archived"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => { setArchiveTarget(null); setArchiveReason(''); }} disabled={isArchiving} className="w-full sm:w-auto">Cancel</Button>
            <Button variant="destructive" onClick={confirmArchive} disabled={isArchiving} className="w-full sm:w-auto">
              {isArchiving ? 'Archiving...' : 'Archive Staff'}
            </Button>
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
                    <p><span className="font-medium text-on-surface">Role:</span> <Badge className={roleTone(staff.role)}>{staff.role}</Badge></p>
                    <p className="break-all"><span className="font-medium text-on-surface">Email:</span> {staff.email || '-'}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="ghost" size="sm" className="w-full text-amber-700 hover:text-amber-800 hover:bg-amber-50" onClick={() => setArchiveTarget(staff)}>
                      <Archive className="w-4 h-4 mr-2" />
                      Archive
                    </Button>
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
                    <TableCell><Badge className={roleTone(staff.role)}>{staff.role}</Badge></TableCell>
                    <TableCell>
                      <Badge className={statusTone(staff.status)}>{staff.status}</Badge>
                    </TableCell>
                    <TableCell>{staff.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-800 hover:bg-amber-50" onClick={() => setArchiveTarget(staff)}>
                          <Archive className="w-4 h-4 mr-1.5" />
                          Archive
                        </Button>
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
