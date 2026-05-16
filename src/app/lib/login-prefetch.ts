import type { AuthMe, UserRole } from './api';
import { appQueryClient } from '../query-client';
import {
  adminAnalyticsQueryOptions,
  adminStaffUsersQueryOptions,
  adminSubmissionsQueryOptions,
  adminUserAccountsQueryOptions,
} from '../pages/admin/admin-workflow-query';
import { staffAnalyticsQueryOptions, staffSubmissionsQueryOptions } from '../pages/staff/staff-workflow-query';
import { studentRecordsQueryOptions } from '../pages/student/student-records-query';
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
    if (!studentId) return;
    warmQuery(appQueryClient.prefetchQuery(studentRecordsQueryOptions(studentId)));
    return;
  }

  if (role === 'staff') {
    warmQuery(appQueryClient.prefetchQuery(staffAnalyticsQueryOptions()));
    warmQuery(appQueryClient.prefetchQuery(staffSubmissionsQueryOptions()));
    return;
  }

  warmQuery(appQueryClient.prefetchQuery(adminAnalyticsQueryOptions()));
  warmQuery(appQueryClient.prefetchQuery(adminStaffUsersQueryOptions()));
  warmQuery(appQueryClient.prefetchQuery(adminSubmissionsQueryOptions()));
  warmQuery(appQueryClient.prefetchQuery(adminUserAccountsQueryOptions()));
}
