import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { AuthMe, AuthSession, UserRole } from './api';
import { getMockStudentById } from './mock-data';

type AuthContextValue = {
  loading: boolean;
  session: AuthSession | null;
  me: AuthMe | null;
  role: UserRole | null;
  signIn: (email: string, password: string) => Promise<AuthMe>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthMe | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const previewStudent = getMockStudentById('202310417');

const PREVIEW_USERS: Record<UserRole, AuthMe> = {
  student: {
    profile: {
      id: 'preview-student',
      role: 'student',
      email: previewStudent?.email || '202310417@gordoncollege.edu.ph',
      student_id: previewStudent?.student_id || '202310417',
      first_name: previewStudent?.first_name || 'Demo',
      last_name: previewStudent?.last_name || 'Student',
      department: previewStudent?.department || 'CCS',
      course: previewStudent?.course || 'BS Computer Science',
    },
    student: {
      student_id: previewStudent?.student_id || '202310417',
      first_name: previewStudent?.first_name || 'Demo',
      last_name: previewStudent?.last_name || 'Student',
      middle_initial: previewStudent?.middle_initial || 'A',
      department: previewStudent?.department || 'CCS',
      course: previewStudent?.course || 'BS Computer Science',
      year_level: previewStudent?.year_level || 3,
      age: previewStudent?.age || 20,
      sex: previewStudent?.sex || 'male',
      birthday: previewStudent?.birthday || '2005-01-15',
      civil_status: previewStudent?.civil_status || 'Single',
      contact_number: previewStudent?.contact_number || '09123456789',
      address: previewStudent?.address || 'Olongapo City',
    },
    staff: null,
  },
  staff: {
    profile: {
      id: 'preview-staff',
      role: 'staff',
      email: 'clinic.staff@gordoncollege.edu.ph',
      first_name: 'Clinic',
      last_name: 'Staff',
      department: 'Health Services',
      course: null,
    },
    student: null,
    staff: {
      id: 'staff-demo-001',
      first_name: 'Clinic',
      last_name: 'Staff',
      middle_initial: 'B',
      position: 'Clinic Staff',
      phone: '09170000001',
      is_active: true,
    },
  },
  admin: {
    profile: {
      id: 'preview-admin',
      role: 'admin',
      email: 'clinic.admin@gordoncollege.edu.ph',
      first_name: 'Clinic',
      last_name: 'Admin',
      department: 'Health Services',
      course: null,
    },
    student: null,
    staff: {
      id: 'staff-demo-002',
      first_name: 'Clinic',
      last_name: 'Admin',
      middle_initial: 'C',
      position: 'Administrator',
      phone: '09170000002',
      is_active: true,
    },
  },
};

function cloneMe(role: UserRole): AuthMe {
  return structuredClone(PREVIEW_USERS[role]);
}

function getRoleFromPath(pathname: string): UserRole | null {
  if (pathname.startsWith('/student')) return 'student';
  if (pathname.startsWith('/staff')) return 'staff';
  if (pathname.startsWith('/admin')) return 'admin';
  return null;
}

function notifyLocationChange() {
  window.dispatchEvent(new Event('locationchange'));
}

function installLocationChangeEvents() {
  if (typeof window === 'undefined') return;
  const historyWithPatch = window.history as History & { __previewPatched?: boolean };
  if (historyWithPatch.__previewPatched) return;

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    notifyLocationChange();
    return result;
  };

  window.history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    notifyLocationChange();
    return result;
  };

  window.addEventListener('popstate', notifyLocationChange);
  historyWithPatch.__previewPatched = true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(() =>
    typeof window === 'undefined' ? null : getRoleFromPath(window.location.pathname),
  );

  useEffect(() => {
    installLocationChangeEvents();
    const updateRole = () => setRole(getRoleFromPath(window.location.pathname));
    window.addEventListener('locationchange', updateRole);
    updateRole();
    return () => window.removeEventListener('locationchange', updateRole);
  }, []);

  const me = role ? cloneMe(role) : null;

  const value = useMemo<AuthContextValue>(() => ({
    loading: false,
    session: role ? { access_token: `preview-${role}` } : null,
    me,
    role,
    signIn: async (email: string) => {
      const normalized = email.toLowerCase();
      if (normalized.includes('admin')) return cloneMe('admin');
      if (normalized.includes('staff')) return cloneMe('staff');
      return cloneMe('student');
    },
    logout: async () => {
      return;
    },
    refresh: async () => me,
  }), [me, role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

function getHomePath(role: UserRole | null) {
  switch (role) {
    case 'staff':
      return '/staff';
    case 'admin':
      return '/admin';
    case 'student':
    default:
      return '/student';
  }
}

export function RequireAuth({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (!role) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getHomePath(role)} replace />;
  }

  return <>{children}</>;
}

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { loading, role } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (role) {
    return <Navigate to={getHomePath(role)} replace />;
  }

  return <>{children}</>;
}
