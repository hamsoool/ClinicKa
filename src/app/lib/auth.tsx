import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { authenticateWithPassword, clearStoredSession, getMe, getStoredSession, getUserByToken, hasServerPasswordSetupCompleted, markServerPasswordSetupCompleted, rejectUnauthorizedGoogleAccount, setStoredSession, signInWithPassword, signOut, signUpWithPassword, updateUserPassword } from './api';
import type { AuthMe, AuthSession, UserRole } from './api';

const GC_DOMAIN = 'gordoncollege.edu.ph';
const PASSWORD_SETUP_MARKER_KEY = 'gc_password_setup_accounts';

function isGCDomain(email?: string | null) {
  return !!email?.toLowerCase().endsWith(`@${GC_DOMAIN}`);
}

function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

function deriveStudentIdFromEmail(email?: string | null) {
  const localPart = normalizeEmail(email).split('@')[0] || '';
  const match = localPart.match(/^(\d{9})/);
  return match?.[1] || null;
}

function isArchivedAccountError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('archived') || message.includes('administrator for assistance');
}

function getPasswordSetupMarkers() {
  if (typeof window === 'undefined') return new Set<string>();

  const raw = window.localStorage.getItem(PASSWORD_SETUP_MARKER_KEY);
  if (!raw) return new Set<string>();

  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set((parsed || []).map((entry) => normalizeEmail(entry)).filter(Boolean));
  } catch {
    window.localStorage.removeItem(PASSWORD_SETUP_MARKER_KEY);
    return new Set<string>();
  }
}

function hasPasswordSetupMarker(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getPasswordSetupMarkers().has(normalized);
}

function markPasswordSetupComplete(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized || typeof window === 'undefined') return;

  const markers = getPasswordSetupMarkers();
  markers.add(normalized);
  window.localStorage.setItem(PASSWORD_SETUP_MARKER_KEY, JSON.stringify([...markers]));
}

type AuthContextValue = {
  loading: boolean;
  session: AuthSession | null;
  me: AuthMe | null;
  role: UserRole | null;
  signIn: (email: string, password: string) => Promise<AuthMe>;
  signUp: (firstName: string, lastName: string, email: string, password: string) => Promise<{
    me: AuthMe | null;
    emailConfirmationRequired: boolean;
  }>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthMe | null>;
  requiresPasswordSetup: boolean;
  completePasswordSetup: (newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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
  const derivedStudentId = deriveStudentIdFromEmail(email);

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

function resolveRoleFromEmail(email?: string | null): UserRole {
  const normalized = (email || '').toLowerCase();
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('staff')) return 'staff';
  return 'student';
}

async function applyPasswordChange(
  session: AuthSession | null,
  me: AuthMe | null,
  setSession: (value: AuthSession | null) => void,
  setMe: (value: AuthMe | null) => void,
  setRole: (value: UserRole | null) => void,
  setRequiresPasswordSetup: (value: boolean) => void,
  currentPassword: string,
  newPassword: string,
) {
  const email = session?.user?.email || me?.profile?.email || null;
  if (!session?.access_token || !email) {
    throw new Error('No active session found. Please sign in again.');
  }

  const verifiedSession = await authenticateWithPassword(email, currentPassword);
  setStoredSession(verifiedSession);
  setSession(verifiedSession);

  await updateUserPassword(newPassword, verifiedSession.access_token);
  await markServerPasswordSetupCompleted(verifiedSession.access_token);
  markPasswordSetupComplete(email);
  const resolvedMe = await getMe(verifiedSession.access_token);
  setMe(resolvedMe);
  setRole(resolvedMe.profile.role);
  setRequiresPasswordSetup(false);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    typeof window === 'undefined' ? null : getStoredSession(),
  );
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [me, setMe] = useState<AuthMe | null>(null);
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);

  useEffect(() => {
    if (!session?.access_token) {
      setMe(null);
      setRole(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const resolvedMe = await getMe(session.access_token);
        if (cancelled) return;
        setMe(resolvedMe);
        if (!requiresPasswordSetup) {
          setRole(resolvedMe.profile.role);
        }
      } catch (error) {
        if (cancelled) return;
        if (isArchivedAccountError(error)) {
          clearStoredSession();
          setSession(null);
          setMe(null);
          setRole(null);
          setRequiresPasswordSetup(false);
          return;
        }
        const fallbackRole = resolveRoleFromEmail(session.user?.email);
        setMe(buildMeFromSession(fallbackRole, session));
        if (!requiresPasswordSetup) {
          setRole(fallbackRole);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requiresPasswordSetup, session]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.includes('access_token=')) return;

    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const authType = params.get('type');

    if (!accessToken) return;
    const redirectAccessToken = accessToken;

    async function processAuthRedirect() {
      if (authType === 'signup') {
        const url = new URL(window.location.href);
        url.hash = '';
        url.searchParams.set('mode', 'signin');
        url.searchParams.set('verified', '1');
        window.history.replaceState({}, document.title, url.pathname + url.search);
        return;
      }

      try {
        const authUser = await getUserByToken(redirectAccessToken);
        const email = authUser.email || params.get('email') || undefined;

        if (!isGCDomain(email)) {
          try {
            await rejectUnauthorizedGoogleAccount(redirectAccessToken);
          } catch {
            // Best effort cleanup; the client still blocks access below.
          }
          clearStoredSession();
          setSession(null);
          setMe(null);
          setRole(null);
          setRequiresPasswordSetup(false);
          const url = new URL(window.location.href);
          url.hash = '';
          url.searchParams.set('mode', 'signin');
          url.searchParams.set('google_error', 'invalid_domain');
          window.history.replaceState({}, document.title, url.pathname + url.search);
          return;
        }

        const nextSession: AuthSession = {
          access_token: redirectAccessToken,
          refresh_token: params.get('refresh_token') || undefined,
          token_type: params.get('token_type') || undefined,
          expires_in: params.get('expires_in') ? Number(params.get('expires_in')) : undefined,
          expires_at: params.get('expires_at') ? Number(params.get('expires_at')) : undefined,
          user: {
            id: authUser.id || params.get('user_id') || 'verified-user',
            email: email || undefined,
          },
        };

        const hasPasswordIdentity = (authUser.identities || []).some(
          (identity) => identity.provider === 'email',
        );
        const hasServerPassword = await hasServerPasswordSetupCompleted(redirectAccessToken);
        const hasExistingPassword =
          hasPasswordIdentity || hasServerPassword || hasPasswordSetupMarker(email);

        setStoredSession(nextSession);
        setSession(nextSession);
        setRequiresPasswordSetup(!hasExistingPassword);
        try {
          const resolvedMe = await getMe(redirectAccessToken);
          setMe(resolvedMe);
          setRole(hasExistingPassword ? resolvedMe.profile.role : null);
        } catch (error) {
          if (isArchivedAccountError(error)) {
            clearStoredSession();
            setSession(null);
            setMe(null);
            setRole(null);
            setRequiresPasswordSetup(false);
            const url = new URL(window.location.href);
            url.hash = '';
            url.searchParams.set('mode', 'signin');
            url.searchParams.set('google_error', 'archived_account');
            window.history.replaceState({}, document.title, url.pathname + url.search);
            return;
          }
          const fallbackRole = resolveRoleFromEmail(email);
          setMe(buildMeFromSession(fallbackRole, nextSession));
          setRole(hasExistingPassword ? fallbackRole : null);
        }
        const url = new URL(window.location.href);
        url.hash = '';
        if (!hasExistingPassword) {
          url.searchParams.set('mode', 'signin');
          url.searchParams.set('password_setup', '1');
        }
        window.history.replaceState({}, document.title, url.pathname + url.search);
      } catch {
        clearStoredSession();
        setSession(null);
        setMe(null);
        setRole(null);
        setRequiresPasswordSetup(false);
        const url = new URL(window.location.href);
        url.hash = '';
        url.searchParams.set('mode', 'signin');
        url.searchParams.set('google_error', 'invalid_token');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    }

    void processAuthRedirect();
  }, []);

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
        try {
          const resolvedMe = await getMe(nextSession.access_token);
          setMe(resolvedMe);
          setRole(resolvedMe.profile.role);
          return resolvedMe;
        } catch (error) {
          if (isArchivedAccountError(error)) {
            clearStoredSession();
            setSession(null);
            setMe(null);
            setRole(null);
            throw error;
          }
          const fallbackRole = resolveRoleFromEmail(email);
          const fallbackMe = buildMeFromSession(fallbackRole, nextSession);
          setMe(fallbackMe);
          setRole(fallbackRole);
          return fallbackMe;
        }
      } finally {
        setLoading(false);
      }
    },
    signUp: async (firstName: string, lastName: string, email: string, password: string) => {
      setLoading(true);
      try {
        const { session: nextSession, emailConfirmationRequired } = await signUpWithPassword(
          firstName,
          lastName,
          email,
          password,
        );

        if (!nextSession) {
          setSession(null);
          setMe(null);
          setRole(null);
          setRequiresPasswordSetup(false);
          return {
            me: null,
            emailConfirmationRequired,
          };
        }

        setSession(nextSession);
        setRequiresPasswordSetup(false);
        try {
          const resolvedMe = await getMe(nextSession.access_token);
          setMe(resolvedMe);
          setRole(resolvedMe.profile.role);
          return {
            me: resolvedMe,
            emailConfirmationRequired,
          };
        } catch {
          const fallbackRole = resolveRoleFromEmail(email);
          const fallbackMe = buildMeFromSession(fallbackRole, nextSession);
          setMe(fallbackMe);
          setRole(fallbackRole);
          return {
            me: fallbackMe,
            emailConfirmationRequired,
          };
        }
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
        setMe(null);
        setRole(null);
        setRequiresPasswordSetup(false);
        setLoading(false);
      }
    },
    refresh: async () => {
      if (!session?.access_token) {
        setMe(null);
        setRole(null);
        setRequiresPasswordSetup(false);
        return null;
      }
      try {
        const refreshedMe = await getMe(session.access_token);
        setMe(refreshedMe);
        setRole(refreshedMe.profile.role);
        return refreshedMe;
      } catch (error) {
        if (isArchivedAccountError(error)) {
          clearStoredSession();
          setSession(null);
          setMe(null);
          setRole(null);
          setRequiresPasswordSetup(false);
          return null;
        }
        const fallbackRole = resolveRoleFromEmail(session.user?.email);
        const fallbackMe = buildMeFromSession(fallbackRole, session);
        setMe(fallbackMe);
        setRole(fallbackRole);
        return fallbackMe;
      }
    },
    requiresPasswordSetup,
    completePasswordSetup: async (newPassword: string) => {
      if (!session?.access_token) {
        throw new Error('No active session found. Please sign in with Google again.');
      }
      await updateUserPassword(newPassword, session.access_token);
      await markServerPasswordSetupCompleted(session.access_token);
      markPasswordSetupComplete(session.user?.email || me?.profile?.email || null);
      const resolvedMe = await getMe(session.access_token);
      setMe(resolvedMe);
      setRole(resolvedMe.profile.role);
      setRequiresPasswordSetup(false);
    },
    changePassword: async (currentPassword: string, newPassword: string) => {
      await applyPasswordChange(session, me, setSession, setMe, setRole, setRequiresPasswordSetup, currentPassword, newPassword);
    },
  }), [loading, me, requiresPasswordSetup, role, session]);

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
  const { role, requiresPasswordSetup } = useAuth();

  if (role && !requiresPasswordSetup) {
    return <Navigate to={getHomePath(role)} replace />;
  }

  return <>{children}</>;
}
