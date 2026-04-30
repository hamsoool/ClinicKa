import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from './lib/auth';

const RoleSelection = lazy(() => import('./pages/role-selection'));
const AuthAccessPage = lazy(() => import('./pages/auth-access'));
const CheckEmailPage = lazy(() => import('./pages/check-email'));
const StudentDashboard = lazy(() => import('./pages/student/dashboard'));
const StudentYearSelection = lazy(() => import('./pages/student/year-selection'));
const StudentMedicalForm = lazy(() => import('./pages/student/medical-form'));
const StudentLayout = lazy(() => import('./pages/student/layout'));
const StudentRecords = lazy(() => import('./pages/student/records'));
const StudentRequirements = lazy(() => import('./pages/student/requirements'));
const StudentProfile = lazy(() => import('./pages/student/profile'));
const StudentCertificate = lazy(() => import('./pages/student/certificate'));
const StaffLayout = lazy(() => import('./pages/staff/layout'));
const StaffDashboard = lazy(() => import('./pages/staff/dashboard'));
const StaffSubmissions = lazy(() => import('./pages/staff/submissions'));
const StaffRecordReview = lazy(() => import('./pages/staff/record-review'));
const StaffRecords = lazy(() => import('./pages/staff/records'));
const StaffReports = lazy(() => import('./pages/staff/reports'));
const StaffCertificates = lazy(() => import('./pages/staff/certificates'));
const StaffSettings = lazy(() => import('./pages/staff/settings'));
const AdminLayout = lazy(() => import('./pages/admin/layout'));
const AdminDashboard = lazy(() => import('./pages/admin/dashboard'));
const AdminSystemSettings = lazy(() => import('./pages/admin/system-settings'));
const AdminStaffManagement = lazy(() => import('./pages/admin/staff-management'));
const AdminUserAccounts = lazy(() => import('./pages/admin/user-accounts'));
const AdminReports = lazy(() => import('./pages/admin/reports'));

function withSuspense(Component: ComponentType) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center p-6" aria-busy="true" aria-live="polite">
          <div className="w-full max-w-sm rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
            <span className="sr-only">Loading page...</span>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-surface-container-high" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-container-high" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-surface-container" />
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              <div className="h-3 animate-pulse rounded-full bg-surface-container" />
              <div className="h-3 w-5/6 animate-pulse rounded-full bg-surface-container" />
            </div>
          </div>
        </div>
      }
    >
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RedirectIfAuthenticated>
        {withSuspense(RoleSelection)}
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/auth",
    element: (
      <RedirectIfAuthenticated>
        {withSuspense(AuthAccessPage)}
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/check-email",
    element: (
      <RedirectIfAuthenticated>
        {withSuspense(CheckEmailPage)}
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/student",
    element: (
      <RequireAuth allowedRoles={['student']}>
        {withSuspense(StudentLayout)}
      </RequireAuth>
    ),
    children: [
      { index: true, element: withSuspense(StudentDashboard) },
      { path: "records", element: withSuspense(StudentRecords) },
      { path: "year-selection", element: withSuspense(StudentYearSelection) },
      { path: "medical-form/:year", element: withSuspense(StudentMedicalForm) },
      { path: "requirements", element: withSuspense(StudentRequirements) },
      { path: "profile", element: withSuspense(StudentProfile) },
      { path: "certificate", element: withSuspense(StudentCertificate) },
    ],
  },
  {
    path: "/staff",
    element: (
      <RequireAuth allowedRoles={['staff']}>
        {withSuspense(StaffLayout)}
      </RequireAuth>
    ),
    children: [
      { index: true, element: withSuspense(StaffDashboard) },
      { path: "submissions", element: withSuspense(StaffSubmissions) },
      { path: "records", element: withSuspense(StaffRecords) },
      { path: "review/:submissionId", element: withSuspense(StaffRecordReview) },
      { path: "reports", element: withSuspense(StaffReports) },
      { path: "certificates", element: withSuspense(StaffCertificates) },
      { path: "settings", element: withSuspense(StaffSettings) },
    ],
  },
  {
    path: "/admin",
    element: (
      <RequireAuth allowedRoles={['admin']}>
        {withSuspense(AdminLayout)}
      </RequireAuth>
    ),
    children: [
      { index: true, element: withSuspense(AdminDashboard) },
      { path: "settings", element: withSuspense(AdminSystemSettings) },
      { path: "staff", element: withSuspense(AdminStaffManagement) },
      { path: "users", element: withSuspense(AdminUserAccounts) },
      { path: "reports", element: withSuspense(AdminReports) },
    ],
  },
]);
