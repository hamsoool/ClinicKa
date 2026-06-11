import type { ReactNode } from 'react';
import type { AdminUserAccount, ArchivedUserAccount } from '../../lib/api';
import { cn } from '../../components/ui/utils';

export const CLINIC_STAFF_ROLE_FILTER = 'clinic-staff';

type SearchableAccount =
  | Pick<AdminUserAccount, 'id' | 'name' | 'role' | 'email'>
  | Pick<ArchivedUserAccount, 'id' | 'name' | 'role' | 'email'>;

type DisplayableAccount = {
  name?: string;
  email?: string | null;
  id?: string;
};

type CsvAccountRow = {
  id: string;
  name: string;
  role: string;
  status: string;
  date?: string | null;
  email: string;
};

export type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

export function isClinicStaffRole(role: string) {
  return role === 'Clinic Staff' || role === 'Clinic Doctor';
}

export function normalizeRoleFilter(value?: string | null) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();

  if (!raw || normalized === 'all') return 'all';
  if (normalized === CLINIC_STAFF_ROLE_FILTER || normalized === 'clinic staff' || normalized === 'staff') {
    return CLINIC_STAFF_ROLE_FILTER;
  }
  if (normalized === 'student') return 'Student';
  if (normalized === 'clinic doctor') return 'Clinic Doctor';
  if (normalized === 'administrator') return 'Administrator';
  if (normalized === 'super admin' || normalized === 'super_admin' || normalized === 'super administrator') {
    return 'Super Admin';
  }
  return 'all';
}

export function matchesRoleFilter(role: string, filter: string) {
  if (filter === 'all') return true;
  if (filter === CLINIC_STAFF_ROLE_FILTER) return isClinicStaffRole(role);
  return role === filter;
}

export function AccountSummaryButton({
  label,
  value,
  active,
  children,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-h-[6.75rem] w-full items-center justify-between rounded-[18px] border bg-card p-5 text-left text-card-foreground transition-all hover:border-primary/45 hover:bg-primary-container/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        active && 'border-primary/45 bg-primary-container/10',
      )}
    >
      <span>
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="mt-2 block text-2xl font-bold text-on-surface sm:text-3xl">{value}</span>
      </span>
      {children}
    </button>
  );
}

export function roleTone(role: string) {
  if (role === 'Super Admin') {
    return 'bg-rose-100 text-rose-700';
  }
  if (role === 'Administrator') {
    return 'bg-purple-100 text-purple-700';
  }
  if (role === 'Clinic Doctor') {
    return 'bg-indigo-100 text-indigo-700';
  }
  if (role === 'Clinic Staff') {
    return 'bg-primary/10 text-primary';
  }
  return 'bg-surface-container text-on-surface-variant';
}

export function statusTone(status: string) {
  if (status === 'Active') {
    return 'bg-primary/10 text-primary';
  }
  if (status === 'Archived') {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-yellow-100 text-yellow-700';
}

export function formatDateTime(value?: string) {
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

export function matchesSearch(account: SearchableAccount, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [account.id, account.name, account.role, account.email || '']
    .join(' ')
    .toLowerCase()
    .includes(needle);
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

export function getDisplayName(account: DisplayableAccount) {
  const rawName = String(account.name || '').trim();
  if (rawName && !rawName.includes('@')) return rawName;

  const fromEmail = prettifyEmailName(account.email);
  if (fromEmail) return fromEmail;

  return rawName || String(account.id || 'Unnamed User');
}

function normalizeSortValue(value: unknown, asDate = false) {
  if (asDate) {
    if (!value) return 0;
    const time = new Date(String(value)).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  return String(value ?? '').toLowerCase();
}

export function sortAccountRows<T extends Record<string, unknown>>(
  rows: T[],
  sortConfig: SortConfig | null,
  dateKeys: string[] = [],
) {
  if (!sortConfig) return [...rows];

  const treatAsDate = dateKeys.includes(sortConfig.key);
  return [...rows].sort((a, b) => {
    const aValue = normalizeSortValue(a[sortConfig.key], treatAsDate);
    const bValue = normalizeSortValue(b[sortConfig.key], treatAsDate);

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });
}

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function downloadAccountsCsv(
  filenamePrefix: 'active' | 'archive',
  dateColumnLabel: string,
  rows: CsvAccountRow[],
) {
  const csvLines = [
    `User ID,Name,Role,Status,${dateColumnLabel},Email`,
    ...rows.map((row) =>
      [
        row.id,
        row.name,
        row.role,
        row.status,
        row.date || '',
        row.email,
      ]
        .map((value) => escapeCsvValue(String(value)))
        .join(','),
    ),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${filenamePrefix}_accounts_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
}
