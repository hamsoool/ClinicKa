import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { PortalPageSkeleton, PortalShellSkeleton, PublicPageSkeleton } from './components/project-skeletons';
import { RedirectIfAuthenticated, RequireAuth } from './lib/auth';
import {
  loadAdminAnnouncements,
  loadAdminDashboard,
  loadAdminLayout,
  loadAdminReports,
  loadAdminSystemSettings,
  loadAdminUserAccounts,
  loadAuthAccessPage,
  loadCheckEmailPage,
  loadRoleSelection,
  loadStaffCertificates,
  loadStaffAnnouncements,
  loadStaffDashboard,
  loadStaffLayout,
  loadStaffRecordReview,
  loadStaffReports,
  loadStaffSettings,
  loadStaffSubmissions,
  loadStudentCertificate,
  loadStudentClearance,
  loadStudentDashboard,
  loadStudentLayout,
  loadStudentMedicalForm,
  loadStudentPrivacyWaiver,
  loadStudentProfile,
  loadStudentAnnouncements,
  loadStudentYearSelection,
  loadSuperAdminAdministrators,
  loadSuperAdminLayout,
} from './route-modules';

const RoleSelection = lazy(loadRoleSelection);
const AuthAccessPage = lazy(loadAuthAccessPage);
const CheckEmailPage = lazy(loadCheckEmailPage);
const StudentDashboard = lazy(loadStudentDashboard);
const StudentYearSelection = lazy(loadStudentYearSelection);
const StudentPrivacyWaiver = lazy(loadStudentPrivacyWaiver);
const StudentMedicalForm = lazy(loadStudentMedicalForm);
const StudentLayout = lazy(loadStudentLayout);
const StudentAnnouncements = lazy(loadStudentAnnouncements);
const StudentProfile = lazy(loadStudentProfile);
const StudentCertificate = lazy(loadStudentCertificate);
const StudentClearance = lazy(loadStudentClearance);
const StaffLayout = lazy(loadStaffLayout);
const StaffDashboard = lazy(loadStaffDashboard);
const StaffSubmissions = lazy(loadStaffSubmissions);
const StaffRecordReview = lazy(loadStaffRecordReview);
const StaffReports = lazy(loadStaffReports);
const StaffCertificates = lazy(loadStaffCertificates);
const StaffAnnouncements = lazy(loadStaffAnnouncements);
const StaffSettings = lazy(loadStaffSettings);
const AdminLayout = lazy(loadAdminLayout);
const AdminDashboard = lazy(loadAdminDashboard);
const AdminSystemSettings = lazy(loadAdminSystemSettings);
const AdminUserAccounts = lazy(loadAdminUserAccounts);
const AdminReports = lazy(loadAdminReports);
const AdminAnnouncements = lazy(loadAdminAnnouncements);
const SuperAdminLayout = lazy(loadSuperAdminLayout);
const SuperAdminAdministrators = lazy(loadSuperAdminAdministrators);

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
      { path: "records", element: <Navigate to="/student/clearance?tab=history" replace /> },
      { path: "year-selection", element: withSuspense(StudentYearSelection) },
      { path: "privacy-waiver/:year", element: withSuspense(StudentPrivacyWaiver) },
      { path: "medical-form/:year", element: withSuspense(StudentMedicalForm) },
      { path: "announcements", element: withSuspense(StudentAnnouncements) },
      { path: "profile", element: withSuspense(StudentProfile) },
      { path: "clearance", element: withSuspense(StudentClearance, 'portal-certificate') },
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
      { path: "records", element: withSuspense(StaffCertificates) },
      { path: "review/:submissionId", element: withSuspense(StaffRecordReview) },
      { path: "reports", element: withSuspense(StaffReports) },
      { path: "certificates", element: <Navigate to="/staff/records?tab=certificates" replace /> },
      { path: "announcements", element: withSuspense(StaffAnnouncements) },
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
      { path: "staff", element: <Navigate to="/admin/users?role=clinic-staff" replace /> },
      { path: "users", element: withSuspense(AdminUserAccounts) },
      { path: "reports", element: withSuspense(AdminReports) },
      { path: "announcements", element: withSuspense(AdminAnnouncements) },
    ],
  },
  {
    path: "/super-admin",
    element: (
      <RequireAuth allowedRoles={['super_admin']}>
        {withSuspense(SuperAdminLayout, 'portal-shell')}
      </RequireAuth>
    ),
    children: [
      { index: true, element: withSuspense(SuperAdminAdministrators, 'portal-table') },
    ],
  },
]);
