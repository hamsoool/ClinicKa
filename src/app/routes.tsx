import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { PortalPageSkeleton, PortalShellSkeleton, PublicPageSkeleton } from './components/project-skeletons';
import { RedirectIfAuthenticated, RequireAuth } from './lib/auth';

const RoleSelection = lazy(() => import('./pages/role-selection'));
const AuthAccessPage = lazy(() => import('./pages/auth-access'));
const CheckEmailPage = lazy(() => import('./pages/check-email'));
const StudentDashboard = lazy(() => import('./pages/student/dashboard'));
const StudentYearSelection = lazy(() => import('./pages/student/year-selection'));
const StudentPrivacyWaiver = lazy(() => import('./pages/student/privacy-waiver'));
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

type RouteSkeletonVariant =
  | 'marketing'
  | 'auth'
  | 'portal-shell'
  | 'portal-page'
  | 'portal-table'
  | 'portal-certificate';

function renderSkeleton(variant: RouteSkeletonVariant) {
  if (variant === 'marketing' || variant === 'auth') {
    return <PublicPageSkeleton variant={variant} />;
  }

  if (variant === 'portal-shell') {
    return <PortalShellSkeleton />;
  }

  if (variant === 'portal-table') {
    return <PortalPageSkeleton variant="table" />;
  }

  if (variant === 'portal-certificate') {
    return <PortalPageSkeleton variant="certificate" />;
  }

  return <PortalPageSkeleton variant="dashboard" />;
}

function withSuspense(Component: ComponentType, variant: RouteSkeletonVariant = 'portal-page') {
  return (
    <Suspense fallback={renderSkeleton(variant)}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RedirectIfAuthenticated>
        {withSuspense(RoleSelection, 'marketing')}
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/auth",
    element: (
      <RedirectIfAuthenticated>
        {withSuspense(AuthAccessPage, 'auth')}
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/check-email",
    element: (
      <RedirectIfAuthenticated>
        {withSuspense(CheckEmailPage, 'auth')}
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/student",
    element: (
      <RequireAuth allowedRoles={['student']}>
        {withSuspense(StudentLayout, 'portal-shell')}
      </RequireAuth>
    ),
    children: [
      { index: true, element: withSuspense(StudentDashboard) },
      { path: "records", element: withSuspense(StudentRecords, 'portal-table') },
      { path: "year-selection", element: withSuspense(StudentYearSelection) },
      { path: "privacy-waiver/:year", element: withSuspense(StudentPrivacyWaiver) },
      { path: "medical-form/:year", element: withSuspense(StudentMedicalForm) },
      { path: "requirements", element: withSuspense(StudentRequirements) },
      { path: "profile", element: withSuspense(StudentProfile) },
      { path: "certificate", element: withSuspense(StudentCertificate, 'portal-certificate') },
    ],
  },
  {
    path: "/staff",
    element: (
      <RequireAuth allowedRoles={['staff']}>
        {withSuspense(StaffLayout, 'portal-shell')}
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
        {withSuspense(AdminLayout, 'portal-shell')}
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
