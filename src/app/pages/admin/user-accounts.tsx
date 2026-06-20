import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import PasswordStrengthMeter from '../../components/password-strength-meter';
import PortalPageIntro from '../../components/portal-page-intro';
import ListPagination from '../../components/list-pagination';
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
import { Archive, Printer, Search, UserCog, UserPlus, Users, ArrowUpDown, RefreshCcw, Eye, EyeOff, FileSpreadsheet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import {
  archiveUserAccount,
  createAdminAccount,
  createAdminStaff,
  restoreArchivedUserAccount,
  getReportingTermSettings,
  type AdminUserAccount,
  type ArchivedUserAccount,
} from '../../lib/api';
import { getPasswordPolicyMessage, getPasswordStrengthResult } from '../../lib/password-policy';
import { buildXlsxBlob } from '../../lib/excel-export';
import {
  invalidateAdminWorkflowQueries,
  useAdminArchivedAccountsQuery,
  useAdminUserAccountsQuery,
} from './admin-workflow-query';
import {
  AccountSummaryButton,
  CLINIC_STAFF_ROLE_FILTER,
  formatDateTime,
  getDisplayName,
  isClinicStaffRole,
  matchesRoleFilter,
  matchesSearch,
  normalizeRoleFilter,
  roleTone,
  sortAccountRows,
  statusTone,
  type SortConfig,
} from './user-accounts-helpers';

function deriveStudentIdFromEmail(email: string) {
  const localPart = (email || '').trim().split('@')[0] || '';
  const match = localPart.match(/^(\d{9})/);
  return match?.[1] || '';
}

export default function AdminUserAccounts() {
  const queryClient = useQueryClient();
  const { data: reportingTermSettings } = useQuery({
    queryKey: ['reportingTermSettings'],
    queryFn: getReportingTermSettings,
    staleTime: 60_000,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const urlRoleFilter = normalizeRoleFilter(searchParams.get('role'));
  const [roleFilter, setRoleFilter] = useState(urlRoleFilter);
  const [openCreate, setOpenCreate] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AdminUserAccount | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ArchivedUserAccount | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'student' | 'staff' | 'doctor',
    firstName: '',
    lastName: '',
    studentId: '',
    department: '',
    course: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const createPasswordInputs = useMemo(
    () => ({
      email: form.email,
      firstName: form.firstName,
      lastName: form.lastName,
      studentId: form.role === 'student' ? form.studentId : undefined,
    }),
    [form.email, form.firstName, form.lastName, form.role, form.studentId],
  );
  const createPasswordResult = useMemo(
    () => getPasswordStrengthResult(form.password, createPasswordInputs),
    [form.password, createPasswordInputs],
  );

  const { data: activeData, isError: isErrorActive } = useAdminUserAccountsQuery();
  const { data: archivedData, isError: isErrorArchived } = useAdminArchivedAccountsQuery();

  const userAccounts = (activeData?.users || []).filter((user) => user.role !== 'Super Admin');
  const archivedAccounts = (archivedData?.users || []).filter((user) => user.role !== 'Super Admin');

  useEffect(() => {
    if (isErrorActive || isErrorArchived) {
      toast.error('Failed to load user accounts');
    }
  }, [isErrorActive, isErrorArchived]);

  useEffect(() => {
    setRoleFilter((current) => (current === urlRoleFilter ? current : urlRoleFilter));
  }, [urlRoleFilter]);

  const applyRoleFilter = (value: string) => {
    const nextFilter = normalizeRoleFilter(value);
    setRoleFilter(nextFilter);

    const nextParams = new URLSearchParams(searchParams);
    if (nextFilter === 'all') {
      nextParams.delete('role');
    } else {
      nextParams.set('role', nextFilter);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const showAccounts = (nextTab: 'active' | 'archive', nextRoleFilter = 'all') => {
    setTab(nextTab);
    setSearchQuery('');
    setSelectedUserIds(new Set());
    applyRoleFilter(nextRoleFilter);
  };

  const filteredActiveUsers = useMemo(
    () =>
      userAccounts.filter((user) => {
        if (!matchesSearch(user, searchQuery)) return false;
        if (!matchesRoleFilter(user.role, roleFilter)) return false;
        return true;
      }),
    [searchQuery, roleFilter, userAccounts],
  );

  const filteredArchivedUsers = useMemo(
    () =>
      archivedAccounts.filter((user) => {
        if (!matchesSearch(user, searchQuery)) return false;
        if (!matchesRoleFilter(user.role, roleFilter)) return false;
        return true;
      }),
    [archivedAccounts, searchQuery, roleFilter],
  );

  const sortedActiveUsers = useMemo(
    () => sortAccountRows(filteredActiveUsers, sortConfig, ['lastActive']),
    [filteredActiveUsers, sortConfig],
  );

  const [activeUsersPage, setActiveUsersPage] = useState(1);

  useEffect(() => {
    setActiveUsersPage(1);
  }, [searchQuery, roleFilter, tab]);

  const ACTIVE_USERS_PER_PAGE = 20;
  const totalActiveUsersPages = Math.max(1, Math.ceil(sortedActiveUsers.length / ACTIVE_USERS_PER_PAGE));

  const paginatedActiveUsers = useMemo(() => {
    const activePage = Math.min(activeUsersPage, totalActiveUsersPages);
    const start = (activePage - 1) * ACTIVE_USERS_PER_PAGE;
    return sortedActiveUsers.slice(start, start + ACTIVE_USERS_PER_PAGE);
  }, [sortedActiveUsers, activeUsersPage, totalActiveUsersPages]);

  const sortedArchivedUsers = useMemo(
    () => sortAccountRows(filteredArchivedUsers, sortConfig, ['archivedAt']),
    [filteredArchivedUsers, sortConfig],
  );

  const archiveableActiveUsers = useMemo(
    () => sortedActiveUsers.filter((user) => user.canArchive),
    [sortedActiveUsers],
  );
  const allArchiveableSelected = useMemo(
    () =>
      archiveableActiveUsers.length > 0 &&
      archiveableActiveUsers.every((user) => selectedUserIds.has(user.userId)),
    [archiveableActiveUsers, selectedUserIds],
  );
  const someArchiveableSelected = useMemo(
    () => archiveableActiveUsers.some((user) => selectedUserIds.has(user.userId)),
    [archiveableActiveUsers, selectedUserIds],
  );
  const allArchivedSelected = useMemo(
    () =>
      sortedArchivedUsers.length > 0 &&
      sortedArchivedUsers.every((user) => selectedUserIds.has(user.archiveId)),
    [selectedUserIds, sortedArchivedUsers],
  );
  const someArchivedSelected = useMemo(
    () => sortedArchivedUsers.some((user) => selectedUserIds.has(user.archiveId)),
    [selectedUserIds, sortedArchivedUsers],
  );

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
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!createPasswordResult.isStrongEnough) {
      toast.error(getPasswordPolicyMessage(createPasswordResult));
      return;
    }
    let derivedId = '';
    if (form.role === 'student') {
      derivedId = deriveStudentIdFromEmail(form.email);
      if (!derivedId) {
        toast.error('Could not derive a valid 9-digit Student ID from the email');
        return;
      }
    }
    if ((form.role === 'staff' || form.role === 'doctor') && (!form.firstName.trim() || !form.lastName.trim())) {
      toast.error('First name and last name are required for clinic staff and clinic doctor accounts');
      return;
    }

    try {
      setIsSubmitting(true);
      if (form.role === 'staff' || form.role === 'doctor') {
        await createAdminStaff({
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          position: form.role === 'doctor' ? 'Clinic Doctor' : 'Clinic Staff',
        });
      } else {
        await createAdminAccount({
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          studentId: form.role === 'student' ? derivedId.trim() : undefined,
          department: form.department.trim() || undefined,
          course: form.course.trim() || undefined,
        });
      }
      toast.success(
        form.role === 'student'
          ? 'Account created without email verification'
          : form.role === 'doctor'
            ? 'Clinic doctor account created without email verification'
            : 'Clinic staff account created without email verification',
      );
      setOpenCreate(false);
      setForm({
        email: '',
        password: '',
        confirmPassword: '',
        role: 'student',
        firstName: '',
        lastName: '',
        studentId: '',
        department: '',
        course: '',
      });
      await invalidateAdminWorkflowQueries(queryClient);
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
      await invalidateAdminWorkflowQueries(queryClient);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to archive account');
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
      await invalidateAdminWorkflowQueries(queryClient);
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
      await invalidateAdminWorkflowQueries(queryClient);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to archive some accounts');
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
      await invalidateAdminWorkflowQueries(queryClient);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to restore some accounts');
    } finally {
      setIsActionPending(false);
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  const exportToExcel = () => {
    try {
      const generatedOn = formatDateTime(new Date().toISOString());
      const academicYear = `SY ${reportingTermSettings?.academicYear || '2026-2027'}`;
      
      const title = tab === 'archive' 
        ? 'GORDON COLLEGE HEALTH SERVICES UNIT - ARCHIVED ACCOUNTS REPORT' 
        : 'GORDON COLLEGE HEALTH SERVICES UNIT - ACTIVE ACCOUNTS REPORT';

      const headers = ['No.', 'User ID', 'Name', 'Email', 'Role'];
      const dataRows = tab === 'archive'
        ? filteredArchivedUsers.map((user, idx) => [
            String(idx + 1),
            user.id,
            getDisplayName(user),
            user.email || '-',
            user.role,
          ])
        : filteredActiveUsers.map((user, idx) => [
            String(idx + 1),
            user.id,
            getDisplayName(user),
            user.email || '-',
            user.role,
          ]);

      const workbookRows = [
        [title],
        [`Academic Year: ${academicYear}`],
        [`Generated On: ${generatedOn}`],
        [`Filtered Records: ${dataRows.length}`],
        [],
        headers,
        ...dataRows,
        ['Total', '', '', '', String(dataRows.length)],
      ];

      const colWidths = [10, 18, 28, 28, 18];
      const blob = buildXlsxBlob(workbookRows, colWidths);
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tab === 'archive' ? 'archived' : 'active'}_accounts_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Account list exported successfully as Excel');
    } catch (error) {
      console.error('Failed to export Excel:', error);
      toast.error('Failed to export account list');
    }
  };

  const administratorCount = userAccounts.filter((user) => user.role === 'Administrator').length;
  const clinicStaffCount = userAccounts.filter((user) => isClinicStaffRole(user.role)).length;
  const accountSearchPlaceholder =
    roleFilter === CLINIC_STAFF_ROLE_FILTER
      ? tab === 'archive'
        ? 'Search archived clinic staff'
        : 'Search clinic staff accounts'
      : tab === 'archive'
        ? 'Search archived accounts'
        : 'Search active accounts';

  const printRows = tab === 'archive' ? sortedArchivedUsers : sortedActiveUsers;

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 print:space-y-4 print:bg-white print:text-black print:max-w-none">
      <PortalPageIntro
        className="print:hidden"
        title="User Accounts"
        actions={(
          <Button className="w-full sm:w-fit md:self-auto" onClick={() => setOpenCreate(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create Account
          </Button>
        )}
      />

      <div className="grid grid-cols-4 gap-1.5 sm:gap-4 print:hidden">
        <AccountSummaryButton
          label="Active Accounts"
          value={userAccounts.length}
          active={tab === 'active' && roleFilter === 'all'}
          onClick={() => showAccounts('active')}
        >
          <Users className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
        </AccountSummaryButton>
        <AccountSummaryButton
          label="Clinic Staff"
          value={clinicStaffCount}
          active={tab === 'active' && roleFilter === CLINIC_STAFF_ROLE_FILTER}
          onClick={() => showAccounts('active', CLINIC_STAFF_ROLE_FILTER)}
        >
          <UserCog className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
        </AccountSummaryButton>
        <AccountSummaryButton
          label="Archived Accounts"
          value={archivedAccounts.length}
          active={tab === 'archive' && roleFilter === 'all'}
          onClick={() => showAccounts('archive')}
        >
          <Archive className="h-8 w-8 text-amber-600 transition-transform group-hover:scale-110" />
        </AccountSummaryButton>
        <AccountSummaryButton
          label="Protected Admins"
          value={administratorCount}
          active={tab === 'active' && roleFilter === 'Administrator'}
          onClick={() => showAccounts('active', 'Administrator')}
        >
          <Badge className="bg-purple-100 px-3 py-1 text-purple-700 transition-transform group-hover:scale-105">Protected</Badge>
        </AccountSummaryButton>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Account</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
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
            <div className="grid gap-1.5">
              <Label htmlFor="ua-email">Email</Label>
              <Input
                id="ua-email"
                value={form.email}
                onChange={(e) => {
                  const email = e.target.value;
                  setForm((prev) => {
                    const nextState = { ...prev, email };
                    if (prev.role === 'student') {
                      nextState.studentId = deriveStudentIdFromEmail(email);
                    }
                    return nextState;
                  });
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ua-password">Password</Label>
              <div className="relative">
                <Input
                  id="ua-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ua-confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="ua-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={form.password} userInputs={createPasswordInputs} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ua-role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(value) =>
                  setForm((prev) => {
                    const nextRole = value as 'student' | 'staff' | 'doctor';
                    const nextState = {
                      ...prev,
                      role: nextRole,
                    };
                    if (nextRole === 'student') {
                      nextState.studentId = deriveStudentIdFromEmail(prev.email);
                    } else {
                      nextState.studentId = '';
                    }
                    return nextState;
                  })
                }
              >
                <SelectTrigger id="ua-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="staff">Clinic Staff</SelectItem>
                  <SelectItem value="doctor">Clinic Doctor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === 'student' ? (
              <div className="grid gap-3 sm:grid-cols-2">
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
                ? `Archive ${archiveTarget.name}? The user will be removed from active lists and blocked from accessing the system until an admin restores the account.`
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

      <Tabs value={tab} onValueChange={setTab} className="print:hidden">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="active">Active Accounts</TabsTrigger>
            <TabsTrigger value="archive">Archive</TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-nowrap sm:items-center">
            {selectedUserIds.size > 0 && (
              <div className="flex flex-row flex-shrink-0 items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 print:hidden">
                <span className="text-sm font-medium text-primary whitespace-nowrap">{selectedUserIds.size} selected</span>
                {tab === 'active' ? (
                  <Button variant="default" size="sm" onClick={() => setBulkArchiveOpen(true)} className="h-8 shrink-0">
                    <Archive className="mr-2 h-4 w-4" /> Bulk Archive
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setBulkRestoreOpen(true)} className="h-8 shrink-0">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Bulk Restore
                  </Button>
                )}
              </div>
            )}

            <div className="relative w-full sm:w-[18rem] shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={accountSearchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 w-full md:contents">
              <div className="flex gap-1.5 md:hidden w-full">
                <Select value={sortConfig?.key || ''} onValueChange={(val) => setSortConfig({ key: val, direction: sortConfig?.direction || 'asc' })}>
                  <SelectTrigger className="w-full flex-1 min-w-0">
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
                  className="shrink-0 px-2"
                  disabled={!sortConfig}
                  onClick={() => setSortConfig(prev => prev ? { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : null)}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>

              <Select value={roleFilter} onValueChange={applyRoleFilter}>
                <SelectTrigger className="w-full sm:w-[190px] sm:shrink-0">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="Student">Student</SelectItem>
                  <SelectItem value={CLINIC_STAFF_ROLE_FILTER}>Clinic Staff</SelectItem>
                  <SelectItem value="Clinic Doctor">Clinic Doctor</SelectItem>
                  <SelectItem value="Administrator">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row print:hidden shrink-0">
              <Button variant="outline" size="sm" onClick={exportToPDF} className="w-full sm:w-auto shrink-0 gap-1.5 sm:gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button onClick={exportToExcel} size="sm" className="w-full sm:w-auto shrink-0 gap-1.5 sm:gap-2 bg-primary text-white hover:bg-primary/90">
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
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
              {sortedActiveUsers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-muted-foreground">
                  No active accounts matched your search.
                </div>
              ) : null}

              <div className="space-y-3 md:hidden">
                {paginatedActiveUsers.map((user) => (
                  <Card key={user.userId} className="border-outline-variant/40">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{getDisplayName(user)}</p>
                          <p className="text-xs text-muted-foreground">{user.id}</p>
                        </div>
                        {user.canArchive ? (
                          <input
                            type="checkbox"
                            checked={selectedUserIds.has(user.userId)}
                            onChange={(e) => {
                              const next = new Set(selectedUserIds);
                              if (e.target.checked) next.add(user.userId);
                              else next.delete(user.userId);
                              setSelectedUserIds(next);
                            }}
                            className="mt-0.5 rounded border-outline-variant"
                          />
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className={roleTone(user.role)}>{user.role}</Badge>
                        <Badge className={statusTone(user.status)}>{user.status}</Badge>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="break-all">
                          <span className="font-medium text-on-surface">Email:</span> {user.email || '-'}
                        </p>
                        <p>
                          <span className="font-medium text-on-surface">Last Active:</span> {formatDateTime(user.lastActive)}
                        </p>
                      </div>

                      {user.canArchive ? (
                        <Button variant="outline" size="sm" onClick={() => setArchiveTarget(user)} className="w-full">
                          <Archive className="mr-2 h-4 w-4" />
                          Archive Account
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" disabled className="w-full">
                          Protected Role
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={allArchiveableSelected}
                          ref={input => {
                            if (input) {
                              input.indeterminate = someArchiveableSelected && !allArchiveableSelected;
                            }
                          }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds(new Set(archiveableActiveUsers.map((user) => user.userId)));
                            } else {
                              setSelectedUserIds(new Set());
                            }
                          }}
                          className="translate-y-[2px] rounded border-outline-variant"
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
                    {paginatedActiveUsers.map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell>
                          {user.canArchive ? (
                            <input
                              type="checkbox"
                              checked={selectedUserIds.has(user.userId)}
                              onChange={(e) => {
                                const next = new Set(selectedUserIds);
                                if (e.target.checked) next.add(user.userId);
                                else next.delete(user.userId);
                                setSelectedUserIds(next);
                              }}
                              className="rounded border-outline-variant"
                            />
                          ) : null}
                        </TableCell>
                        <TableCell className="font-medium">{user.id}</TableCell>
                        <TableCell>{getDisplayName(user)}</TableCell>
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
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ListPagination
                currentPage={Math.min(activeUsersPage, totalActiveUsersPages)}
                totalPages={totalActiveUsersPages}
                totalItems={sortedActiveUsers.length}
                pageSize={20}
                pageSizeOptions={[20]}
                itemLabel="accounts"
                onPageChange={setActiveUsersPage}
                onPageSizeChange={() => {}}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archive">
          <Card>
            <CardHeader>
              <CardTitle>Archived Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Archived accounts stay inactive until you restore them. Their records remain preserved while they are in the archive.
              </div>
              {sortedArchivedUsers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-muted-foreground">
                  No archived accounts matched your search.
                </div>
              ) : null}

              <div className="space-y-3 md:hidden">
                {sortedArchivedUsers.map((user) => (
                  <Card key={user.archiveId} className="border-outline-variant/40">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{getDisplayName(user)}</p>
                          <p className="text-xs text-muted-foreground">{user.id}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(user.archiveId)}
                          onChange={(e) => {
                            const next = new Set(selectedUserIds);
                            if (e.target.checked) next.add(user.archiveId);
                            else next.delete(user.archiveId);
                            setSelectedUserIds(next);
                          }}
                          className="mt-0.5 rounded border-outline-variant"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className={roleTone(user.role)}>{user.role}</Badge>
                        <Badge className={statusTone(user.status)}>{user.status}</Badge>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium text-on-surface">Archived On:</span> {formatDateTime(user.archivedAt)}
                        </p>
                        <p className="break-words">
                          <span className="font-medium text-on-surface">Reason:</span> {user.archivedReason || '-'}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => setRestoreTarget(user)} className="w-full">
                          <RefreshCcw className="mr-2 h-4 w-4" />
                          Restore Account
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
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={allArchivedSelected}
                          ref={input => {
                            if (input) {
                              input.indeterminate = someArchivedSelected && !allArchivedSelected;
                            }
                          }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds(new Set(sortedArchivedUsers.map(u => u.archiveId)));
                            } else {
                              setSelectedUserIds(new Set());
                            }
                          }}
                          className="translate-y-[2px] rounded border-outline-variant"
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
                    {sortedArchivedUsers.map((user) => (
                      <TableRow key={user.archiveId}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedUserIds.has(user.archiveId)}
                            onChange={(e) => {
                              const next = new Set(selectedUserIds);
                              if (e.target.checked) next.add(user.archiveId);
                              else next.delete(user.archiveId);
                              setSelectedUserIds(next);
                            }}
                            className="rounded border-outline-variant"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{user.id}</TableCell>
                        <TableCell>{getDisplayName(user)}</TableCell>
                        <TableCell>
                          <Badge className={roleTone(user.role)}>{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusTone(user.status)}>{user.status}</Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(user.archivedAt)}</TableCell>
                        <TableCell>
                          <span className="inline-block max-w-60 truncate align-bottom">{user.archivedReason || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => setRestoreTarget(user)}>
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Official Print Header (Gordon College Letterhead) ── */}
      <div className="hidden print:block mb-5 font-sans">
        <div className="flex items-center justify-between">
          <img src="/gordon-college-logo.png" alt="Gordon College Logo" className="w-16 h-16 object-contain" />
          <div className="text-center flex-1 mx-4">
            <h1 className="text-[18.5px] font-black tracking-wider uppercase text-black leading-none">
              GORDON COLLEGE
            </h1>
            <p className="text-[11px] font-medium leading-relaxed text-black mt-1">
              Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City
            </p>
            <p className="text-[11px] font-medium leading-relaxed text-black">
              Tel. No.: (047) 222-2089 / (047) 603-7175
            </p>
            <p className="text-[11px] font-medium leading-relaxed text-black">
              Website: www.gordoncollege.edu.ph
            </p>
            <div className="mt-1.5 text-[11.5px] font-bold uppercase tracking-wider text-black leading-none">
              Health Services Unit
            </div>
            <div className="mt-4 text-[11px] font-bold text-black">
              SY {reportingTermSettings?.academicYear || '2026-2027'}
            </div>
          </div>
          <img src="/gordonhsc.png" alt="Health Services Unit Logo" className="w-16 h-16 object-contain" />
        </div>
      </div>

      <div className="hidden print:block mb-4 print:-mt-[3.5px]">
        <h2 className="text-[25px] font-bold text-left text-black leading-none">
          {tab === 'archive' ? 'Summary of Archived Users' : 'Summary of Active Users'}
        </h2>
      </div>

      {/* ── Print-only Table ── */}
      <div className="hidden print:block overflow-visible rounded-none border-[1.5px] border-black/70">
        <table className="w-full border-collapse text-left text-sm print:text-[8.5px] print:text-center">
          <thead className="bg-white text-black print:bg-white print:text-black">
            <tr className="border-b-[1.5px] border-black/70">
              <th scope="col" className="border-r-[1.5px] border-black/70 px-3 py-2 font-bold print:border-black/70 print:px-2 print:py-1">
                No.
              </th>
              <th scope="col" className="border-r-[1.5px] border-black/70 px-3 py-2 font-bold print:border-black/70 print:px-2 print:py-1">
                User ID
              </th>
              <th scope="col" className="border-r-[1.5px] border-black/70 px-3 py-2 font-bold print:border-black/70 print:px-2 print:py-1 print:text-left">
                Name
              </th>
              <th scope="col" className="border-r-[1.5px] border-black/70 px-3 py-2 font-bold print:border-black/70 print:px-2 print:py-1 print:text-left">
                Email
              </th>
              <th scope="col" className="px-3 py-2 font-bold print:px-2 print:py-1">
                Role
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-[1.5px] divide-black/70">
            {printRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground print:border-black/70 print:text-black">
                  No accounts matched your filters.
                </td>
              </tr>
            ) : (
              <>
                {printRows.map((user, idx) => (
                  <tr key={user.id} className="bg-white text-black break-inside-avoid">
                    <td className="whitespace-nowrap px-3 py-2 print:border-r-[1.5px] print:border-black/70 print:px-2 print:py-1 print:text-black">
                      {idx + 1}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 print:border-r-[1.5px] print:border-black/70 print:px-2 print:py-1 print:text-black">
                      {user.id}
                    </td>
                    <td className="px-3 py-2 print:border-r-[1.5px] print:border-black/70 print:px-2 print:py-1 print:text-black print:text-left">
                      {getDisplayName(user)}
                    </td>
                    <td className="px-3 py-2 print:border-r-[1.5px] print:border-black/70 print:px-2 print:py-1 print:text-black print:text-left">
                      {user.email || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 print:px-2 print:py-1 print:text-black">
                      {user.role}
                    </td>
                  </tr>
                ))}
                <tr className="bg-white font-bold text-black print:bg-white print:text-black print:font-bold">
                  <td className="whitespace-nowrap px-3 py-2 font-bold print:border-r-[1.5px] print:border-black/70 print:px-2 print:py-1 print:text-black print:font-bold">
                    Total
                  </td>
                  <td className="px-3 py-2 print:border-r-[1.5px] print:border-black/70 print:px-2 print:py-1"></td>
                  <td className="px-3 py-2 print:border-r-[1.5px] print:border-black/70 print:px-2 print:py-1"></td>
                  <td className="px-3 py-2 print:border-r-[1.5px] print:border-black/70 print:px-2 print:py-1"></td>
                  <td className="whitespace-nowrap px-3 py-2 font-bold print:px-2 print:py-1 print:text-black print:font-bold">
                    {printRows.length}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Custom Print-Only Styles and Footer ── */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            size: auto;
            margin: 0;
          }
          body {
            padding: 1.6cm 1.6cm 1.8cm 1.6cm !important;
            background-color: #fff !important;
          }
          tr {
            break-inside: avoid;
          }
          thead {
            display: table-header-group;
          }
        }
      `}} />
      <div className="hidden print:flex flex-col fixed bottom-[1.2cm] left-[1.6cm] right-[1.6cm] text-[8.5px] text-black/50 font-sans">
        <div className="flex justify-between items-end border-t border-black/15 pt-1">
          <span className="leading-none">https://clinicka.vercel.app</span>
          <span className="leading-none">ClinicKa!</span>
        </div>
      </div>
    </div>
  );
}
