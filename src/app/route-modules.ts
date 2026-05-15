export type AppRole = 'student' | 'staff' | 'admin';

type RouteLoader = () => Promise<unknown>;

export const loadRoleSelection = () => import('./pages/role-selection');
export const loadAuthAccessPage = () => import('./pages/auth-access');
export const loadCheckEmailPage = () => import('./pages/check-email');

export const loadStudentDashboard = () => import('./pages/student/dashboard');
export const loadStudentYearSelection = () => import('./pages/student/year-selection');
export const loadStudentPrivacyWaiver = () => import('./pages/student/privacy-waiver');
export const loadStudentMedicalForm = () => import('./pages/student/medical-form');
export const loadStudentLayout = () => import('./pages/student/layout');
export const loadStudentRecords = () => import('./pages/student/records');
export const loadStudentRequirements = () => import('./pages/student/requirements');
export const loadStudentProfile = () => import('./pages/student/profile');
export const loadStudentCertificate = () => import('./pages/student/certificate');
export const loadStudentClearance = () => import('./pages/student/clearance');

export const loadStaffLayout = () => import('./pages/staff/layout');
export const loadStaffDashboard = () => import('./pages/staff/dashboard');
export const loadStaffSubmissions = () => import('./pages/staff/submissions');
export const loadStaffRecordReview = () => import('./pages/staff/record-review');
export const loadStaffRecords = () => import('./pages/staff/records');
export const loadStaffReports = () => import('./pages/staff/reports');
export const loadStaffCertificates = () => import('./pages/staff/certificates');
export const loadStaffSettings = () => import('./pages/staff/settings');

export const loadAdminLayout = () => import('./pages/admin/layout');
export const loadAdminDashboard = () => import('./pages/admin/dashboard');
export const loadAdminSystemSettings = () => import('./pages/admin/system-settings');
export const loadAdminStaffManagement = () => import('./pages/admin/staff-management');
export const loadAdminUserAccounts = () => import('./pages/admin/user-accounts');
export const loadAdminReports = () => import('./pages/admin/reports');

const preloadedLoaders = new Set<RouteLoader>();

function preloadLoader(loader: RouteLoader) {
  if (preloadedLoaders.has(loader)) return;
  preloadedLoaders.add(loader);
  void loader().catch(() => {
    preloadedLoaders.delete(loader);
  });
}

const portalLoadersByRole: Record<AppRole, readonly RouteLoader[]> = {
  student: [
    loadStudentDashboard,
    loadStudentRecords,
    loadStudentYearSelection,
    loadStudentRequirements,
    loadStudentClearance,
    loadStudentCertificate,
    loadStudentProfile,
    loadStudentPrivacyWaiver,
    loadStudentMedicalForm,
  ],
  staff: [
    loadStaffDashboard,
    loadStaffSubmissions,
    loadStaffRecords,
    loadStaffReports,
    loadStaffCertificates,
    loadStaffSettings,
    loadStaffRecordReview,
  ],
  admin: [
    loadAdminDashboard,
    loadAdminSystemSettings,
    loadAdminStaffManagement,
    loadAdminUserAccounts,
    loadAdminReports,
  ],
};

export function prefetchPortalRoutes(role: AppRole) {
  for (const loader of portalLoadersByRole[role]) {
    preloadLoader(loader);
  }
}
