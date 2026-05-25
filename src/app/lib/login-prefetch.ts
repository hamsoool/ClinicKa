import type { AuthMe, UserRole } from './api';
import { appQueryClient } from '../query-client';
import {
  adminAnalyticsQueryOptions,
  adminStaffUsersQueryOptions,
  adminSubmissionsQueryOptions,
  adminUserAccountsQueryOptions,
} from '../pages/admin/admin-workflow-query';
import {
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
    if (!studentId) return;
    warmQuery(appQueryClient.prefetchQuery(studentRecordsQueryOptions(studentId, 'summary')));
    if (profileId) {
      warmQuery(appQueryClient.prefetchQuery(studentProfileAssetsQueryOptions(studentId, profileId)));
    }
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
}
