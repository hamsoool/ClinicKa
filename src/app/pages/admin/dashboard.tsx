import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import { getAnalytics, getStaffUsers, getSubmissions, getUserAccounts } from '../../lib/api';
import { useAuth } from '../../lib/auth';

type AnalyticsSummary = {
  totalStudents: number;
  totalSubmissions: number;
  pendingRecords: number;
  approvedRecords: number;
  returnedRecords: number;
};

type StaffUser = {
  id: string;
  name: string;
  role: string;
  status: string;
  email: string;
};

type UserAccount = {
  id: string;
  name: string;
  role: string;
  status: string;
  lastActive?: string;
};

type SubmissionSummary = {
  id: string;
  firstName?: string;
  lastName?: string;
  studentId?: string;
  submittedAt: string;
  updatedAt?: string;
  status: 'pending' | 'approved' | 'returned';
  course?: string;
};

function formatEmailName(email?: string | null) {
  if (!email) return '';

  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value?: string) {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getStatusLabel(status: SubmissionSummary['status']) {
  switch (status) {
    case 'pending':
      return 'Pending review';
    case 'approved':
      return 'Approved';
    case 'returned':
      return 'Returned';
    default:
      return status;
  }
}

function getStatusStyles(status: SubmissionSummary['status']) {
  switch (status) {
    case 'approved':
      return 'bg-primary-container/20 text-on-primary-container';
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'returned':
      return 'bg-error-container/70 text-on-error-container';
    default:
      return 'bg-surface-variant text-on-surface-variant';
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName =
    [me?.profile.first_name || '', me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    formatEmailName(me?.profile.email) ||
    'System Administrator';

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [analyticsData, staffData, userData, submissionData] = await Promise.all([
          getAnalytics(),
          getStaffUsers(),
          getUserAccounts(),
          getSubmissions(),
        ]);

        setAnalytics(analyticsData as AnalyticsSummary);
        setStaffUsers((staffData.staff || []) as StaffUser[]);
        setUserAccounts((userData.users || []) as UserAccount[]);
        setSubmissions((submissionData.submissions || []) as SubmissionSummary[]);
      } catch (error) {
        console.error('Error loading admin dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  if (loading) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  const activeStaffCount = staffUsers.filter((staff) => staff.status === 'Active').length;
  const adminCount = userAccounts.filter((user) => user.role === 'Administrator').length;
  const clinicStaffCount = userAccounts.filter((user) => user.role === 'Clinic Staff').length;
  const studentAccounts = userAccounts.filter((user) => user.role === 'Student').length;
  const recentAccounts = [...userAccounts]
    .filter((user) => user.lastActive)
    .sort((a, b) => new Date(b.lastActive || 0).getTime() - new Date(a.lastActive || 0).getTime())
    .slice(0, 5);
  const submissionsNeedingAttention = [...submissions]
    .filter((submission) => submission.status === 'pending' || submission.status === 'returned')
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5);

  const summaryCards = [
    {
      label: 'Total Accounts',
      value: userAccounts.length,
      icon: Users,
      tone: 'text-primary',
      detail: 'All student, clinic, and admin accounts',
    },
    {
      label: 'Active Clinic Staff',
      value: activeStaffCount,
      icon: UserCog,
      tone: 'text-emerald-700',
      detail: 'Staff accounts currently available for operations',
    },
    {
      label: 'Pending Reviews',
      value: analytics?.pendingRecords || 0,
      icon: Clock3,
      tone: 'text-amber-600',
      detail: 'Submissions still waiting for clinic processing',
    },
    {
      label: 'Returned Cases',
      value: analytics?.returnedRecords || 0,
      icon: ShieldAlert,
      tone: 'text-rose-700',
      detail: 'Records requiring student correction or follow-up',
    },
  ] as const;

  const roleDistribution = [
    { label: 'Students', count: studentAccounts, color: 'bg-primary' },
    { label: 'Clinic Staff', count: clinicStaffCount, color: 'bg-emerald-500' },
    { label: 'Administrators', count: adminCount, color: 'bg-amber-500' },
  ];

  const totalRoleCount = roleDistribution.reduce((sum, role) => sum + role.count, 0) || 1;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-container/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-on-primary-container">
              <ShieldCheck className="h-4 w-4" />
              Admin Control Center
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-on-surface">Welcome, {displayName}</h1>
              <p className="mt-2 max-w-2xl text-base text-on-surface-variant">
                Monitor platform health, manage user access, and keep clinic operations aligned from one shared administrative workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-on-surface-variant">
              <span className="rounded-full bg-surface-container px-3 py-1.5">
                Total submissions: <span className="font-semibold text-on-surface">{analytics?.totalSubmissions || 0}</span>
              </span>
              <span className="rounded-full bg-surface-container px-3 py-1.5">
                Approved records: <span className="font-semibold text-on-surface">{analytics?.approvedRecords || 0}</span>
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => navigate('/admin/users')}
              className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 text-left shadow-sm transition-colors hover:bg-surface-container"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                User Accounts
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-on-surface">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{userAccounts.length}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-on-surface-variant" />
              </div>
            </button>
            <button
              onClick={() => navigate('/admin/settings')}
              className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 text-left shadow-sm transition-colors hover:bg-surface-container"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                System Settings
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-on-surface">
                  <Settings className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold">Security, audit, clinic profile</span>
                </div>
                <ArrowRight className="h-4 w-4 text-on-surface-variant" />
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                    {card.label}
                  </p>
                  <p className="mt-3 text-3xl font-bold text-on-surface">{card.value}</p>
                </div>
                <div className={`rounded-2xl bg-surface-container p-3 ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-sm text-on-surface-variant">{card.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Admin Action Queue</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Records that still need administrative visibility because they are pending or have been returned.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/reports')}
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Open Reports
            </button>
          </div>

          {submissionsNeedingAttention.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low px-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="mt-4 text-lg font-semibold text-on-surface">No escalations right now</p>
              <p className="mt-2 max-w-sm text-sm text-on-surface-variant">
                Pending and returned cases are currently clear or minimal.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissionsNeedingAttention.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-start gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-on-surface">
                        {submission.firstName} {submission.lastName}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getStatusStyles(submission.status)}`}
                      >
                        {getStatusLabel(submission.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {submission.studentId || '--'} | {submission.course || 'Course unavailable'}
                    </p>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      Submitted {formatDate(submission.submittedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-on-surface">Role Distribution</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Snapshot of who is currently represented in the system.
            </p>
          </div>
          <div className="space-y-4">
            {roleDistribution.map((role) => (
              <div key={role.label} className="space-y-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <p className="font-medium text-on-surface">{role.label}</p>
                  <p className="text-on-surface-variant">{role.count}</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                  <div
                    className={`h-full rounded-full ${role.color}`}
                    style={{ width: `${Math.max((role.count / totalRoleCount) * 100, role.count > 0 ? 8 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => navigate('/admin/staff')}
              className="flex items-center justify-between rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-4 text-left transition-colors hover:bg-surface-container"
            >
              <div>
                <p className="text-sm font-semibold text-on-surface">Manage Staff</p>
                <p className="mt-1 text-xs text-on-surface-variant">Roles, access, availability</p>
              </div>
              <UserCog className="h-5 w-5 text-primary" />
            </button>
            <button
              onClick={() => navigate('/admin/users')}
              className="flex items-center justify-between rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-4 text-left transition-colors hover:bg-surface-container"
            >
              <div>
                <p className="text-sm font-semibold text-on-surface">Review Accounts</p>
                <p className="mt-1 text-xs text-on-surface-variant">Account health and access</p>
              </div>
              <Users className="h-5 w-5 text-primary" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Recent Account Activity</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Recently active users across the platform.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/users')}
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              View Users
            </button>
          </div>

          {recentAccounts.length === 0 ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">
              No account activity available.
            </div>
          ) : (
            <div className="space-y-3">
              {recentAccounts.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container-low"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{user.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {user.role} | {user.status}
                    </p>
                  </div>
                  <p className="text-right text-xs text-on-surface-variant">
                    {formatDateTime(user.lastActive)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">System Health Snapshot</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                A lightweight admin overview of platform readiness.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/settings')}
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Open Settings
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
              <div>
                <p className="font-medium text-on-surface">Platform Health</p>
                <p className="text-sm text-on-surface-variant">Core services responding normally</p>
              </div>
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
              <div>
                <p className="font-medium text-on-surface">Clinic Staff Coverage</p>
                <p className="text-sm text-on-surface-variant">{activeStaffCount} active staff available</p>
              </div>
              <span className="text-sm font-semibold text-primary">{staffUsers.length} total</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
              <div>
                <p className="font-medium text-on-surface">Approval Completion</p>
                <p className="text-sm text-on-surface-variant">
                  {analytics?.approvedRecords || 0} of {analytics?.totalSubmissions || 0} submissions approved
                </p>
              </div>
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
