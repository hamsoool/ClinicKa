import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from './lib/auth';

const RoleSelection = lazy(() => import('./pages/role-selection'));
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
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
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
