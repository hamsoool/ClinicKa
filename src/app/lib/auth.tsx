import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { clearStoredSession, getStoredSession, setStoredSession, signInWithPassword, signOut, signUpWithPassword } from './api';
import type { AuthMe, AuthSession, UserRole } from './api';

type AuthContextValue = {
  loading: boolean;
  session: AuthSession | null;
  me: AuthMe | null;
  role: UserRole | null;
  signIn: (email: string, password: string) => Promise<AuthMe>;
  signUp: (fullName: string, email: string, password: string) => Promise<{
    me: AuthMe | null;
    emailConfirmationRequired: boolean;
  }>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthMe | null>;
};

const AUTH_CONTEXT_KEY = Symbol.for('gc.auth.context');
const authGlobal = globalThis as typeof globalThis & {
  [AUTH_CONTEXT_KEY]?: ReturnType<typeof createContext<AuthContextValue | null>>;
};
const AuthContext =
  authGlobal[AUTH_CONTEXT_KEY] ?? createContext<AuthContextValue | null>(null);

if (!authGlobal[AUTH_CONTEXT_KEY]) {
  authGlobal[AUTH_CONTEXT_KEY] = AuthContext;
}

function buildMeFromSession(role: UserRole, session: AuthSession | null): AuthMe {
  const email = session?.user?.email || null;
  const emailUser = email?.split('@')[0] || '';
  const derivedStudentId = /^[0-9]{9}$/.test(emailUser) ? emailUser : null;

  return {
    profile: {
      id: session?.user?.id || 'unknown-user',
      role,
      email,
      student_id: role === 'student' ? derivedStudentId : null,
      first_name: null,
      last_name: null,
      department: null,
      course: null,
    },
    student: null,
    staff: null,
  };
}

function getRoleFromSession(session: AuthSession | null): UserRole | null {
  if (!session) return null;
  return resolveRoleFromEmail(session.user?.email);
}

function resolveRoleFromEmail(email?: string | null): UserRole {
  const normalized = (email || '').toLowerCase();
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('staff')) return 'staff';
  return 'student';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    typeof window === 'undefined' ? null : getStoredSession(),
  );
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<UserRole | null>(() => getRoleFromSession(getStoredSession()));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.includes('access_token=')) return;

    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const authType = params.get('type');

    if (!accessToken) return;

    if (authType === 'signup') {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'signin');
      url.searchParams.set('verified', '1');
      window.history.replaceState({}, document.title, url.pathname + url.search);
      return;
    }

    const nextSession: AuthSession = {
      access_token: accessToken,
      refresh_token: params.get('refresh_token') || undefined,
      token_type: params.get('token_type') || undefined,
      expires_in: params.get('expires_in') ? Number(params.get('expires_in')) : undefined,
      user: {
        id: params.get('user_id') || 'verified-user',
        email: params.get('email') || undefined,
      },
    };

    setStoredSession(nextSession);
    setSession(nextSession);
    setRole(getRoleFromSession(nextSession));
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    setRole(getRoleFromSession(session));
  }, [session]);

  const me = role ? buildMeFromSession(role, session) : null;

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    session,
    me,
    role,
    signIn: async (email: string, password: string) => {
      setLoading(true);
      try {
        const nextSession = await signInWithPassword(email, password);
        setSession(nextSession);
        const signedInRole = getRoleFromSession(nextSession) ?? resolveRoleFromEmail(email);
        setRole(signedInRole);
        return buildMeFromSession(signedInRole, nextSession);
      } finally {
        setLoading(false);
      }
    },
    signUp: async (fullName: string, email: string, password: string) => {
      setLoading(true);
      try {
        const { session: nextSession, emailConfirmationRequired } = await signUpWithPassword(
          fullName,
          email,
          password,
        );

        if (!nextSession) {
          setSession(null);
          setRole(null);
          return {
            me: null,
            emailConfirmationRequired,
          };
        }

        setSession(nextSession);
        const signedInRole = getRoleFromSession(nextSession) ?? resolveRoleFromEmail(email);
        setRole(signedInRole);
        return {
          me: buildMeFromSession(signedInRole, nextSession),
          emailConfirmationRequired,
        };
      } finally {
        setLoading(false);
      }
    },
    logout: async () => {
      setLoading(true);
      try {
        await signOut();
      } finally {
        clearStoredSession();
        setSession(null);
        setRole(null);
        setLoading(false);
      }
    },
    refresh: async () => (role ? buildMeFromSession(role, session) : null),
  }), [loading, me, role, session]);

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
  const { role } = useAuth();
  const location = useLocation();

  if (!role) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getHomePath(role)} replace />;
  }

  return <>{children}</>;
}

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();

  if (role) {
    return <Navigate to={getHomePath(role)} replace />;
  }

  return <>{children}</>;
}
