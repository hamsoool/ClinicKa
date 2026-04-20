import { createBrowserRouter } from "react-router";
import RoleSelection from "./pages/role-selection";
import StudentDashboard from "./pages/student/dashboard";
import StudentYearSelection from "./pages/student/year-selection";
import StudentMedicalForm from "./pages/student/medical-form";
import StudentLayout from "./pages/student/layout";
import StudentRecords from "./pages/student/records";
import StudentRequirements from "./pages/student/requirements";
import StudentProfile from "./pages/student/profile";
import StudentCertificate from "./pages/student/certificate";
import StaffLayout from "./pages/staff/layout";
import StaffDashboard from "./pages/staff/dashboard";
import StaffSubmissions from "./pages/staff/submissions";
import StaffRecordReview from "./pages/staff/record-review";
import StaffRecords from "./pages/staff/records";
import StaffReports from "./pages/staff/reports";
import StaffCertificates from "./pages/staff/certificates";
import StaffSettings from "./pages/staff/settings";
import AdminLayout from "./pages/admin/layout";
import AdminDashboard from "./pages/admin/dashboard";
import AdminSystemSettings from "./pages/admin/system-settings";
import AdminStaffManagement from "./pages/admin/staff-management";
import AdminUserAccounts from "./pages/admin/user-accounts";
import AdminReports from "./pages/admin/reports";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RoleSelection />,
  },
  {
    path: "/student",
    element: <StudentLayout />,
    children: [
      { index: true, Component: StudentDashboard },
      { path: "records", Component: StudentRecords },
      { path: "year-selection", Component: StudentYearSelection },
      { path: "medical-form/:year", Component: StudentMedicalForm },
      { path: "requirements", Component: StudentRequirements },
      { path: "profile", Component: StudentProfile },
      { path: "certificate", Component: StudentCertificate },
    ],
  },
  {
    path: "/staff",
    element: <StaffLayout />,
    children: [
      { index: true, Component: StaffDashboard },
      { path: "submissions", Component: StaffSubmissions },
      { path: "records", Component: StaffRecords },
      { path: "review/:submissionId", Component: StaffRecordReview },
      { path: "reports", Component: StaffReports },
      { path: "certificates", Component: StaffCertificates },
      { path: "settings", Component: StaffSettings },
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "settings", Component: AdminSystemSettings },
      { path: "staff", Component: AdminStaffManagement },
      { path: "users", Component: AdminUserAccounts },
      { path: "reports", Component: AdminReports },
    ],
  },
]);
