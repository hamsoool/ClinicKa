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
import { Archive, Download, Printer, Search, Trash2, UserPlus, Users, ArrowUpDown, RefreshCcw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import {
  archiveUserAccount,
  createAdminAccount,
  deleteArchivedUserAccount,
  restoreArchivedUserAccount,
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
  const [restoreTarget, setRestoreTarget] = useState<ArchivedUserAccount | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
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

  const sortedActiveUsers = useMemo(() => {
    let sortableItems = [...filteredActiveUsers];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aVal = a[sortConfig.key] || '';
        let bVal = b[sortConfig.key] || '';
        
        if (sortConfig.key === 'lastActive') {
          aVal = aVal ? new Date(aVal as string).getTime() : 0;
          bVal = bVal ? new Date(bVal as string).getTime() : 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredActiveUsers, sortConfig]);

  const sortedArchivedUsers = useMemo(() => {
    let sortableItems = [...filteredArchivedUsers];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aVal = a[sortConfig.key] || '';
        let bVal = b[sortConfig.key] || '';

        if (sortConfig.key === 'archivedAt') {
          aVal = aVal ? new Date(aVal as string).getTime() : 0;
          bVal = bVal ? new Date(bVal as string).getTime() : 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredArchivedUsers, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    setSelectedUserIds(new Set());
  }, [tab]);

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

  const confirmRestore = async () => {
    if (!restoreTarget) return;

    try {
      setIsActionPending(true);
      await restoreArchivedUserAccount(restoreTarget.archiveId);
      toast.success(`${restoreTarget.name} was restored to active accounts`);
      setRestoreTarget(null);
      await loadUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to restore account');
    } finally {
      setIsActionPending(false);
    }
  };

  const confirmBulkArchive = async () => {
    try {
      setIsActionPending(true);
      const promises = Array.from(selectedUserIds).map(userId => 
        archiveUserAccount({ userId, reason: archiveReason.trim() || undefined })
      );
      await Promise.all(promises);
      toast.success(`${selectedUserIds.size} accounts were moved to archive`);
      setBulkArchiveOpen(false);
      setSelectedUserIds(new Set());
      setArchiveReason('');
      setTab('archive');
      await loadUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to archive some accounts');
    } finally {
      setIsActionPending(false);
    }
  };

  const confirmBulkDelete = async () => {
    try {
      setIsActionPending(true);
      const promises = Array.from(selectedUserIds).map(archiveId => 
        deleteArchivedUserAccount(archiveId)
      );
      await Promise.all(promises);
      toast.success(`${selectedUserIds.size} accounts were permanently deleted`);
      setBulkDeleteOpen(false);
      setSelectedUserIds(new Set());
      await loadUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to permanently delete some accounts');
    } finally {
      setIsActionPending(false);
    }
  };

  const confirmBulkRestore = async () => {
    try {
      setIsActionPending(true);
      const promises = Array.from(selectedUserIds).map(archiveId => 
        restoreArchivedUserAccount(archiveId)
      );
      await Promise.all(promises);
      toast.success(`${selectedUserIds.size} accounts were restored to active status`);
      setBulkRestoreOpen(false);
      setSelectedUserIds(new Set());
      await loadUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to restore some accounts');
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

      <Dialog open={bulkArchiveOpen} onOpenChange={(open) => {
        if (!open) {
          setBulkArchiveOpen(false);
          setArchiveReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Archive Accounts</DialogTitle>
            <DialogDescription>
              Archive {selectedUserIds.size} selected account{selectedUserIds.size === 1 ? '' : 's'}? They will be removed from active lists.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              These accounts will be treated as inactive and moved to the archive tab.
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bulk-archive-reason">Archive note (optional)</Label>
              <Textarea
                id="bulk-archive-reason"
                placeholder="Add context for why these accounts are being archived"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setBulkArchiveOpen(false);
              setArchiveReason('');
            }} disabled={isActionPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirmBulkArchive} disabled={isActionPending}>
              {isActionPending ? 'Archiving...' : 'Archive Accounts'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Delete Accounts</DialogTitle>
            <DialogDescription>
              Permanently delete {selectedUserIds.size} selected account{selectedUserIds.size === 1 ? '' : 's'}?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            This action is irreversible. All linked data will be deleted from the system.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={isActionPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={isActionPending}>
              {isActionPending ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Archived Account</DialogTitle>
            <DialogDescription>
              {restoreTarget
                ? `Restore ${restoreTarget.name} to active accounts?`
                : 'Restore this archived account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            This will allow the user to log in again and their profile will appear in the active accounts list.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreTarget(null)} disabled={isActionPending}>Cancel</Button>
            <Button variant="default" onClick={confirmRestore} disabled={isActionPending}>
              {isActionPending ? 'Restoring...' : 'Restore Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRestoreOpen} onOpenChange={setBulkRestoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Restore Accounts</DialogTitle>
            <DialogDescription>
              Restore {selectedUserIds.size} selected account{selectedUserIds.size === 1 ? '' : 's'} to active status?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            These accounts will be reactivated and moved back to the active accounts list.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRestoreOpen(false)} disabled={isActionPending}>Cancel</Button>
            <Button variant="default" onClick={confirmBulkRestore} disabled={isActionPending}>
              {isActionPending ? 'Restoring...' : 'Restore Accounts'}
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {selectedUserIds.size > 0 && (
              <div className="flex shrink-0 items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 print:hidden">
                <span className="text-sm font-medium text-primary">{selectedUserIds.size} selected</span>
                {tab === 'active' ? (
                  <Button variant="default" size="sm" onClick={() => setBulkArchiveOpen(true)} className="h-8">
                    <Archive className="mr-2 h-4 w-4" /> Bulk Archive
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setBulkRestoreOpen(true)} className="h-8">
                      <RefreshCcw className="mr-2 h-4 w-4" /> Bulk Restore
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="h-8">
                      <Trash2 className="mr-2 h-4 w-4" /> Bulk Delete
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 md:hidden">
              <Select value={sortConfig?.key || ''} onValueChange={(val) => setSortConfig({ key: val, direction: sortConfig?.direction || 'asc' })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">User ID</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="role">Role</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  {tab === 'archive' ? (
                    <SelectItem value="archivedAt">Archived On</SelectItem>
                  ) : (
                    <SelectItem value="lastActive">Last Active</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="shrink-0 px-2.5"
                disabled={!sortConfig}
                onClick={() => setSortConfig(prev => prev ? { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : null)}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>

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
                  <TableHeader className="hidden md:table-header-group">
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.size > 0 && selectedUserIds.size === sortedActiveUsers.filter(u => u.canArchive).length && sortedActiveUsers.filter(u => u.canArchive).length > 0}
                          ref={input => {
                            if (input) {
                              const archiveable = sortedActiveUsers.filter(u => u.canArchive);
                              input.indeterminate = selectedUserIds.size > 0 && selectedUserIds.size < archiveable.length;
                            }
                          }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds(new Set(sortedActiveUsers.filter(u => u.canArchive).map(u => u.userId)));
                            } else {
                              setSelectedUserIds(new Set());
                            }
                          }}
                          className="translate-y-[2px] rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('id')}>
                        <div className="flex items-center gap-1">User ID <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('name')}>
                        <div className="flex items-center gap-1">Name <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('role')}>
                        <div className="flex items-center gap-1">Role <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('status')}>
                        <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('email')}>
                        <div className="flex items-center gap-1">Email <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('lastActive')}>
                        <div className="flex items-center gap-1">Last Active <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedActiveUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                          No active accounts matched your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedActiveUsers.map((user) => (
                        <TableRow key={user.userId} className="flex flex-col md:table-row border-b md:border-b-0 pb-4 md:pb-0 mb-4 md:mb-0 relative">
                          <TableCell className="absolute right-0 top-0 md:relative md:block md:table-cell">
                            {user.canArchive && (
                              <input
                                type="checkbox"
                                checked={selectedUserIds.has(user.userId)}
                                onChange={(e) => {
                                  const next = new Set(selectedUserIds);
                                  if (e.target.checked) next.add(user.userId);
                                  else next.delete(user.userId);
                                  setSelectedUserIds(next);
                                }}
                                className="rounded border-gray-300"
                              />
                            )}
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">User ID:</span>
                            <span className="font-medium">{user.id}</span>
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">Name:</span>
                            {user.name}
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">Role:</span>
                            <Badge className={roleTone(user.role)}>{user.role}</Badge>
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">Status:</span>
                            <Badge className={statusTone(user.status)}>{user.status}</Badge>
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">Email:</span>
                            {user.email || '-'}
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">Last Active:</span>
                            {formatDateTime(user.lastActive)}
                          </TableCell>
                          <TableCell className="block md:table-cell pt-4 md:pt-2">
                            {user.canArchive ? (
                              <Button variant="outline" size="sm" onClick={() => setArchiveTarget(user)}>
                                <Archive className="h-4 w-4 md:mr-2" />
                                <span className="hidden md:inline">Archive</span>
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
                  <TableHeader className="hidden md:table-header-group">
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.size > 0 && selectedUserIds.size === sortedArchivedUsers.length && sortedArchivedUsers.length > 0}
                          ref={input => {
                            if (input) {
                              input.indeterminate = selectedUserIds.size > 0 && selectedUserIds.size < sortedArchivedUsers.length;
                            }
                          }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds(new Set(sortedArchivedUsers.map(u => u.archiveId)));
                            } else {
                              setSelectedUserIds(new Set());
                            }
                          }}
                          className="translate-y-[2px] rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('id')}>
                        <div className="flex items-center gap-1">User ID <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('name')}>
                        <div className="flex items-center gap-1">Name <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('role')}>
                        <div className="flex items-center gap-1">Role <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('status')}>
                        <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('archivedAt')}>
                        <div className="flex items-center gap-1">Archived On <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedArchivedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                          No archived accounts matched your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedArchivedUsers.map((user) => (
                        <TableRow key={user.archiveId} className="flex flex-col md:table-row border-b md:border-b-0 pb-4 md:pb-0 mb-4 md:mb-0 relative">
                          <TableCell className="absolute right-0 top-0 md:relative md:block md:table-cell">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.has(user.archiveId)}
                              onChange={(e) => {
                                const next = new Set(selectedUserIds);
                                if (e.target.checked) next.add(user.archiveId);
                                else next.delete(user.archiveId);
                                setSelectedUserIds(next);
                              }}
                              className="rounded border-gray-300"
                            />
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">User ID:</span>
                            <span className="font-medium">{user.id}</span>
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">Name:</span>
                            {user.name}
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">Role:</span>
                            <Badge className={roleTone(user.role)}>{user.role}</Badge>
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">Status:</span>
                            <Badge className={statusTone(user.status)}>{user.status}</Badge>
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">Archived On:</span>
                            {formatDateTime(user.archivedAt)}
                          </TableCell>
                          <TableCell className="block md:table-cell">
                            <span className="md:hidden font-bold inline-block w-28">Note:</span>
                            <span className="max-w-60 truncate inline-block align-bottom">{user.archivedReason || '-'}</span>
                          </TableCell>
                          <TableCell className="block md:table-cell pt-4 md:pt-2">
                            <div className="flex flex-col gap-2 md:flex-row">
                              <Button variant="outline" size="sm" onClick={() => setRestoreTarget(user)}>
                                <RefreshCcw className="h-4 w-4 md:mr-2" />
                                <span className="hidden md:inline">Restore</span>
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(user)}>
                                <Trash2 className="h-4 w-4 md:mr-2" />
                                <span className="hidden md:inline">Delete Permanently</span>
                              </Button>
                            </div>
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
