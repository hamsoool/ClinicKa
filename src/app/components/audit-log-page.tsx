import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronDown, ChevronRight, ChevronUp, Filter, ShieldAlert } from 'lucide-react';
import PortalPageIntro from './portal-page-intro';
import ListPagination from './list-pagination';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { getAuditLogs, type AuditLog, type AuditLogFilters } from '../lib/api';

type AuditLogPageProps = {
  scope: 'admin' | 'super-admin';
};

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const actionOptions = [
  'VIEW_MEDICAL_RECORD',
  'VIEW_MEDICAL_DOCUMENT',
  'UPDATE_CLEARANCE_STATUS',
  'UPDATE_PHYSICAL_EXAM',
  'UPLOAD_MEDICAL_DOCUMENT',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
];

const roleOptions = ['staff', 'doctor', 'admin', 'super_admin'];
const categoryOptions = ['auth', 'medical_record', 'medical_document', 'clearance', 'admin', 'security', 'announcement', 'profile', 'ocr'];

function formatDate(value?: string | null) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : dateTimeFormatter.format(date);
}

function resultClassName(result: string) {
  if (result === 'SUCCESS') return 'bg-green-100 text-green-800 hover:bg-green-100';
  if (result === 'DENIED') return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
  return 'bg-red-100 text-red-800 hover:bg-red-100';
}

function label(value?: string | null) {
  if (!value) return 'Not specified';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

function actionLabel(action?: string | null) {
  return label(action);
}

export default function AuditLogPage({ scope }: AuditLogPageProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [draft, setDraft] = useState<AuditLogFilters>({});
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useQuery({
    queryKey: ['auditLogs', scope, page, pageSize, filters],
    queryFn: () => getAuditLogs(scope, { ...filters, page, perPage: pageSize }),
    staleTime: 30_000,
  });
  const logs = query.data?.data || [];
  const meta = query.data?.meta;
  const totalPages = Math.max(1, meta?.last_page || 1);

  const updateDraft = (key: keyof AuditLogFilters, value: string) => {
    setDraft((current) => ({ ...current, [key]: value || undefined }));
  };

  const applyFilters = () => {
    setPage(1);
    setFilters({ ...draft });
  };

  const clearFilters = () => {
    setPage(1);
    setDraft({});
    setFilters({});
  };

  return (
    <div className="w-full min-w-0 space-y-8">
      <PortalPageIntro
        eyebrow={<span className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">{scope === 'super-admin' ? 'Security oversight' : 'Operational accountability'}</span>}
        title="Audit Logs"
        description={scope === 'super-admin' ? 'Review authentication, access, and administrative security events.' : 'Review access and changes affecting clinic records and documents.'}
      />

      <Card>
        <CardContent className="pt-6">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-between px-0 text-sm font-semibold text-foreground hover:bg-transparent"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              Filters
            </span>
            {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {filtersOpen ? <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="audit-from">From</Label>
              <Input id="audit-from" type="date" value={draft.from || ''} onChange={(event) => updateDraft('from', event.target.value)} />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="audit-to">To</Label>
              <Input id="audit-to" type="date" value={draft.to || ''} onChange={(event) => updateDraft('to', event.target.value)} />
            </div>
            <div className="min-w-0 space-y-2">
              <Label>Action</Label>
              <Select value={draft.action || 'all'} onValueChange={(value) => updateDraft('action', value === 'all' ? '' : value)}>
                <SelectTrigger className="min-w-0"><SelectValue placeholder="All actions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actionOptions.map((action) => <SelectItem key={action} value={action}>{actionLabel(action)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label>Result</Label>
              <Select value={draft.result || 'all'} onValueChange={(value) => updateDraft('result', value === 'all' ? '' : value)}>
                <SelectTrigger className="min-w-0"><SelectValue placeholder="All results" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All results</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="DENIED">Denied</SelectItem>
                  <SelectItem value="FAILURE">Failure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label>Actor role</Label>
              <Select value={draft.actorRole || 'all'} onValueChange={(value) => updateDraft('actorRole', value === 'all' ? '' : value)}>
                <SelectTrigger className="min-w-0"><SelectValue placeholder="All roles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roleOptions.map((role) => <SelectItem key={role} value={role}>{label(role)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label>Category</Label>
              <Select value={draft.category || 'all'} onValueChange={(value) => updateDraft('category', value === 'all' ? '' : value)}>
                <SelectTrigger className="min-w-0"><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoryOptions.map((category) => <SelectItem key={category} value={category}>{label(category)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="audit-student">Student name</Label>
              <Input id="audit-student" value={draft.studentName || ''} onChange={(event) => updateDraft('studentName', event.target.value)} placeholder="Search student name" />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="audit-actor">Actor name</Label>
              <Input id="audit-actor" value={draft.actorName || ''} onChange={(event) => updateDraft('actorName', event.target.value)} placeholder="Search actor name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button type="button" className="w-full sm:w-auto" onClick={applyFilters}><CalendarDays className="mr-2 h-4 w-4" />Apply</Button>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={clearFilters}>Clear</Button>
          </div>
          </div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-0">
          {query.isLoading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading audit events...</div> : null}
          {query.isError ? <div className="py-12 text-center text-sm text-destructive">Audit events could not be loaded.</div> : null}
          {!query.isLoading && !query.isError && logs.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No audit events match these filters.</div> : null}
          {logs.length > 0 ? (
            <>
            <div className="space-y-3 md:hidden">
              {logs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  className="w-full rounded-xl border border-border/70 bg-background p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  onClick={() => setSelected(log)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-foreground">{actionLabel(log.action)}</p>
                    </div>
                    <Badge className={`shrink-0 ${resultClassName(log.result)}`}>{label(log.result)}</Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-3 text-sm">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Actor</dt>
                      <dd className="mt-0.5 break-words font-medium text-foreground">{log.actor}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Role</dt>
                      <dd className="mt-0.5 break-words text-foreground">{label(log.actorRole)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Target</dt>
                      <dd className="mt-0.5 break-words text-foreground">{log.targetId || label(log.targetType)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Student</dt>
                      <dd className="mt-0.5 break-words text-foreground">{log.studentId || 'Not associated'}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-right text-xs font-semibold text-primary">View details</p>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead><span className="sr-only">Details</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelected(log)}>
                      <TableCell className="whitespace-nowrap text-sm">{formatDate(log.createdAt)}</TableCell>
                      <TableCell><div className="font-medium">{log.actor}</div><div className="text-xs text-muted-foreground">{label(log.actorRole)}</div></TableCell>
                      <TableCell><div className="text-sm font-semibold">{actionLabel(log.action)}</div><div className="text-xs text-muted-foreground">{label(log.category)}</div></TableCell>
                      <TableCell className="text-sm">{log.targetId || label(log.targetType)}</TableCell>
                      <TableCell className="text-sm">{log.studentId || '—'}</TableCell>
                      <TableCell><Badge className={resultClassName(log.result)}>{log.result}</Badge></TableCell>
                      <TableCell><Button type="button" variant="ghost" size="icon" aria-label="View audit event details"><ChevronRight className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          ) : null}
          <ListPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={meta?.total || 0}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(value) => { setPageSize(value); setPage(1); }}
            itemLabel="audit events"
          />
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" />Audit Event Details</DialogTitle>
            <DialogDescription>Operational context only. Medical values and document contents are never shown here.</DialogDescription>
          </DialogHeader>
          {selected ? (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ['Event ID', selected.id],
                ['Timestamp', formatDate(selected.createdAt)],
                ['Actor', `${selected.actor} (${label(selected.actorRole)})`],
                ['Action', actionLabel(selected.action)],
                ['Category', label(selected.category)],
                ['Target', selected.targetId ? `${label(selected.targetType)} ${selected.targetId}` : label(selected.targetType)],
                ['Student', selected.studentId || 'Not associated'],
                ['Result', label(selected.result)],
                ['Reason', selected.reason || 'Not specified'],
                ['IP address', selected.ipAddress || 'Not available'],
                ['User agent', selected.userAgent || 'Not available'],
              ].map(([key, value]) => <div key={key} className="space-y-1"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{key}</dt><dd className="break-words text-foreground">{value}</dd></div>)}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}