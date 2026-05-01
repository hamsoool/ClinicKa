import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Archive, Download, Printer, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  archiveUserAccount,
  createAdminAccount,
  deleteArchivedUserAccount,
  getArchivedUserAccounts,
  getUserAccounts,
  type AdminUserAccount,
  type ArchivedUserAccount,
} from '../../lib/api';

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
  if (status === 'Archived') {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-yellow-100 text-yellow-700';
};

function formatDateTime(value?: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function matchesSearch(
  account: Pick<AdminUserAccount, 'id' | 'name' | 'role' | 'email'> | Pick<ArchivedUserAccount, 'id' | 'name' | 'role' | 'email'>,
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [account.id, account.name, account.role, account.email || '']
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export default function AdminUserAccounts() {
  const [tab, setTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AdminUserAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchivedUserAccount | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
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

  const { data: activeData, refetch: refetchActive, isError: isErrorActive } = useQuery({
    queryKey: ['adminUserAccounts'],
    queryFn: getUserAccounts
  });

  const { data: archivedData, refetch: refetchArchived, isError: isErrorArchived } = useQuery({
    queryKey: ['adminArchivedAccounts'],
    queryFn: getArchivedUserAccounts
  });

  const userAccounts = activeData?.users || [];
  const archivedAccounts = archivedData?.users || [];

  const loadUsers = async () => {
    await Promise.all([refetchActive(), refetchArchived()]);
  };

  useEffect(() => {
    if (isErrorActive || isErrorArchived) {
      toast.error('Failed to load user accounts');
    }
  }, [isErrorActive, isErrorArchived]);
  

  const filteredActiveUsers = useMemo(
    () => userAccounts.filter((user) => matchesSearch(user, searchQuery)),
    [searchQuery, userAccounts],
  );

  const filteredArchivedUsers = useMemo(
    () => archivedAccounts.filter((user) => matchesSearch(user, searchQuery)),
    [archivedAccounts, searchQuery],
  );

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

  const confirmArchive = async () => {
    if (!archiveTarget) return;

    try {
      setIsActionPending(true);
      await archiveUserAccount({
        userId: archiveTarget.userId,
        reason: archiveReason.trim() || undefined,
      });
      toast.success(`${archiveTarget.name} was moved to archive`);
      setArchiveTarget(null);
      setArchiveReason('');
      setTab('archive');
      await loadUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to archive account');
    } finally {
      setIsActionPending(false);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsActionPending(true);
      await deleteArchivedUserAccount(deleteTarget.archiveId);
      toast.success(`${deleteTarget.name} was permanently deleted`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to permanently delete account');
    } finally {
      setIsActionPending(false);
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  const exportToCSV = () => {
    try {
      const rows =
        tab === 'archive'
          ? filteredArchivedUsers.map((user) => ({
              id: user.id,
              name: user.name,
              role: user.role,
              status: user.status,
              date: user.archivedAt,
              email: user.email || '',
            }))
          : filteredActiveUsers.map((user) => ({
              id: user.id,
              name: user.name,
              role: user.role,
              status: user.status,
              date: user.lastActive || '',
              email: user.email || '',
            }));

      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += tab === 'archive'
        ? 'User ID,Name,Role,Status,Archived At,Email\n'
        : 'User ID,Name,Role,Status,Last Active,Email\n';

      rows.forEach((row) => {
        csvContent += `${row.id},${row.name},${row.role},${row.status},${row.date},${row.email}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${tab}_accounts_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Account list exported successfully');
    } catch {
      toast.error('Failed to export account list');
    }
  };

  const protectedCount = userAccounts.filter((user) => !user.canArchive).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-primary">User Accounts</h1>
          <p className="text-muted-foreground">
            Archive student and clinic staff accounts first, then permanently delete them from the archive when they should be removed from the system.
          </p>
        </div>
        <Button className="self-start md:self-auto" onClick={() => setOpenCreate(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Create Account
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Active Accounts</p>
              <p className="mt-2 text-3xl font-bold text-on-surface">{userAccounts.length}</p>
            </div>
            <Users className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Archived Accounts</p>
              <p className="mt-2 text-3xl font-bold text-on-surface">{archivedAccounts.length}</p>
            </div>
            <Archive className="h-8 w-8 text-amber-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Protected Admins</p>
              <p className="mt-2 text-3xl font-bold text-on-surface">{protectedCount}</p>
            </div>
            <Badge className="bg-purple-100 px-3 py-1 text-purple-700">Protected</Badge>
          </CardContent>
        </Card>
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
              <Tabs value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as 'student' | 'staff' | 'admin' }))}>
                <TabsList className="w-full">
                  <TabsTrigger value="student">Student</TabsTrigger>
                  <TabsTrigger value="staff">Staff</TabsTrigger>
                  <TabsTrigger value="admin">Admin</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
              <div className="grid gap-3 sm:grid-cols-3">
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

      <Dialog open={Boolean(archiveTarget)} onOpenChange={(open) => {
        if (!open) {
          setArchiveTarget(null);
          setArchiveReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Account</DialogTitle>
            <DialogDescription>
              {archiveTarget
                ? `Archive ${archiveTarget.name}? The user will be removed from active lists and blocked from accessing the system until an admin permanently deletes the archived record.`
                : 'Archive this account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This keeps the account data in the database for review, but the account is treated as inactive and moves to the archive tab.
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="archive-reason">Archive note (optional)</Label>
              <Textarea
                id="archive-reason"
                placeholder="Add context for why this account is being archived"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setArchiveTarget(null);
              setArchiveReason('');
            }} disabled={isActionPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirmArchive} disabled={isActionPending}>
              {isActionPending ? 'Archiving...' : 'Archive Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!open) {
          setDeleteTarget(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete Archived Account</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Permanently delete ${deleteTarget.name}? This removes the archived account from the database, deletes the system account, and frees the user to register again later.`
                : 'Permanently delete this archived account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            This action is irreversible. Student submissions, linked files, staff links, and the sign-in account are deleted from the system.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isActionPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirmPermanentDelete} disabled={isActionPending}>
              {isActionPending ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TabsList className="w-full md:w-fit">
            <TabsTrigger value="active">Active Accounts</TabsTrigger>
            <TabsTrigger value="archive">Archive</TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full min-w-0 sm:min-w-[18rem]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={tab === 'archive' ? 'Search archived accounts' : 'Search active accounts'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <Printer className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>All Active Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                Only student and clinic staff accounts can be archived here. Administrator accounts stay protected.
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActiveUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          No active accounts matched your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredActiveUsers.map((user) => (
                        <TableRow key={user.userId}>
                          <TableCell className="font-medium">{user.id}</TableCell>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>
                            <Badge className={roleTone(user.role)}>{user.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusTone(user.status)}>{user.status}</Badge>
                          </TableCell>
                          <TableCell>{user.email || '-'}</TableCell>
                          <TableCell>{formatDateTime(user.lastActive)}</TableCell>
                          <TableCell>
                            {user.canArchive ? (
                              <Button variant="outline" size="sm" onClick={() => setArchiveTarget(user)}>
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                              </Button>
                            ) : (
                              <Button variant="secondary" size="sm" disabled>
                                Protected
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archive">
          <Card>
            <CardHeader>
              <CardTitle>Archived Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Permanently deleting an archived account removes its system access and linked database data so the same user can register again later.
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Archived On</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredArchivedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          No archived accounts matched your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredArchivedUsers.map((user) => (
                        <TableRow key={user.archiveId}>
                          <TableCell className="font-medium">{user.id}</TableCell>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>
                            <Badge className={roleTone(user.role)}>{user.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusTone(user.status)}>{user.status}</Badge>
                          </TableCell>
                          <TableCell>{formatDateTime(user.archivedAt)}</TableCell>
                          <TableCell className="max-w-60 truncate">{user.archivedReason || '-'}</TableCell>
                          <TableCell>
                            <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(user)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Permanently
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
