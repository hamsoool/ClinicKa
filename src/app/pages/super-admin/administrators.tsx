import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CalendarClock,
  Mail,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  Eye,
  EyeOff,
} from 'lucide-react';
import PortalPageIntro from '../../components/portal-page-intro';
import { toast } from 'sonner';
import PasswordStrengthMeter from '../../components/password-strength-meter';
import PasswordChangeCard from '../../components/password-change-card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import {
  archiveSuperAdminAdministrator,
  createSuperAdminAdministrator,
  restoreSuperAdminAdministrator,
  sendSuperAdminCreateAdminOtp,
  type SuperAdminAdministrator,
  type SuperAdminArchivedAdministrator,
} from '../../lib/api';
import {
  invalidateSuperAdminWorkflowQueries,
  useSuperAdminAdministratorsQuery,
} from './super-admin-workflow-query';
import { getPasswordPolicyMessage, getPasswordStrengthResult } from '../../lib/password-policy';

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

function prettifyEmailName(email?: string | null) {
  const source = String(email || '').trim();
  if (!source.includes('@')) return '';
  return source
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getDisplayName(
  account: Pick<SuperAdminAdministrator | SuperAdminArchivedAdministrator, 'name' | 'email' | 'id'>,
) {
  const rawName = String(account.name || '').trim();
  if (rawName && !rawName.includes('@')) return rawName;
  return prettifyEmailName(account.email) || rawName || account.id;
}

function matchesSearch(
  account: SuperAdminAdministrator | SuperAdminArchivedAdministrator,
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [account.id, account.name, account.email || '', account.role, account.status]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export default function SuperAdminAdministrators() {
  const queryClient = useQueryClient();
  const { data, isError, isFetching } = useSuperAdminAdministratorsQuery();
  const administrators = data?.administrators || [];
  const archivedAdministrators = data?.archivedAdministrators || [];
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<SuperAdminAdministrator | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<SuperAdminArchivedAdministrator | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showOtpField, setShowOtpField] = useState(false);
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordInputs = useMemo(
    () => ({
      email: form.email,
      firstName: form.firstName,
      lastName: form.lastName,
    }),
    [form.email, form.firstName, form.lastName],
  );
  const passwordResult = useMemo(
    () => getPasswordStrengthResult(form.password, passwordInputs),
    [form.password, passwordInputs],
  );

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load administrators');
    }
  }, [isError]);

  const filteredAdministrators = useMemo(
    () => administrators.filter((administrator) => matchesSearch(administrator, searchQuery)),
    [administrators, searchQuery],
  );

  const filteredArchivedAdministrators = useMemo(
    () => archivedAdministrators.filter((administrator) => matchesSearch(administrator, searchQuery)),
    [archivedAdministrators, searchQuery],
  );

  const recentlyAdded = useMemo(
    () =>
      [...administrators]
        .filter((administrator) => administrator.createdAt)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 1)[0] || null,
    [administrators],
  );

  const requestOtp = async () => {
    if (!form.email.trim() || !form.password) {
      toast.error('Email and password are required');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!passwordResult.isStrongEnough) {
      toast.error(getPasswordPolicyMessage(passwordResult));
      return;
    }

    try {
      setSendingOtp(true);
      await sendSuperAdminCreateAdminOtp();
      toast.success('Verification code sent to your email');
      setShowOtpField(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send verification email');
    } finally {
      setSendingOtp(false);
    }
  };

  const submitCreate = async () => {
    if (!otp.trim()) {
      toast.error('Verification code (OTP) is required');
      return;
    }

    try {
      setIsSubmitting(true);
      await createSuperAdminAdministrator({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        otp: otp.trim(),
      });
      toast.success('Administrator account created');
      setOpenCreate(false);
      setForm({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
      });
      setOtp('');
      setShowOtpField(false);
      await invalidateSuperAdminWorkflowQueries(queryClient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create administrator');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;

    try {
      setIsArchiving(true);
      await archiveSuperAdminAdministrator({
        userId: archiveTarget.userId,
        reason: archiveReason.trim() || undefined,
      });
      toast.success(`${getDisplayName(archiveTarget)} was archived`);
      setArchiveTarget(null);
      setArchiveReason('');
      setTab('archived');
      await invalidateSuperAdminWorkflowQueries(queryClient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive administrator');
    } finally {
      setIsArchiving(false);
    }
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;

    try {
      setIsRestoring(true);
      await restoreSuperAdminAdministrator(restoreTarget.archiveId);
      toast.success(`${getDisplayName(restoreTarget)} was restored`);
      setRestoreTarget(null);
      setTab('active');
      await invalidateSuperAdminWorkflowQueries(queryClient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore administrator');
    } finally {
      setIsRestoring(false);
    }
  };

  const searchPlaceholder =
    tab === 'active'
      ? 'Search active administrators'
      : 'Search archived administrators';

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <PortalPageIntro
        title="Administrator Management"
        actions={(
          <Button className="w-full sm:w-fit" onClick={() => setOpenCreate(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Administrator
          </Button>
        )}
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="border-outline-variant/30 bg-surface-container-lowest">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-start justify-between gap-2 sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] sm:tracking-[0.16em] text-on-surface-variant">
                  Active Admins
                </p>
                <p className="mt-1.5 sm:mt-3 text-xl sm:text-3xl font-bold leading-none text-on-surface">{administrators.length}</p>
              </div>
              <div className="hidden sm:flex rounded-[18px] bg-surface-container p-3 text-primary shrink-0">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm text-on-surface-variant hidden sm:block">Accounts with current admin portal access</p>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/30 bg-surface-container-lowest">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-start justify-between gap-2 sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] sm:tracking-[0.16em] text-on-surface-variant">
                  Archived Admins
                </p>
                <p className="mt-1.5 sm:mt-3 text-xl sm:text-3xl font-bold leading-none text-on-surface">{archivedAdministrators.length}</p>
              </div>
              <div className="hidden sm:flex rounded-[18px] bg-surface-container p-3 text-amber-700 shrink-0">
                <Archive className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm text-on-surface-variant hidden sm:block">Accounts kept inactive until restored</p>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/30 bg-surface-container-lowest">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-start justify-between gap-2 sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] sm:tracking-[0.16em] text-on-surface-variant">
                  Latest Admin
                </p>
                <p className="mt-1.5 sm:mt-3 truncate text-xs sm:text-lg font-bold leading-tight text-on-surface">
                  {recentlyAdded ? getDisplayName(recentlyAdded) : 'None yet'}
                </p>
              </div>
              <div className="hidden sm:flex rounded-[18px] bg-surface-container p-3 text-emerald-700 shrink-0">
                <CalendarClock className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm text-on-surface-variant hidden sm:block">
              {recentlyAdded ? formatDateTime(recentlyAdded.createdAt) : isFetching ? 'Syncing administrator list' : 'Create the first administrator account'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_minmax(28rem,0.75fr)] 2xl:items-start">
        <Card className="border-outline-variant/30 bg-surface-container-lowest">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-on-surface">System Administrators</CardTitle>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(value) => setTab(value as 'active' | 'archived')} className="space-y-4">
              <TabsList className="w-full sm:w-fit">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4">
                {filteredAdministrators.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-muted-foreground">
                    No active administrators matched your search.
                  </div>
                ) : null}

                <div className="space-y-3 md:hidden">
                  {filteredAdministrators.map((administrator) => (
                    <Card key={administrator.userId} className="border-outline-variant/40">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-on-surface">{getDisplayName(administrator)}</p>
                            <p className="break-all text-xs text-muted-foreground">{administrator.email || '-'}</p>
                          </div>
                          <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                        </div>

                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="font-medium text-on-surface">Created:</span> {formatDateTime(administrator.createdAt)}
                          </p>
                          <p>
                            <span className="font-medium text-on-surface">Last Active:</span> {formatDateTime(administrator.lastActive)}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setArchiveTarget(administrator)}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive Account
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAdministrators.map((administrator) => (
                        <TableRow key={administrator.userId}>
                          <TableCell className="font-medium">{getDisplayName(administrator)}</TableCell>
                          <TableCell className="whitespace-normal break-all">
                            <span className="inline-flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {administrator.email || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-purple-100 text-purple-700">Administrator</Badge>
                          </TableCell>
                          <TableCell>{formatDateTime(administrator.createdAt)}</TableCell>
                          <TableCell>{formatDateTime(administrator.lastActive)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setArchiveTarget(administrator)}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="archived" className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Archived administrators cannot sign in until you restore their account.
                </div>

                {filteredArchivedAdministrators.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-muted-foreground">
                    No archived administrators matched your search.
                  </div>
                ) : null}

                <div className="space-y-3 md:hidden">
                  {filteredArchivedAdministrators.map((administrator) => (
                    <Card key={administrator.archiveId} className="border-outline-variant/40">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-on-surface">{getDisplayName(administrator)}</p>
                            <p className="break-all text-xs text-muted-foreground">{administrator.email || '-'}</p>
                          </div>
                          <Badge className="bg-amber-100 text-amber-700">Archived</Badge>
                        </div>

                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="font-medium text-on-surface">Archived On:</span> {formatDateTime(administrator.archivedAt)}
                          </p>
                          <p className="break-words">
                            <span className="font-medium text-on-surface">Note:</span> {administrator.archivedReason || '-'}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setRestoreTarget(administrator)}
                        >
                          <RefreshCcw className="mr-2 h-4 w-4" />
                          Restore Account
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Archived On</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredArchivedAdministrators.map((administrator) => (
                        <TableRow key={administrator.archiveId}>
                          <TableCell className="font-medium">{getDisplayName(administrator)}</TableCell>
                          <TableCell className="whitespace-normal break-all">
                            <span className="inline-flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {administrator.email || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-amber-100 text-amber-700">Archived</Badge>
                          </TableCell>
                          <TableCell>{formatDateTime(administrator.archivedAt)}</TableCell>
                          <TableCell>
                            <span className="inline-block max-w-60 truncate align-bottom">
                              {administrator.archivedReason || '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRestoreTarget(administrator)}
                            >
                              <RefreshCcw className="mr-2 h-4 w-4" />
                              Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-6 2xl:sticky 2xl:top-24">
          <PasswordChangeCard title="Super Admin Password" />
        </div>
      </div>

      <Dialog
        open={openCreate}
        onOpenChange={(open) => {
          setOpenCreate(open);
          if (!open) {
            setShowOtpField(false);
            setOtp('');
            setForm({
              email: '',
              password: '',
              confirmPassword: '',
              firstName: '',
              lastName: '',
            });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Administrator</DialogTitle>
            <DialogDescription>
              {showOtpField
                ? 'Verify your identity to complete administrator creation.'
                : 'Create an administrator account with access to the admin portal.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (showOtpField) {
                void submitCreate();
              } else {
                void requestOtp();
              }
            }}
          >
            {showOtpField ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-primary-container/30 bg-primary-container/10 p-3.5 text-sm space-y-2">
                  <div className="flex justify-between items-center border-b border-primary-container/20 pb-2">
                    <span className="font-semibold text-on-surface">Confirm Details</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary hover:text-primary-hover px-2"
                      onClick={() => setShowOtpField(false)}
                    >
                      Edit
                    </Button>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 text-xs">
                    <span className="text-on-surface-variant">Email:</span>
                    <span className="font-medium text-on-surface truncate">{form.email}</span>
                    <span className="text-on-surface-variant">Name:</span>
                    <span className="font-medium text-on-surface truncate font-sans">
                      {[form.firstName, form.lastName].filter(Boolean).join(' ') || '-'}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3 text-xs text-yellow-800 dark:border-yellow-900/30 dark:bg-yellow-950/20 dark:text-yellow-400 font-sans">
                  A 6-digit verification code has been sent to your super administrator email. Please check your inbox.
                </div>

                <div className="grid gap-1.5 font-sans">
                  <Label htmlFor="sa-otp">Verification Code</Label>
                  <Input
                    id="sa-otp"
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    className="text-center text-lg font-semibold tracking-[0.25em]"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="sa-email">Email</Label>
                  <Input
                    id="sa-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sa-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="sa-password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                      className="pr-10"
                      required
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
                  <div className="grid gap-1.5">
                    <Label htmlFor="sa-confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="sa-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                        className="pr-10"
                        required
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
                  </div>
                  <PasswordStrengthMeter password={form.password} userInputs={passwordInputs} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="sa-first">First Name</Label>
                    <Input
                      id="sa-first"
                      value={form.firstName}
                      onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="sa-last">Last Name</Label>
                    <Input
                      id="sa-last"
                      value={form.lastName}
                      onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenCreate(false)}
                disabled={isSubmitting || sendingOtp}
              >
                Cancel
              </Button>
              {showOtpField ? (
                <Button type="submit" disabled={isSubmitting || !otp || otp.length < 6}>
                  {isSubmitting ? 'Verifying...' : 'Verify & Create'}
                </Button>
              ) : (
                <Button type="submit" disabled={sendingOtp}>
                  {sendingOtp ? 'Sending Code...' : 'Create New Account'}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open && !isArchiving) {
            setArchiveTarget(null);
            setArchiveReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Administrator</DialogTitle>
            <DialogDescription>
              {archiveTarget
                ? `Archive ${getDisplayName(archiveTarget)}? The account will lose administrator access until it is restored.`
                : 'Archive this administrator account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Archiving keeps the profile in the system, but blocks sign-in and moves the account to the archived tab.
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sa-archive-reason">Archive note (optional)</Label>
              <Textarea
                id="sa-archive-reason"
                placeholder="Add context for why this administrator is being archived"
                value={archiveReason}
                onChange={(event) => setArchiveReason(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setArchiveTarget(null);
                setArchiveReason('');
              }}
              disabled={isArchiving}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmArchive()} disabled={isArchiving}>
              {isArchiving ? 'Archiving...' : 'Archive Administrator'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => {
          if (!open && !isRestoring) {
            setRestoreTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Administrator</DialogTitle>
            <DialogDescription>
              {restoreTarget
                ? `Restore ${getDisplayName(restoreTarget)} to active administrator access?`
                : 'Restore this administrator account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            Restoring will reactivate sign-in access and move the account back to the active administrators list.
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRestoreTarget(null)} disabled={isRestoring}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmRestore()} disabled={isRestoring}>
              {isRestoring ? 'Restoring...' : 'Restore Administrator'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
