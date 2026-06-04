import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router';
import {
  authenticateWithPassword,
  clearSupabaseAuthSession,
  clearStoredSession,
  createDefaultAdminSystemSettings,
  getMe,
  getSessionPolicy,
  getSupabaseAuthSession,
  getStoredSession,
  getUserByToken,
  hasServerPasswordSetupCompleted,
  markServerPasswordSetupCompleted,
  onSupabaseAuthStateChange,
  rejectUnauthorizedGoogleAccount,
  setStoredSession,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  syncSupabaseAuthSession,
  type SupabaseAuthUser,
  updateCurrentSessionPassword,
  updateUserPassword,
} from './api';
import { flushPendingStudentNotificationSaves } from './student-notification-save-queue';
import { STAFF_REVIEW_MUTATION_KEY } from './staff-clearance';
import { loadCreatePasswordPage } from '../route-modules';
import type { AuthMe, AuthSession, UserRole } from './api';

const GC_DOMAIN = 'gordoncollege.edu.ph';
const PASSWORD_SETUP_MARKER_KEY = 'gc_password_setup_accounts';
const PENDING_PASSWORD_SETUP_MARKER_KEY = 'gc_pending_password_setup_accounts';
const ACCOUNT_LOAD_ERROR_MESSAGE =
  'We could not load your account from the database. Please try signing in again.';
const ARCHIVED_ACCOUNT_MESSAGE =
  'This account is not available. Contact the administrator for assistance.';
const ELEVATED_TIMEOUT_ROLES: UserRole[] = ['admin', 'staff', 'super_admin'];
const ACTIVITY_THROTTLE_MS = 1000;

function isGCDomain(email?: string | null) {
  return !!email?.toLowerCase().endsWith(`@${GC_DOMAIN}`);
}

function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

function isArchivedAccountError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('archived') ||
    message.includes('administrator for assistance') ||
    message.includes('user is banned') ||
    message.includes('not available')
  );
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

function getPendingPasswordSetupMarkers() {
  if (typeof window === 'undefined') return new Set<string>();

  const raw = window.localStorage.getItem(PENDING_PASSWORD_SETUP_MARKER_KEY);
  if (!raw) return new Set<string>();

  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set((parsed || []).map((entry) => normalizeEmail(entry)).filter(Boolean));
  } catch {
    window.localStorage.removeItem(PENDING_PASSWORD_SETUP_MARKER_KEY);
    return new Set<string>();
  }
}

function hasPasswordSetupMarker(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getPasswordSetupMarkers().has(normalized);
}

function hasPendingPasswordSetupMarker(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getPendingPasswordSetupMarkers().has(normalized);
}

function markPasswordSetupComplete(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized || typeof window === 'undefined') return;

  const markers = getPasswordSetupMarkers();
  markers.add(normalized);
  window.localStorage.setItem(PASSWORD_SETUP_MARKER_KEY, JSON.stringify([...markers]));
}

function markPendingPasswordSetup(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized || typeof window === 'undefined') return;

  const markers = getPendingPasswordSetupMarkers();
  markers.add(normalized);
  window.localStorage.setItem(PENDING_PASSWORD_SETUP_MARKER_KEY, JSON.stringify([...markers]));
}

function clearPendingPasswordSetup(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized || typeof window === 'undefined') return;

  const markers = getPendingPasswordSetupMarkers();
  if (!markers.delete(normalized)) return;
  window.localStorage.setItem(PENDING_PASSWORD_SETUP_MARKER_KEY, JSON.stringify([...markers]));
}

function isGoogleAuthUser(user?: SupabaseAuthUser | null) {
  const providers = [
    user?.app_metadata?.provider,
    ...(Array.isArray(user?.identities) ? user.identities.map((identity) => identity?.provider) : []),
  ];
  return providers.some(
    (provider) => String(provider || '').trim().toLowerCase() === 'google',
  );
}

function hasPasswordIdentity(user?: SupabaseAuthUser | null) {
  return (user?.identities || []).some(
    (identity) => String(identity?.provider || '').trim().toLowerCase() === 'email',
  );
}

function getAppMetadataHasPassword(user?: SupabaseAuthUser | null) {
  const metadata = user?.app_metadata as Record<string, unknown> | null | undefined;
  const value = metadata?.has_password;
  return typeof value === 'boolean' ? value : null;
}

function canOptimisticallyRouteToPasswordSetup(user?: SupabaseAuthUser | null) {
  if (!isGoogleAuthUser(user)) {
    return false;
  }

  const appMetadataHasPassword = getAppMetadataHasPassword(user);
  if (appMetadataHasPassword === true) {
    return false;
  }

  if (hasPasswordIdentity(user)) {
    return false;
  }

  return true;
}

async function shouldRequireGooglePasswordSetup(
  authUser: SupabaseAuthUser,
  accessToken: string,
  profilePasswordSetupCompleted?: boolean | null,
) {
  if (!isGoogleAuthUser(authUser)) {
    return false;
  }

  const appMetadataHasPassword = getAppMetadataHasPassword(authUser);
  if (appMetadataHasPassword === true) {
    return false;
  }
  if (appMetadataHasPassword === false) {
    return true;
  }

  if (hasPasswordIdentity(authUser)) {
    return false;
  }

  if (profilePasswordSetupCompleted) {
    return false;
  }

  const hasServerPassword = await hasServerPasswordSetupCompleted(accessToken);
  return !hasServerPassword;
}

type PendingAuthRedirect = {
  email?: string | null;
  type?: string | null;
};

function getPendingAuthRedirectFromLocation(): PendingAuthRedirect | null {
  if (typeof window === 'undefined') return null;
  if (!window.location.hash.includes('access_token=')) return null;

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (!params.get('access_token')) return null;

  return {
    email: params.get('email'),
    type: params.get('type'),
  };
}

function clearSupabaseAuthHashFromUrl() {
  if (typeof window === 'undefined' || !window.location.hash) return;

  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(window.history.state, document.title, url.pathname + url.search);
}

function buildPath(pathname: string, searchParams?: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value) {
      params.set(key, value);
    }
  }

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function hasSupabaseAuthUserMetadata(user?: SupabaseAuthUser | null) {
  return Boolean(
    user?.id
      && (
        user.app_metadata
        || user.user_metadata
        || (Array.isArray(user.identities) && user.identities.length > 0)
      ),
  );
}

type AuthContextValue = {
  loading: boolean;
  authRedirectInProgress: boolean;
  session: AuthSession | null;
  me: AuthMe | null;
  role: UserRole | null;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<AuthMe>;
  signUp: (firstName: string, lastName: string, email: string, password: string) => Promise<{
    me: AuthMe | null;
    emailConfirmationRequired: boolean;
  }>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthMe | null>;
  requiresPasswordSetup: boolean;
  completePasswordSetup: (newPassword: string) => Promise<void>;
  completePasswordRecovery: (newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  pendingStaffClearanceCount: number;
};

export class LogoutBlockedError extends Error {
  constructor(message = 'A medical clearance is still processing in the background.') {
    super(message);
    this.name = 'LogoutBlockedError';
  }
}

const AUTH_CONTEXT_KEY = Symbol.for('gc.auth.context');
const authGlobal = globalThis as typeof globalThis & {
  [AUTH_CONTEXT_KEY]?: ReturnType<typeof createContext<AuthContextValue | null>>;
};
const AuthContext =
  authGlobal[AUTH_CONTEXT_KEY] ?? createContext<AuthContextValue | null>(null);

if (!authGlobal[AUTH_CONTEXT_KEY]) {
  authGlobal[AUTH_CONTEXT_KEY] = AuthContext;
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

  await updateUserPassword(newPassword, verifiedSession.access_token, {
    email,
    firstName: me?.profile?.first_name,
    lastName: me?.profile?.last_name,
    studentId: me?.profile?.student_id,
  });
  await markServerPasswordSetupCompleted(verifiedSession.access_token);
  markPasswordSetupComplete(email);
  clearPendingPasswordSetup(email);
  const resolvedMe = await getMe(verifiedSession.access_token);
  setMe(resolvedMe);
  setRole(resolvedMe.profile.role);
  setRequiresPasswordSetup(false);
}

type AppRouterLike = {
  navigate: (to: string, options?: { replace?: boolean }) => unknown;
};

export function AuthProvider({
  children,
  router,
}: {
  children: React.ReactNode;
  router: AppRouterLike;
}) {
  const pendingStaffClearanceCount = useIsMutating({
    mutationKey: STAFF_REVIEW_MUTATION_KEY,
  });
  const initialPendingAuthRedirect = getPendingAuthRedirectFromLocation();
  const initialSession =
    typeof window === 'undefined' ? null : getStoredSession();
  const [session, setSession] = useState<AuthSession | null>(() =>
    initialSession,
  );
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [me, setMe] = useState<AuthMe | null>(null);
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(() =>
    hasPendingPasswordSetupMarker(initialSession?.user?.email),
  );
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [authRedirectInProgress, setAuthRedirectInProgress] = useState(() => Boolean(initialPendingAuthRedirect));
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number | null>(null);
  const inactivityLogoutInFlightRef = useRef(false);
  const hydratedSupabaseSessionKeyRef = useRef<string | null>(null);
  const pendingAuthRedirectRef = useRef<PendingAuthRedirect | null>(initialPendingAuthRedirect);
  const handledAuthRedirectSessionKeyRef = useRef<string | null>(null);

  function resetAuthState(options?: { preserveAuthRedirectInProgress?: boolean }) {
    clearStoredSession();
    setSession(null);
    setMe(null);
    setRole(null);
    setRequiresPasswordSetup(false);
    setIsPasswordRecovery(false);
    if (!options?.preserveAuthRedirectInProgress) {
      setAuthRedirectInProgress(false);
    }
    setSessionTimeoutMinutes(null);
  }

  function toAccountLoadError(error: unknown) {
    if (isArchivedAccountError(error)) {
      return new Error(ARCHIVED_ACCOUNT_MESSAGE);
    }
    return new Error(ACCOUNT_LOAD_ERROR_MESSAGE);
  }

  useEffect(() => {
    if (!authRedirectInProgress) return;
    void loadCreatePasswordPage();
  }, [authRedirectInProgress]);

  useEffect(() => {
    if (!session?.access_token) {
      setMe(null);
      setRole(null);
      return;
    }

    if (isPasswordRecovery) {
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
          resetAuthState();
          return;
        }
        resetAuthState();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPasswordRecovery, requiresPasswordSetup, session]);

  useEffect(() => {
    if (!session?.access_token || !role || !ELEVATED_TIMEOUT_ROLES.includes(role)) {
      setSessionTimeoutMinutes(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const defaults = createDefaultAdminSystemSettings();
      try {
        const policy = await getSessionPolicy();
        if (!cancelled) {
          setSessionTimeoutMinutes(policy.sessionTimeoutMinutes || defaults.sessionTimeoutMinutes);
        }
      } catch {
        if (!cancelled) {
          setSessionTimeoutMinutes(defaults.sessionTimeoutMinutes);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role, session?.access_token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!session?.access_token || !role || !ELEVATED_TIMEOUT_ROLES.includes(role) || !sessionTimeoutMinutes) {
      return;
    }

    let timeoutId = 0;
    let lastTrackedActivityAt = 0;

    const timeoutMs = sessionTimeoutMinutes * 60 * 1000;

    const forceLogoutForInactivity = async () => {
      if (inactivityLogoutInFlightRef.current) return;
      inactivityLogoutInFlightRef.current = true;

      try {
        await signOut();
      } catch {
        // Best effort sign out; local session is cleared either way.
      } finally {
        clearStoredSession();
        setSession(null);
        setMe(null);
        setRole(null);
        setRequiresPasswordSetup(false);
        setSessionTimeoutMinutes(null);
        inactivityLogoutInFlightRef.current = false;
        window.location.replace('/auth?mode=signin&reason=idle_timeout');
      }
    };

    const scheduleLogout = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void forceLogoutForInactivity();
      }, timeoutMs);
    };

    const markActivity = () => {
      const now = Date.now();
      if (now - lastTrackedActivityAt < ACTIVITY_THROTTLE_MS) return;
      lastTrackedActivityAt = now;
      scheduleLogout();
    };

    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'mousemove', 'scroll', 'focus'];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, markActivity, { passive: true });
    }
    window.addEventListener('touchstart', markActivity, { passive: true });
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleLogout();

    return () => {
      window.clearTimeout(timeoutId);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, markActivity);
      }
      window.removeEventListener('touchstart', markActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [role, session?.access_token, sessionTimeoutMinutes]);

  useEffect(() => {
    if (!session?.access_token || !session.refresh_token) {
      hydratedSupabaseSessionKeyRef.current = null;
      return;
    }

    const sessionKey = `${session.access_token}:${session.refresh_token}`;
    if (hydratedSupabaseSessionKeyRef.current === sessionKey) {
      return;
    }
    hydratedSupabaseSessionKeyRef.current = sessionKey;

    let cancelled = false;
    (async () => {
      try {
        const syncedSession = await syncSupabaseAuthSession(session);
        if (!syncedSession || cancelled) return;

        const didSessionChange =
          syncedSession.access_token !== session.access_token
          || syncedSession.refresh_token !== session.refresh_token
          || syncedSession.expires_at !== session.expires_at
          || syncedSession.expires_in !== session.expires_in;

        if (didSessionChange) {
          setStoredSession(syncedSession);
          setSession((current) => {
            if (!current) return current;
            if (
              current.access_token !== session.access_token
              || current.refresh_token !== session.refresh_token
            ) {
              return current;
            }
            return syncedSession;
          });
        }
      } catch {
        hydratedSupabaseSessionKeyRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!pendingAuthRedirectRef.current) return;

    let cancelled = false;

    async function navigateAfterRedirect(path: string) {
      await Promise.resolve(router.navigate(path, { replace: true }));
      if (cancelled) return;
      pendingAuthRedirectRef.current = null;
      handledAuthRedirectSessionKeyRef.current = null;
      setAuthRedirectInProgress(false);
    }

    async function failAuthRedirect(path: string) {
      clearSupabaseAuthHashFromUrl();
      try {
        await clearSupabaseAuthSession();
      } catch {
        // Best effort cleanup for the in-memory Supabase session.
      }
      if (cancelled) return;
      resetAuthState({ preserveAuthRedirectInProgress: true });
      await navigateAfterRedirect(path);
    }

    async function settleGooglePasswordSetupState(
      nextSession: AuthSession,
      authUser: SupabaseAuthUser,
      email?: string,
      options?: { navigatedOptimistically?: boolean },
    ) {
      try {
        const resolvedMe = await getMe(nextSession.access_token);
        const requiresGooglePasswordSetup = await shouldRequireGooglePasswordSetup(
          authUser,
          nextSession.access_token,
          resolvedMe.profile.password_setup_completed,
        );

        if (cancelled) return;

        setMe(resolvedMe);
        setRole(requiresGooglePasswordSetup ? null : resolvedMe.profile.role);
        setRequiresPasswordSetup(requiresGooglePasswordSetup);
        setIsPasswordRecovery(false);

        if (requiresGooglePasswordSetup) {
          markPendingPasswordSetup(email);
          if (!options?.navigatedOptimistically) {
            await navigateAfterRedirect('/create-password');
          }
          return;
        }

        clearPendingPasswordSetup(email);
        if (options?.navigatedOptimistically) {
          await navigateAfterRedirect(getHomePath(resolvedMe.profile.role));
          return;
        }
        await navigateAfterRedirect(getHomePath(resolvedMe.profile.role));
      } catch (error) {
        if (isArchivedAccountError(error)) {
          await failAuthRedirect(buildPath('/auth', { mode: 'signin', google_error: 'archived_account' }));
          return;
        }
        await failAuthRedirect(buildPath('/auth', { mode: 'signin', google_error: 'account_load_failed' }));
      }
    }

    async function processAuthRedirect(nextSession: AuthSession, nextUser?: SupabaseAuthUser | null) {
      const pendingRedirect = pendingAuthRedirectRef.current;
      if (!pendingRedirect?.type && !nextSession.access_token) return;

      clearSupabaseAuthHashFromUrl();

      if (pendingRedirect?.type === 'signup') {
        try {
          await clearSupabaseAuthSession();
        } catch {
          // The verification success path can continue even if local sign-out fails.
        }
        if (cancelled) return;
        resetAuthState({ preserveAuthRedirectInProgress: true });
        await navigateAfterRedirect(buildPath('/auth', { mode: 'signin', verified: '1' }));
        return;
      }

      let resolvedAuthUser = nextUser;
      if (!resolvedAuthUser?.email || !hasSupabaseAuthUserMetadata(resolvedAuthUser)) {
        resolvedAuthUser = await getUserByToken(nextSession.access_token);
      }

      const email =
        resolvedAuthUser?.email || nextSession.user?.email || pendingRedirect?.email || undefined;

      if (!isGCDomain(email)) {
        try {
          await rejectUnauthorizedGoogleAccount(nextSession.access_token);
        } catch {
          // Best effort cleanup; the client still blocks access below.
        }
        await failAuthRedirect(buildPath('/auth', { mode: 'signin', google_error: 'invalid_domain' }));
        return;
      }

      if (pendingRedirect?.type === 'recovery') {
        setStoredSession(nextSession);
        setSession(nextSession);
        setMe(null);
        setRole(null);
        setRequiresPasswordSetup(false);
        setIsPasswordRecovery(true);
        await navigateAfterRedirect(buildPath('/auth', { mode: 'signin', recovery: '1' }));
        return;
      }

      setStoredSession(nextSession);
      setSession(nextSession);
      setIsPasswordRecovery(false);

      if (canOptimisticallyRouteToPasswordSetup(resolvedAuthUser)) {
        setMe(null);
        setRole(null);
        setRequiresPasswordSetup(true);
        setIsPasswordRecovery(false);
        markPendingPasswordSetup(email);
        await navigateAfterRedirect('/create-password');
        void settleGooglePasswordSetupState(nextSession, resolvedAuthUser as SupabaseAuthUser, email, {
          navigatedOptimistically: true,
        });
        return;
      }

      await settleGooglePasswordSetupState(nextSession, resolvedAuthUser as SupabaseAuthUser, email);
    }

    async function processSessionCandidate(nextSession: AuthSession | null, nextUser?: SupabaseAuthUser | null) {
      if (!pendingAuthRedirectRef.current) return;
      if (!nextSession?.access_token) return;

      const sessionKey = `${nextSession.access_token}:${nextSession.refresh_token || ''}`;
      if (handledAuthRedirectSessionKeyRef.current === sessionKey) {
        return;
      }
      handledAuthRedirectSessionKeyRef.current = sessionKey;
      await processAuthRedirect(nextSession, nextUser);
    }

    const {
      data: { subscription },
    } = onSupabaseAuthStateChange((event, nextSession, nextUser) => {
      if (!pendingAuthRedirectRef.current) return;
      if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN' && event !== 'PASSWORD_RECOVERY') {
        return;
      }
      void processSessionCandidate(nextSession, nextUser);
    });

    async function settlePendingRedirect() {
      const pendingRedirect = pendingAuthRedirectRef.current;
      if (!pendingRedirect) return;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const { session: nextSession, user: nextUser } = await getSupabaseAuthSession();
          if (nextSession?.access_token) {
            await processSessionCandidate(nextSession, nextUser);
            return;
          }
        } catch {
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 0 : 50));
      }

      if (!pendingAuthRedirectRef.current) return;

      if (pendingRedirect.type === 'signup') {
        clearSupabaseAuthHashFromUrl();
        resetAuthState({ preserveAuthRedirectInProgress: true });
        await navigateAfterRedirect(buildPath('/auth', { mode: 'signin', verified: '1' }));
        return;
      }

      await failAuthRedirect(buildPath('/auth', { mode: 'signin', google_error: 'invalid_token' }));
    }

    void settlePendingRedirect();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    authRedirectInProgress,
    session,
    me,
    role,
    isPasswordRecovery,
    signIn: async (email: string, password: string) => {
      setLoading(true);
      try {
        const nextSession = await signInWithPassword(email, password);
        clearPendingPasswordSetup(nextSession.user?.email || email);
        setSession(nextSession);
        setIsPasswordRecovery(false);
        try {
          const resolvedMe = await getMe(nextSession.access_token);
          setMe(resolvedMe);
          setRole(resolvedMe.profile.role);
          return resolvedMe;
        } catch (error) {
          resetAuthState();
          throw toAccountLoadError(error);
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
          setIsPasswordRecovery(false);
          return {
            me: null,
            emailConfirmationRequired,
          };
        }

        setSession(nextSession);
        setRequiresPasswordSetup(false);
        setIsPasswordRecovery(false);
        try {
          const resolvedMe = await getMe(nextSession.access_token);
          setMe(resolvedMe);
          setRole(resolvedMe.profile.role);
          return {
            me: resolvedMe,
            emailConfirmationRequired,
          };
        } catch (error) {
          resetAuthState();
          throw toAccountLoadError(error);
        }
      } finally {
        setLoading(false);
      }
    },
    logout: async () => {
      if (pendingStaffClearanceCount > 0 && me?.profile.role === 'staff') {
        throw new LogoutBlockedError(
          'Please wait for the background clearance process to finish before logging out.',
        );
      }

      setLoading(true);
      try {
        await flushPendingStudentNotificationSaves(me?.student?.student_id || me?.profile.student_id || undefined);
        await signOut();
      } finally {
        clearStoredSession();
        setSession(null);
        setMe(null);
        setRole(null);
        setRequiresPasswordSetup(false);
        setIsPasswordRecovery(false);
        setLoading(false);
      }
    },
    refresh: async () => {
      if (!session?.access_token) {
        setMe(null);
        setRole(null);
        setRequiresPasswordSetup(false);
        setIsPasswordRecovery(false);
        return null;
      }
      try {
        const refreshedMe = await getMe(session.access_token);
        setMe(refreshedMe);
        setRole(refreshedMe.profile.role);
        setIsPasswordRecovery(false);
        return refreshedMe;
      } catch (error) {
        if (isArchivedAccountError(error)) {
          resetAuthState();
          return null;
        }
        resetAuthState();
        return null;
      }
    },
    requiresPasswordSetup,
    completePasswordSetup: async (newPassword: string) => {
      if (!session?.access_token) {
        throw new Error('No active session found. Please sign in with Google again.');
      }
      await updateCurrentSessionPassword(newPassword, {
        email: session.user?.email || me?.profile?.email,
        firstName: me?.profile?.first_name,
        lastName: me?.profile?.last_name,
        studentId: me?.profile?.student_id,
      });
      await markServerPasswordSetupCompleted(session.access_token);
      const accountEmail = session.user?.email || me?.profile?.email || null;
      markPasswordSetupComplete(accountEmail);
      clearPendingPasswordSetup(accountEmail);
      const resolvedMe = await getMe(session.access_token);
      setMe(resolvedMe);
      setRole(resolvedMe.profile.role);
      setRequiresPasswordSetup(false);
      setIsPasswordRecovery(false);
    },
    completePasswordRecovery: async (newPassword: string) => {
      if (!session?.access_token) {
        throw new Error('Your reset link is no longer active. Request a new password reset email.');
      }
      await updateUserPassword(newPassword, session.access_token, {
        email: session.user?.email || me?.profile?.email,
        firstName: me?.profile?.first_name,
        lastName: me?.profile?.last_name,
        studentId: me?.profile?.student_id,
      });
      await markServerPasswordSetupCompleted(session.access_token);
      const accountEmail = session.user?.email || me?.profile?.email || null;
      markPasswordSetupComplete(accountEmail);
      clearPendingPasswordSetup(accountEmail);
      try {
        await signOut();
      } finally {
        clearStoredSession();
        setSession(null);
        setMe(null);
        setRole(null);
        setRequiresPasswordSetup(false);
        setIsPasswordRecovery(false);
        setSessionTimeoutMinutes(null);
      }
    },
    changePassword: async (currentPassword: string, newPassword: string) => {
      await applyPasswordChange(session, me, setSession, setMe, setRole, setRequiresPasswordSetup, currentPassword, newPassword);
      setIsPasswordRecovery(false);
    },
    pendingStaffClearanceCount,
  }), [authRedirectInProgress, isPasswordRecovery, loading, me, pendingStaffClearanceCount, requiresPasswordSetup, role, session]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {authRedirectInProgress ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#f8fbff]/95 backdrop-blur-sm">
          <div
            className="rounded-3xl border border-[#d9e5df] bg-white/94 px-6 py-5 text-center shadow-[0_24px_60px_rgba(11,28,48,0.12)]"
            role="status"
            aria-live="polite"
          >
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#d7e6de] border-t-[#065f46]" />
            <p className="mt-4 text-sm font-semibold text-[#0b1c30]">Signing you in securely...</p>
            <p className="mt-1 text-xs text-[#60717e]">Finalizing your ClinicKa session.</p>
          </div>
        </div>
      ) : null}
    </AuthContext.Provider>
  );
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
    case 'super_admin':
      return '/super-admin';
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
  const { role, requiresPasswordSetup, isPasswordRecovery, authRedirectInProgress } = useAuth();
  const location = useLocation();

  if (authRedirectInProgress) {
    return null;
  }

  if (requiresPasswordSetup && !isPasswordRecovery) {
    return <Navigate to="/create-password" replace />;
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
  const { role, requiresPasswordSetup, isPasswordRecovery, authRedirectInProgress } = useAuth();

  if (authRedirectInProgress) {
    return <>{children}</>;
  }

  if (requiresPasswordSetup && !isPasswordRecovery) {
    return <Navigate to="/create-password" replace />;
  }

  if (role && !requiresPasswordSetup && !isPasswordRecovery) {
    return <Navigate to={getHomePath(role)} replace />;
  }

  return <>{children}</>;
}
