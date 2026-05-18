import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { PortalPageSkeleton, PortalShellSkeleton, PublicPageSkeleton } from './components/project-skeletons';
import { RedirectIfAuthenticated, RequireAuth } from './lib/auth';
import {
  loadAdminAnnouncements,
  loadAdminDashboard,
  loadAdminLayout,
  loadAdminReports,
  loadAdminStaffManagement,
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
  loadStaffRecords,
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
  loadStudentRecords,
  loadStudentRequirements,
  loadStudentAnnouncements,
  loadStudentYearSelection,
} from './route-modules';

const RoleSelection = lazy(loadRoleSelection);
const AuthAccessPage = lazy(loadAuthAccessPage);
const CheckEmailPage = lazy(loadCheckEmailPage);
const StudentDashboard = lazy(loadStudentDashboard);
const StudentYearSelection = lazy(loadStudentYearSelection);
const StudentPrivacyWaiver = lazy(loadStudentPrivacyWaiver);
const StudentMedicalForm = lazy(loadStudentMedicalForm);
const StudentLayout = lazy(loadStudentLayout);
const StudentRecords = lazy(loadStudentRecords);
const StudentRequirements = lazy(loadStudentRequirements);
const StudentAnnouncements = lazy(loadStudentAnnouncements);
const StudentProfile = lazy(loadStudentProfile);
const StudentCertificate = lazy(loadStudentCertificate);
const StudentClearance = lazy(loadStudentClearance);
const StaffLayout = lazy(loadStaffLayout);
const StaffDashboard = lazy(loadStaffDashboard);
const StaffSubmissions = lazy(loadStaffSubmissions);
const StaffRecordReview = lazy(loadStaffRecordReview);
const StaffRecords = lazy(loadStaffRecords);
const StaffReports = lazy(loadStaffReports);
const StaffCertificates = lazy(loadStaffCertificates);
const StaffAnnouncements = lazy(loadStaffAnnouncements);
const StaffSettings = lazy(loadStaffSettings);
const AdminLayout = lazy(loadAdminLayout);
const AdminDashboard = lazy(loadAdminDashboard);
const AdminSystemSettings = lazy(loadAdminSystemSettings);
const AdminStaffManagement = lazy(loadAdminStaffManagement);
const AdminUserAccounts = lazy(loadAdminUserAccounts);
const AdminReports = lazy(loadAdminReports);
const AdminAnnouncements = lazy(loadAdminAnnouncements);

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
      { path: "records", element: withSuspense(StaffRecords) },
      { path: "review/:submissionId", element: withSuspense(StaffRecordReview) },
      { path: "reports", element: withSuspense(StaffReports) },
      { path: "certificates", element: withSuspense(StaffCertificates) },
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
      { path: "staff", element: withSuspense(AdminStaffManagement) },
      { path: "users", element: withSuspense(AdminUserAccounts) },
      { path: "reports", element: withSuspense(AdminReports) },
      { path: "announcements", element: withSuspense(AdminAnnouncements) },
    ],
  },
]);
