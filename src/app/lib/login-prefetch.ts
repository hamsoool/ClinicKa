import { getStudentAnnouncements, type AuthMe, type UserRole } from './api';
import { appQueryClient } from '../query-client';
import {
  adminAnalyticsQueryOptions,
  adminStaffUsersQueryOptions,
  adminSubmissionsQueryOptions,
  adminSystemSettingsQueryOptions,
  adminUserAccountsQueryOptions,
} from '../pages/admin/admin-workflow-query';
import {
  staffAnalyticsQueryOptions,
  staffApprovedStudentsQueryOptions,
  staffDashboardOverviewQueryOptions,
  staffSubmissionSummariesQueryOptions,
} from '../pages/staff/staff-workflow-query';
import { studentRecordsQueryOptions } from '../pages/student/student-records-query';
import { studentProfileAssetsQueryOptions } from '../pages/student/student-profile-assets-query';
import { superAdminAdministratorsQueryOptions } from '../pages/super-admin/super-admin-workflow-query';
import { prefetchPortalRoutes } from '../route-modules';

function normalizeEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase();
}

export function inferRoleFromEmail(email?: string | null): UserRole {
  const normalized = normalizeEmail(email);
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('staff')) return 'staff';
  return 'student';
}

function warmQuery(promise: Promise<unknown>) {
  void promise.catch(() => {
    // Query warmups are best-effort and should never block auth.
  });
}

export function prefetchLikelyPortalRoutes(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  prefetchPortalRoutes(inferRoleFromEmail(normalized));
}

export function prefetchPortalExperience(role: UserRole, me?: AuthMe | null) {
  prefetchPortalRoutes(role);

  if (role === 'student') {
    const studentId = me?.student?.student_id || me?.profile.student_id || null;
    const profileId = me?.student?.profile_id || me?.profile.id || null;
    if (studentId) {
      warmQuery(appQueryClient.prefetchQuery(studentRecordsQueryOptions(studentId, 'summary')));
      warmQuery(appQueryClient.prefetchQuery(studentRecordsQueryOptions(studentId)));
      if (profileId) {
        warmQuery(appQueryClient.prefetchQuery(studentProfileAssetsQueryOptions(studentId, profileId)));
      }
    }
    warmQuery(appQueryClient.prefetchQuery({ queryKey: ['studentAnnouncements'], queryFn: getStudentAnnouncements }));
    return;
  }

  if (role === 'staff') {
    warmQuery(appQueryClient.prefetchQuery(staffDashboardOverviewQueryOptions()));
    warmQuery(
      appQueryClient.prefetchQuery(
        staffSubmissionSummariesQueryOptions({
          statusFilter: 'action_needed',
          page: 1,
          pageSize: 25,
          sortOrder: 'desc',
        }),
      ),
    );
    warmQuery(
      appQueryClient.prefetchQuery(
        staffApprovedStudentsQueryOptions({
          statusFilter: 'all',
          page: 1,
          pageSize: 20,
          sortOrder: 'desc',
        }),
      ),
    );
    warmQuery(appQueryClient.prefetchQuery(staffAnalyticsQueryOptions()));
    return;
  }

  if (role === 'super_admin') {
    warmQuery(appQueryClient.prefetchQuery(superAdminAdministratorsQueryOptions()));
    return;
  }

  warmQuery(appQueryClient.prefetchQuery(adminAnalyticsQueryOptions()));
  warmQuery(appQueryClient.prefetchQuery(adminStaffUsersQueryOptions()));
  warmQuery(appQueryClient.prefetchQuery(adminSubmissionsQueryOptions()));
  warmQuery(appQueryClient.prefetchQuery(adminUserAccountsQueryOptions()));
  warmQuery(appQueryClient.prefetchQuery(adminSystemSettingsQueryOptions()));
}

export function prefetchRouteData(path: string, me?: AuthMe | null) {
  const normalized = path.split('?')[0].split('#')[0];
  const studentId = me?.student?.student_id || me?.profile.student_id || null;
  const profileId = me?.student?.profile_id || me?.profile.id || null;

  if (normalized === '/student' || normalized === '/student/dashboard') {
    if (studentId) {
      warmQuery(appQueryClient.prefetchQuery(studentRecordsQueryOptions(studentId, 'summary')));
      if (profileId) warmQuery(appQueryClient.prefetchQuery(studentProfileAssetsQueryOptions(studentId, profileId)));
    }
    warmQuery(appQueryClient.prefetchQuery({ queryKey: ['studentAnnouncements'], queryFn: getStudentAnnouncements }));
    return;
  }

  if (normalized.startsWith('/student/clearance')) {
    if (studentId) {
      warmQuery(appQueryClient.prefetchQuery(studentRecordsQueryOptions(studentId)));
    }
    return;
  }

  if (normalized.startsWith('/student/announcements')) {
    warmQuery(appQueryClient.prefetchQuery({ queryKey: ['studentAnnouncements'], queryFn: getStudentAnnouncements }));
    return;
  }

  if (normalized.startsWith('/student/profile')) {
    if (studentId && profileId) {
      warmQuery(appQueryClient.prefetchQuery(studentProfileAssetsQueryOptions(studentId, profileId)));
    }
    return;
  }

  if (normalized === '/staff' || normalized.startsWith('/staff/submissions')) {
    warmQuery(
      appQueryClient.prefetchQuery(
        staffSubmissionSummariesQueryOptions({
          statusFilter: 'action_needed',
          page: 1,
          pageSize: 25,
          sortOrder: 'desc',
        }),
      ),
    );
    return;
  }

  if (normalized.startsWith('/staff/dashboard')) {
    warmQuery(appQueryClient.prefetchQuery(staffDashboardOverviewQueryOptions()));
    return;
  }

  if (normalized.startsWith('/staff/records') || normalized.startsWith('/staff/certificates')) {
    warmQuery(
      appQueryClient.prefetchQuery(
        staffApprovedStudentsQueryOptions({
          statusFilter: 'all',
          page: 1,
          pageSize: 20,
          sortOrder: 'desc',
        }),
      ),
    );
    return;
  }

  if (normalized.startsWith('/staff/reports')) {
    warmQuery(appQueryClient.prefetchQuery(staffAnalyticsQueryOptions()));
    return;
  }

  if (normalized === '/admin' || normalized.startsWith('/admin/dashboard')) {
    warmQuery(appQueryClient.prefetchQuery(adminAnalyticsQueryOptions()));
    return;
  }

  if (normalized.startsWith('/admin/user-accounts')) {
    warmQuery(appQueryClient.prefetchQuery(adminUserAccountsQueryOptions()));
    return;
  }

  if (normalized.startsWith('/admin/system-settings')) {
    warmQuery(appQueryClient.prefetchQuery(adminSystemSettingsQueryOptions()));
    return;
  }

  if (normalized.startsWith('/super-admin')) {
    warmQuery(appQueryClient.prefetchQuery(superAdminAdministratorsQueryOptions()));
  }
}
