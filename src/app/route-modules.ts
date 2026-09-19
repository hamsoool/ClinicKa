export type AppRole = 'student' | 'staff' | 'admin' | 'super_admin';

type RouteLoader = () => Promise<unknown>;

export const loadCheckEmailPage = () => import('./pages/check-email');
export const loadCreatePasswordPage = () => import('./pages/create-password');

export const loadStudentDashboard = () => import('./pages/student/dashboard');
export const loadStudentYearSelection = () => import('./pages/student/year-selection');
export const loadStudentPrivacyWaiver = () => import('./pages/student/privacy-waiver');
export const loadStudentMedicalForm = () => import('./pages/student/medical-form');
export const loadStudentLayout = () => import('./pages/student/layout');
export const loadStudentProfile = () => import('./pages/student/profile');
export const loadStudentCertificate = () => import('./pages/student/certificate');
export const loadStudentClearance = () => import('./pages/student/clearance');
export const loadStudentAnnouncements = () => import('./pages/student/announcements');

export const loadStaffLayout = () => import('./pages/staff/layout');
export const loadStaffDashboard = () => import('./pages/staff/dashboard');
export const loadStaffSubmissions = () => import('./pages/staff/submissions');
export const loadStaffRecordReview = () => import('./pages/staff/record-review');
export const loadStaffReports = () => import('./pages/staff/reports');
export const loadStaffCertificates = () => import('./pages/staff/certificates');
export const loadStaffSettings = () => import('./pages/staff/settings');
export const loadStaffAnnouncements = () => import('./pages/staff/announcements');

export const loadAdminLayout = () => import('./pages/admin/layout');
export const loadAdminDashboard = () => import('./pages/admin/dashboard');
export const loadAdminSystemSettings = () => import('./pages/admin/system-settings');
export const loadAdminUserAccounts = () => import('./pages/admin/user-accounts');
export const loadAdminReports = () => import('./pages/admin/reports');
export const loadAdminAnnouncements = () => import('./pages/admin/announcements');

export const loadSuperAdminLayout = () => import('./pages/super-admin/layout');
export const loadSuperAdminAdministrators = () => import('./pages/super-admin/administrators');

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
    loadStudentLayout,
    loadStudentDashboard,
    loadStudentYearSelection,
    loadStudentClearance,
    loadStudentCertificate,
    loadStudentProfile,
    loadStudentAnnouncements,
    loadStudentPrivacyWaiver,
    loadStudentMedicalForm,
  ],
  staff: [
    loadStaffLayout,
    loadStaffDashboard,
    loadStaffSubmissions,
    loadStaffReports,
    loadStaffCertificates,
    loadStaffSettings,
    loadStaffAnnouncements,
    loadStaffRecordReview,
  ],
  admin: [
    loadAdminLayout,
    loadAdminDashboard,
    loadAdminSystemSettings,
    loadAdminUserAccounts,
    loadAdminReports,
    loadAdminAnnouncements,
  ],
  super_admin: [
    loadSuperAdminLayout,
    loadSuperAdminAdministrators,
  ],
};

export function prefetchPortalRoutes(role: AppRole) {
  for (const loader of portalLoadersByRole[role]) {
    preloadLoader(loader);
  }
}

const pathToLoaderMap: Record<string, RouteLoader> = {
  '/student': loadStudentDashboard,
  '/student/clearance': loadStudentClearance,
  '/student/year-selection': loadStudentYearSelection,
  '/student/announcements': loadStudentAnnouncements,
  '/student/profile': loadStudentProfile,
  '/student/certificate': loadStudentCertificate,
  '/student/privacy-waiver': loadStudentPrivacyWaiver,
  '/student/medical-form': loadStudentMedicalForm,
  '/staff': loadStaffSubmissions,
  '/staff/submissions': loadStaffSubmissions,
  '/staff/dashboard': loadStaffDashboard,
  '/staff/reports': loadStaffReports,
  '/staff/records': loadStaffCertificates,
  '/staff/certificates': loadStaffCertificates,
  '/staff/announcements': loadStaffAnnouncements,
  '/staff/settings': loadStaffSettings,
  '/staff/record-review': loadStaffRecordReview,
  '/admin': loadAdminDashboard,
  '/admin/dashboard': loadAdminDashboard,
  '/admin/user-accounts': loadAdminUserAccounts,
  '/admin/system-settings': loadAdminSystemSettings,
  '/admin/reports': loadAdminReports,
  '/admin/announcements': loadAdminAnnouncements,
  '/super-admin': loadSuperAdminAdministrators,
};

export function prefetchRouteByPath(path: string) {
  const normalized = path.split('?')[0].split('#')[0];
  const loader = pathToLoaderMap[normalized];
  if (loader) {
    preloadLoader(loader);
  }
}
