import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  Mail,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import PortalPageIntro from '../../components/portal-page-intro';
import { toast } from 'sonner';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import {
  createSuperAdminAdministrator,
  deleteSuperAdminAdministrator,
  type SuperAdminAdministrator,
} from '../../lib/api';
import {
  invalidateSuperAdminWorkflowQueries,
  useSuperAdminAdministratorsQuery,
} from './super-admin-workflow-query';
import { getPasswordLengthMessage, isPasswordLongEnough } from '../../lib/password-policy';

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

function getDisplayName(account: Pick<SuperAdminAdministrator, 'name' | 'email' | 'id'>) {
  const rawName = String(account.name || '').trim();
  if (rawName && !rawName.includes('@')) return rawName;
  return prettifyEmailName(account.email) || rawName || account.id;
}

function matchesSearch(account: SuperAdminAdministrator, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [account.id, account.name, account.email || '', account.role]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export default function SuperAdminAdministrators() {
  const queryClient = useQueryClient();
  const { data, isError, isFetching } = useSuperAdminAdministratorsQuery();
  const administrators = data?.administrators || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminAdministrator | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load administrators');
    }
  }, [isError]);

  const filteredAdministrators = useMemo(
    () => administrators.filter((administrator) => matchesSearch(administrator, searchQuery)),
    [administrators, searchQuery],
  );

  const recentlyAdded = useMemo(
    () =>
      [...administrators]
        .filter((administrator) => administrator.createdAt)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 1)[0] || null,
    [administrators],
  );

  const submitCreate = async () => {
    if (!form.email.trim() || !form.password) {
      toast.error('Email and password are required');
      return;
    }
    if (!isPasswordLongEnough(form.password)) {
      toast.error(getPasswordLengthMessage());
      return;
    }

    try {
      setIsSubmitting(true);
      await createSuperAdminAdministrator({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
      });
      toast.success('Administrator account created');
      setOpenCreate(false);
      setForm({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
      });
      await invalidateSuperAdminWorkflowQueries(queryClient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create administrator');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      await deleteSuperAdminAdministrator(deleteTarget.userId);
      toast.success(`${getDisplayName(deleteTarget)} was removed from administrators`);
      setDeleteTarget(null);
      await invalidateSuperAdminWorkflowQueries(queryClient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove administrator');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <PortalPageIntro
        eyebrow={(
          <div className="inline-flex max-w-full items-center gap-2 self-start rounded-full bg-primary-container/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-on-primary-container sm:text-xs sm:tracking-[0.22em]">
            <ShieldCheck className="h-4 w-4" />
            Super Admin Console
          </div>
        )}
        title="Administrator Management"
        description="Create administrator access for system operators and permanently delete admin sign-in accounts that should no longer control the clinic portal."
        actions={(
          <Button className="w-full sm:w-fit" onClick={() => setOpenCreate(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Administrator
          </Button>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                  Administrators
                </p>
                <p className="mt-3 text-3xl font-bold leading-none text-on-surface">{administrators.length}</p>
              </div>
              <div className="rounded-2xl bg-surface-container p-3 text-primary">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm text-on-surface-variant">Active accounts with admin portal access</p>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                  Status
                </p>
                <p className="mt-3 text-3xl font-bold leading-none text-on-surface">
                  {isFetching ? 'Syncing' : 'Active'}
                </p>
              </div>
              <div className="rounded-2xl bg-surface-container p-3 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm text-on-surface-variant">Administrator list refreshes automatically</p>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                  Latest Admin
                </p>
                <p className="mt-3 truncate text-lg font-bold leading-tight text-on-surface">
                  {recentlyAdded ? getDisplayName(recentlyAdded) : 'None yet'}
                </p>
              </div>
              <div className="rounded-2xl bg-surface-container p-3 text-amber-700">
                <CalendarClock className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm text-on-surface-variant">
              {recentlyAdded ? formatDateTime(recentlyAdded.createdAt) : 'Create the first administrator account'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_minmax(28rem,0.75fr)] 2xl:items-start">
      <Card className="border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-on-surface">System Administrators</CardTitle>
            <p className="mt-1 text-sm text-on-surface-variant">
              These users can access the normal administrator portal.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search administrators"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredAdministrators.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-muted-foreground">
              No administrators matched your search.
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
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setDeleteTarget(administrator)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Admin Account
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
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(administrator)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

        <div className="space-y-6 2xl:sticky 2xl:top-24">
      <PasswordChangeCard
        title="Super Admin Password"
        description="Update the password for your super administrator account."
      />
        </div>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Administrator</DialogTitle>
            <DialogDescription>
              Create an administrator account with access to the admin portal.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCreate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="sa-email">Email</Label>
              <Input
                id="sa-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sa-password">Password</Label>
              <Input
                id="sa-password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              />
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
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Administrator'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Admin Account?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${getDisplayName(deleteTarget)} will lose administrator access and their sign-in account will be deleted.`
                : 'This administrator will be removed from the system.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Admin Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
