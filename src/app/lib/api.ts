
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const publicAnonKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
).trim();
const configuredSiteUrl = String(import.meta.env.VITE_SITE_URL || '')
  .trim()
  .replace(/\/+$/, '');

const GC_DOMAIN = 'gordoncollege.edu.ph';
export const AUTH_STORAGE_KEY = 'gc_supabase_session';
export const PASSWORD_RESET_COOLDOWN_SECONDS = 300;
const STORAGE_BUCKET = 'medical-files';
const PASSWORD_RESET_COOLDOWN_KEY_PREFIX = 'lastPasswordResetEmailSent_';
const STORAGE_BUCKET_BY_FILE_TYPE: Record<string, string> = {
  photo: 'profile',
  signature: 'student_signature',
  xray: 'lab_chest_xray',
  cbc: 'lab_cbc',
  urinalysis: 'lab_urinalysis',
};
let authClient: SupabaseClient | null = null;

function getAuthClient() {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error(
      'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in your .env file.',
    );
  }

  if (!authClient) {
    authClient = createClient(supabaseUrl, publicAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return authClient;
}

function inferBucketFromStoragePath(storagePath?: string | null) {
  const path = String(storagePath || '').replace(/^\/+/, '');
  if (!path) return null;
  const first = path.split('/')[0]?.trim();
  if (!first) return null;
  const known = new Set([STORAGE_BUCKET, ...Object.values(STORAGE_BUCKET_BY_FILE_TYPE)]);
  return known.has(first) ? first : null;
}

function inferBucketFromType(fileType?: string | null) {
  const key = String(fileType || '').trim().toLowerCase();
  return STORAGE_BUCKET_BY_FILE_TYPE[key] || null;
}

function inferBucketFromNameOrPath(fileName?: string | null, storagePath?: string | null) {
  const haystack = `${String(fileName || '').toLowerCase()} ${String(storagePath || '').toLowerCase()}`;
  if (haystack.includes('xray_') || haystack.includes('chest_xray')) return 'lab_chest_xray';
  if (haystack.includes('cbc_')) return 'lab_cbc';
  if (haystack.includes('urinalysis_') || haystack.includes('ua_')) return 'lab_urinalysis';
  if (haystack.includes('signature_')) return 'student_signature';
  if (haystack.includes('photo_') || haystack.includes('profile_')) return 'profile';
  return null;
}

function buildStorageObjectName(fileType: string, file?: File | null) {
  const normalizedType = String(fileType || 'file')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'file';

  const mime = String(file?.type || '').toLowerCase();
  const originalName = String(file?.name || '');
  const originalExt = originalName.includes('.') ? originalName.split('.').pop() || '' : '';

  let ext = '';
  if (mime.includes('png')) ext = 'png';
  else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
  else if (mime.includes('webp')) ext = 'webp';
  else if (mime.includes('gif')) ext = 'gif';
  else if (mime.includes('pdf')) ext = 'pdf';
  else if (originalExt) ext = originalExt.toLowerCase().replace(/[^a-z0-9]/g, '');

  const timestamp = Date.now();
  return ext ? `${normalizedType}_${timestamp}.${ext}` : `${normalizedType}_${timestamp}`;
}

async function createSignedStorageUrlWithBucketFallbacks(
  storagePath?: string | null,
  token?: string | null,
  explicitBucket?: string | null,
  fileType?: string | null,
) {
  const buckets = [
    explicitBucket || null,
    inferBucketFromStoragePath(storagePath),
    inferBucketFromType(fileType),
    STORAGE_BUCKET,
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  const seen = new Set<string>();
  for (const bucketName of buckets) {
    if (seen.has(bucketName)) continue;
    seen.add(bucketName);
    const signed = await createSignedStorageUrl(storagePath, token, bucketName);
    if (signed && !signed.includes('"Bucket not found"')) return signed;
  }
  return null;
}

export type UserRole = 'student' | 'staff' | 'admin';

export type AuthSession = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: {
    id: string;
    email?: string;
  };
};

type SupabaseAuthUser = {
  id: string;
  email?: string;
  identities?: Array<{ id?: string; provider?: string }>;
  user_metadata?: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
  } | null;
};

export type AuthMe = {
  profile: {
    id: string;
    role: UserRole;
    email?: string | null;
    password_setup_completed?: boolean | null;
    student_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    department?: string | null;
    course?: string | null;
  };
  student?: {
    student_id: string;
    profile_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    middle_initial?: string | null;
    department?: string | null;
    course?: string | null;
    year_level?: number | null;
    age?: number | null;
    sex?: string | null;
    birthday?: string | null;
    civil_status?: string | null;
    contact_number?: string | null;
    address?: string | null;
  } | null;
  staff?: {
    id: string;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    middle_initial?: string | null;
    position?: string | null;
    phone?: string | null;
    is_active?: boolean | null;
  } | null;
};

export type StudentProfileAssets = {
  photoUrl: string | null;
  signatureUrl: string | null;
  photoFileName?: string | null;
  signatureFileName?: string | null;
};

export type StudentNotificationStatePayload = {
  items?: unknown[];
  snapshot?: Record<string, string>;
};

export type StudentProfileUpdateInput = {
  studentId?: string | null;
  firstName: string;
  lastName: string;
  middleInitial: string;
  department: string;
  course: string;
  age: string;
  sex: string;
  birthday: string;
  civilStatus: string;
  contactNumber: string;
  address: string;
};

export type StaffProfileUpdateInput = {
  name: string;
  email: string;
  position: string;
  phone: string;
  applyAcrossRoles?: boolean;
};

export type AdminUserAccount = {
  userId: string;
  id: string;
  name: string;
  email?: string;
  role: string;
  roleKey: UserRole;
  status: string;
  lastActive?: string;
  canArchive?: boolean;
};

export type ArchivedUserAccount = {
  archiveId: string;
  userId: string;
  id: string;
  name: string;
  email?: string;
  role: string;
  roleKey: UserRole;
  status: 'Archived';
  archivedAt: string;
  archivedReason?: string;
};

type RequestOptions = {
  method?: string;
  token?: string | null;
  headers?: Record<string, string>;
  body?: BodyInit | null;
};

function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

function normalizeNamePart(value?: string | null) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function deriveNamePartsFromUser(user?: SupabaseAuthUser | null) {
  const firstName = normalizeNamePart(user?.user_metadata?.first_name);
  const lastName = normalizeNamePart(user?.user_metadata?.last_name);

  if (firstName || lastName) {
    return { firstName, lastName };
  }

  const fullName = normalizeNamePart(user?.user_metadata?.full_name);
  if (!fullName) {
    return { firstName: null, lastName: null };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(' ').trim() || null,
  };
}

function getSiteOrigin() {
  if (configuredSiteUrl) {
    try {
      return new URL(configuredSiteUrl).origin;
    } catch {
      return configuredSiteUrl;
    }
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

function buildAuthRedirectUrl(path: string) {
  const origin = getSiteOrigin();
  if (!origin) return undefined;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}

function getPasswordResetCooldownStorageKey(normalizedEmail: string) {
  return `${PASSWORD_RESET_COOLDOWN_KEY_PREFIX}${normalizedEmail}`;
}

export function getPasswordResetCooldownRemaining(email: string) {
  if (typeof window === 'undefined') return 0;

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return 0;

  const storageKey = getPasswordResetCooldownStorageKey(normalizedEmail);
  const rawLastSent = window.localStorage.getItem(storageKey);
  if (!rawLastSent) return 0;

  const lastSent = Number.parseInt(rawLastSent, 10);
  if (!Number.isFinite(lastSent) || lastSent <= 0) {
    window.localStorage.removeItem(storageKey);
    return 0;
  }

  const elapsedSeconds = Math.floor((Date.now() - lastSent) / 1000);
  const remaining = PASSWORD_RESET_COOLDOWN_SECONDS - elapsedSeconds;
  if (remaining <= 0) {
    window.localStorage.removeItem(storageKey);
    return 0;
  }

  return remaining;
}

function isGCDomainEmail(email?: string | null) {
  return normalizeEmail(email).endsWith(`@${GC_DOMAIN}`);
}

function resolveRoleFromEmail(email?: string | null): UserRole {
  const normalized = normalizeEmail(email);
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('staff')) return 'staff';
  return 'student';
}

export function isDoctorPosition(position?: string | null) {
  if (!position) return false;
  return ['clinic doctor', 'doctor'].includes(position.trim().toLowerCase());
}

export function getRoleLabel(role?: string | null, position?: string | null) {
  if (role === 'admin') return 'Administrator';
  if (role === 'staff') {
    if (isDoctorPosition(position)) return 'Clinic Doctor';
    return 'Clinic Staff';
  }
  return 'Student';
}

function deriveStudentIdFromEmail(email?: string | null) {
  const localPart = normalizeEmail(email).split('@')[0] || '';
  const match = localPart.match(/^(\d{9})/);
  return match?.[1] || null;
}

function isValidStudentRegistrationEmail(email?: string | null) {
  return Boolean(isGCDomainEmail(email) && deriveStudentIdFromEmail(email));
}

const TOKEN_REFRESH_BUFFER_SECONDS = 60;
const ME_CACHE_TTL_MS = 15_000;
const SIGNED_URL_CACHE_TTL_MS = 5 * 60 * 1000;
const STORAGE_FALLBACK_MAX_SUBMISSIONS = 12;
const PROFILE_ASSET_FALLBACK_MAX_STUDENTS = 20;

type TimedValue<T> = {
  value: T;
  expiresAt: number;
};

const _meCache = new Map<string, TimedValue<AuthMe>>();
const _mePromiseCache = new Map<string, Promise<AuthMe>>();
const _signedUrlCache = new Map<string, TimedValue<string>>();
const _signedUrlPromiseCache = new Map<string, Promise<string | null>>();

function getMeCacheKey(token?: string | null) {
  return `me:${token || getAccessToken() || 'anon'}`;
}

function invalidateMeCache() {
  _meCache.clear();
  _mePromiseCache.clear();
}

function invalidateSignedUrlCache() {
  _signedUrlCache.clear();
  _signedUrlPromiseCache.clear();
}

function getNowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

function parseUnixSeconds(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
}

function normalizeSessionTimestamps(session: AuthSession): AuthSession {
  const expiresIn =
    typeof session.expires_in === 'number' && Number.isFinite(session.expires_in)
      ? Math.max(0, Math.floor(session.expires_in))
      : undefined;
  const expiresAt = parseUnixSeconds(session.expires_at);
  const computedExpiresAt =
    expiresAt ?? (expiresIn ? getNowUnixSeconds() + expiresIn : undefined);

  return {
    ...session,
    expires_in: expiresIn,
    expires_at: computedExpiresAt,
  };
}

function isSessionExpiringSoon(session: AuthSession, bufferSeconds = TOKEN_REFRESH_BUFFER_SECONDS) {
  if (!session.refresh_token) return false;
  const expiresAt = parseUnixSeconds(session.expires_at);
  if (!expiresAt) return false;
  return expiresAt - bufferSeconds <= getNowUnixSeconds();
}

function removeLegacyStoredSession() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Best effort cleanup for older builds that persisted auth in localStorage.
  }
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (!raw) {
    removeLegacyStoredSession();
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.access_token) {
      clearStoredSession();
      return null;
    }
    return normalizeSessionTimestamps(parsed);
  } catch {
    clearStoredSession();
    return null;
  }
}

export function setStoredSession(session: AuthSession | null) {
  if (typeof window === 'undefined') return;
  invalidateMeCache();
  invalidateSignedUrlCache();
  removeLegacyStoredSession();

  if (!session) {
    try {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    return;
  }

  try {
    window.sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify(normalizeSessionTimestamps(session)),
    );
  } catch {
    // If sessionStorage is unavailable, fail closed instead of persisting auth longer than intended.
    try {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
  }
}

export function clearStoredSession() {
  setStoredSession(null);
}

function getAccessToken() {
  return getStoredSession()?.access_token || null;
}

let _refreshPromise: Promise<AuthSession | null> | null = null;

async function refreshSession(): Promise<AuthSession | null> {
  // Deduplicate concurrent refresh attempts
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const current = getStoredSession();
      if (!current?.refresh_token || !supabaseUrl || !publicAnonKey) return null;

      const response = await fetch(
        `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
        {
          method: 'POST',
          headers: {
            apikey: publicAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        },
      );

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          clearStoredSession();
          if (typeof window !== 'undefined') {
            window.location.href = '/auth?mode=signin';
          }
        }
        return null;
      }

      const payload = await response.json();
      if (!payload?.access_token) return null;

      const refreshed = normalizeSessionTimestamps({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token ?? current.refresh_token,
        expires_in: payload.expires_in,
        expires_at: payload.expires_at,
        token_type: payload.token_type,
        user: payload.user ?? current.user,
      });
      setStoredSession(refreshed);
      return refreshed;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

async function getValidAccessToken() {
  const current = getStoredSession();
  if (!current?.access_token) return null;
  if (!isSessionExpiringSoon(current)) return current.access_token;

  const refreshed = await refreshSession();
  return refreshed?.access_token || current.access_token;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}, _retried = false): Promise<T> {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error(
      'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in your .env file.',
    );
  }

  const token = options.token ?? (await getValidAccessToken());
  const headers: Record<string, string> = {
    apikey: publicAnonKey,
    Authorization: `Bearer ${token || publicAnonKey}`,
    ...options.headers,
  };

  const response = await fetch(`${supabaseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

  const rawBody = await response.text();

  if (!response.ok) {
    // Auto-refresh on 401 and retry once
    if (response.status === 401 && !_retried && !options.token) {
      const refreshed = await refreshSession();
      if (refreshed?.access_token) {
        return apiRequest<T>(path, options, true);
      }
    }

    let message = `Request failed (${response.status})`;

    if (rawBody) {
      try {
        const error = JSON.parse(rawBody);
        message = error.details || error.error || error.message || message;
      } catch {
        message = rawBody;
      }
    }

    throw new Error(message);
  }

  if (!rawBody) {
    return {} as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return {} as T;
  }
}

async function restRequest<T>(
  table: string,
  query = '',
  options: RequestOptions = {},
): Promise<T> {
  const encodedTable = encodeURIComponent(table);
  const path = `/rest/v1/${encodedTable}${query ? `?${query}` : ''}`;
  return apiRequest<T>(path, options);
}

async function authRequest<T>(path: string, options: RequestOptions = {}, _retried = false): Promise<T> {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error(
      'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in your .env file.',
    );
  }

  const token = options.token ?? (await getValidAccessToken());
  const headers: Record<string, string> = {
    apikey: publicAnonKey,
    Authorization: `Bearer ${token || publicAnonKey}`,
    ...options.headers,
  };

  const response = await fetch(`${supabaseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

  const rawBody = await response.text();
  const payload = rawBody ? JSON.parse(rawBody) : {};

  if (!response.ok) {
    // Auto-refresh on 401 and retry once
    if (response.status === 401 && !_retried && !options.token) {
      const refreshed = await refreshSession();
      if (refreshed?.access_token) {
        return authRequest<T>(path, options, true);
      }
    }

    throw new Error(payload.msg || payload.error_description || payload.error || `Request failed (${response.status})`);
  }

  return payload as T;
}

function shouldFallbackToRest(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const isMissingRoute = message.includes('404') || message.includes('not found');
  const isSchemaCacheError = message.includes('schema cache') && message.includes('students');
  const isYearLevelMissing = message.includes('year_level') && message.includes('students');
  return isMissingRoute || isSchemaCacheError || isYearLevelMissing;
}

export function signInWithGoogle() {
  if (typeof window === 'undefined') return;
  if (!supabaseUrl) {
    throw new Error('Missing Supabase config. Set VITE_SUPABASE_URL in your .env file.');
  }

  const redirectTo = buildAuthRedirectUrl('/auth?mode=signin');
  if (!redirectTo) {
    throw new Error('Missing site URL config. Set VITE_SITE_URL in your .env file.');
  }
  const url = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
    redirectTo,
  )}&hd=${encodeURIComponent(GC_DOMAIN)}&prompt=select_account`;
  window.location.assign(url);
}

export async function rejectUnauthorizedGoogleAccount(token?: string | null) {
  if (!token) return;
  await apiRequest<{ success: boolean; deleted?: boolean }>('/functions/v1/server/auth/reject-google-account', {
    method: 'POST',
    token,
  });
}

export async function getUserByToken(token: string | null) {
  if (!token) {
    throw new Error('Missing access token.');
  }
  return authRequest<SupabaseAuthUser>('/auth/v1/user', { token });
}

export async function updateUserPassword(newPassword: string, token?: string | null) {
  const password = newPassword?.trim();
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  return authRequest<{ id: string; email?: string | null }>('/auth/v1/user', {
    method: 'PUT',
    token,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      password,
    }),
  });
}

export async function hasServerPasswordSetupCompleted(token?: string | null) {
  try {
    const user = await getCurrentAuthUser(token);
    const rows = await restRequest<Array<{ password_setup_completed?: boolean | null }>>(
      'profiles',
      `id=eq.${user.id}&select=password_setup_completed`,
      { token },
    );
    return Boolean(rows?.[0]?.password_setup_completed);
  } catch {
    return false;
  }
}

export async function markServerPasswordSetupCompleted(token?: string | null) {
  try {
    const user = await getCurrentAuthUser(token);
    await restRequest(
      'profiles',
      `id=eq.${user.id}`,
      {
        method: 'PATCH',
        token,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password_setup_completed: true,
        }),
      },
    );
  } catch {
    // Keep auth flow working even if the column is not available yet.
  }
}

async function getCurrentAuthUser(token?: string | null) {
  const session = getStoredSession();
  if (session?.user?.id && (session.user as SupabaseAuthUser)?.user_metadata) {
    return session.user as SupabaseAuthUser;
  }
  const payload = await authRequest<SupabaseAuthUser>('/auth/v1/user', { token });
  return payload;
}

function mapMedicalHistory(row: any) {
  if (!row) return undefined;

  return {
    allergy: row.allergy,
    asthma: row.asthma,
    chickenPox: row.chicken_pox,
    diabetes: row.diabetes,
    dysmenorrhea: row.dysmenorrhea,
    epilepsySeizure: row.epilepsy_seizure,
    heartDisorder: row.heart_disorder,
    hepatitis: row.hepatitis,
    hypertension: row.hypertension,
    measles: row.measles,
    mumps: row.mumps,
    anxietyDisorder: row.anxiety_disorder,
    panicAttack: row.panic_attack,
    pneumonia: row.pneumonia,
    ptbPrimaryComplex: row.ptb_primary_complex,
    typhoidFever: row.typhoid_fever,
    covid19: row.covid19,
    uti: row.uti,
  };
}

function mapStaffMeasurements(row: any) {
  if (!row) return undefined;

  return {
    bloodPressure: row.blood_pressure,
    cardiacRate: row.cardiac_rate,
    respiratoryRate: row.respiratory_rate,
    temperature: row.temperature,
    weight: row.weight,
    height: row.height,
    bmi: row.bmi,
    visualAcuity: row.visual_acuity,
    skin: row.skin,
    heent: row.heent,
    chestLungs: row.chest_lungs,
    heart: row.heart,
    abdomen: row.abdomen,
    extremities: row.extremities,
    others: row.others,
    examinedBy: row.examined_by,
  };
}

function latestFilesByType(files: any[]) {
  return files.reduce((acc, file) => {
    const existing = acc[file.type];
    if (!existing || new Date(file.uploaded_at).getTime() > new Date(existing.uploaded_at).getTime()) {
      acc[file.type] = file;
    }
    return acc;
  }, {} as Record<string, any>);
}

function byId(rows: any[] | null | undefined) {
  return (rows || []).reduce((acc, row) => {
    if (row?.id) acc[row.id] = row;
    return acc;
  }, {} as Record<string, any>);
}

function findLabFileByHint(files: any[], hint: string) {
  const keys =
    hint.toLowerCase() === 'xray'
      ? ['xray', 'x-ray', 'chest']
      : hint.toLowerCase() === 'cbc'
      ? ['cbc', 'blood', 'complete blood count', 'hematology']
      : ['urinalysis', 'urine', 'ua', 'u/a'];
  const match = (files || []).find((file) => {
    const name = String(file?.file_name || '').toLowerCase();
    const path = String(file?.storage_path || '').toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    return keys.some((key) => name.includes(key) || path.includes(key) || type.includes(key));
  });
  return match || null;
}

function findGenericLabFile(files: any[]) {
  return (files || []).find((file) => {
    const type = String(file?.type || '').toLowerCase();
    if (['photo', 'signature', 'certificate'].includes(type)) return false;
    const mimeType = String(file?.mime_type || '').toLowerCase();
    const name = String(file?.file_name || '').toLowerCase();
    return mimeType.includes('pdf') || mimeType.includes('image') || /\.(pdf|png|jpe?g|webp|gif)$/i.test(name);
  }) || null;
}

function normalizeStorageFileUrl(url?: string | null) {
  if (!url || !supabaseUrl) return url || undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/storage/v1/')) return `${supabaseUrl}${trimmed}`;
  if (trimmed.startsWith('/object/')) return `${supabaseUrl}/storage/v1${trimmed}`;
  if (trimmed.startsWith('storage/v1/')) return `${supabaseUrl}/${trimmed}`;
  if (trimmed.startsWith('object/')) return `${supabaseUrl}/storage/v1/${trimmed}`;
  return trimmed;
}

async function createSignedStorageUrl(storagePath?: string | null, token?: string | null, bucket?: string | null) {
  const targetBucket = (bucket || STORAGE_BUCKET).trim() || STORAGE_BUCKET;
  const rawPath = (storagePath || '').trim();
  let path = rawPath.replace(/^\/+/, '');
  if (path.startsWith(`${targetBucket}/`)) {
    path = path.slice(targetBucket.length + 1);
  }
  if (!path || !supabaseUrl || !publicAnonKey) return null;
  const cacheKey = `${targetBucket}:${path}`;
  const now = Date.now();
  const cached = _signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inFlight = _signedUrlPromiseCache.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    const trySign = async (targetPath: string) => {
      // Use the bulk sign endpoint to avoid HTTP 400 Bad Request console spam
      // when an object does not exist.
      const response = await fetch(
        `${supabaseUrl}/storage/v1/object/sign/${targetBucket}`,
        {
          method: 'POST',
          headers: {
            apikey: publicAnonKey,
            Authorization: `Bearer ${token || getAccessToken() || publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365, paths: [targetPath] }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return null;

      // Bulk sign returns an array of results
      const result = Array.isArray(payload) ? payload[0] : payload;
      if (!result || result.error) return null;

      const rawSigned =
        result.signedURL || result.signedUrl || result.signed_url || null;
      if (!rawSigned) return null;
      if (/^https?:\/\//i.test(rawSigned)) return rawSigned as string;
      return `${supabaseUrl}/storage/v1${rawSigned}`;
    };

    try {
      const signedDirect = await trySign(path);
      if (signedDirect) {
        _signedUrlCache.set(cacheKey, {
          value: signedDirect,
          expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS,
        });
        return signedDirect;
      }

      const encodedPath = path
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      const signedEncoded = encodedPath && encodedPath !== path ? await trySign(encodedPath) : null;
      if (signedEncoded) {
        _signedUrlCache.set(cacheKey, {
          value: signedEncoded,
          expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS,
        });
      }
      return signedEncoded;
    } catch {
      return null;
    } finally {
      _signedUrlPromiseCache.delete(cacheKey);
    }
  })();

  _signedUrlPromiseCache.set(cacheKey, promise);
  return promise;
}

async function listStorageFilesForSubmission(submissionId: string, token?: string | null, bucket?: string) {
  const targetBucket = (bucket || STORAGE_BUCKET).trim() || STORAGE_BUCKET;
  if (!submissionId || !supabaseUrl || !publicAnonKey) return [] as any[];
  try {
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/list/${targetBucket}`,
      {
        method: 'POST',
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${token || getAccessToken() || publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: `${submissionId}/`,
          limit: 100,
          offset: 0,
        }),
      },
    );
    const payload = await response.json().catch(() => []);
    if (!response.ok || !Array.isArray(payload)) return [];

    const inferred = await Promise.all(
      payload
        .filter((item: any) => item?.name)
        .map(async (item: any) => {
          const fileName = String(item.name);
          const storagePath = `${submissionId}/${fileName}`;
          const lower = fileName.toLowerCase();
          const inferredType = lower.startsWith('cbc_')
            ? 'cbc'
            : lower.startsWith('xray_')
            ? 'xray'
            : lower.startsWith('urinalysis_')
            ? 'urinalysis'
            : lower.startsWith('photo_')
            ? 'photo'
            : lower.startsWith('signature_')
            ? 'signature'
            : 'other';
          const signedUrl = await createSignedStorageUrl(storagePath, token, targetBucket);
          return {
            id: `storage-${submissionId}-${fileName}`,
            submission_id: submissionId,
            type: inferredType,
            file_name: fileName,
            storage_bucket: targetBucket,
            storage_path: storagePath,
            mime_type: null,
            uploaded_at: new Date().toISOString(),
            url: signedUrl || null,
          };
        }),
    );
    return inferred.filter((row) => row.url);
  } catch {
    return [];
  }
}

function mapSubmission(row: any, related: Record<string, any>) {
  const student = related.students[row.student_id] || {};
  const emergencyContact = related.emergencyContacts[row.id];
  const medicalHistory = related.medicalHistory[row.id];
  const staffMeasurements = related.staffMeasurements[row.id];
  const xray = related.xray[row.id];
  const cbc = related.cbc[row.id];
  const urinalysis = related.urinalysis[row.id];
  const certificate = related.certificates[row.id];
  const files = latestFilesByType(related.files[row.id] || []);
  const submissionFiles = related.files[row.id] || [];
  const xrayFileFromLab = xray?.file_id ? related.filesById[xray.file_id] : null;
  const cbcFileFromLab = cbc?.file_id ? related.filesById[cbc.file_id] : null;
  const urinalysisFileFromLab = urinalysis?.file_id ? related.filesById[urinalysis.file_id] : null;
  const xrayFileByHint = findLabFileByHint(submissionFiles, 'xray');
  const cbcFileByHint = findLabFileByHint(submissionFiles, 'cbc');
  const urinalysisFileByHint = findLabFileByHint(submissionFiles, 'urinalysis');
  const genericLabFile = findGenericLabFile(submissionFiles);
  const profileAssets = student?.profile_id ? related.profileAssetsByProfileId?.[student.profile_id] || {} : {};

  return {
    id: row.id,
    studentId: row.student_id,
    firstName: row.first_name || student.first_name || '',
    lastName: row.last_name || student.last_name || '',
    middleInitial: row.middle_initial || student.middle_initial || '',
    course: row.course || student.course || row.department || student.department || '',
    department: row.department || student.department || row.course || student.course || '',
    year: String(row.year_level || student.year_level || ''),
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    staffNotes: row.staff_notes,
    age: row.age ? String(row.age) : student.age ? String(student.age) : '',
    sex: row.sex || student.sex || '',
    birthday: row.birthday || student.birthday || '',
    civilStatus: row.civil_status || student.civil_status || '',
    contactNumber: row.contact_number || student.contact_number || '',
    address: row.address || student.address || '',
    allergyDetails: row.allergy_details,
    hadOperation: row.had_operation,
    operationDetails: row.operation_details,
    bloodPressure: row.blood_pressure,
    weight: row.weight,
    height: row.height,
    bmi: row.bmi,
    emergencyContact: emergencyContact
      ? {
          name: emergencyContact.name,
          relationship: emergencyContact.relationship,
          phone: emergencyContact.phone,
          address: emergencyContact.address,
        }
      : undefined,
    medicalHistory: mapMedicalHistory(medicalHistory),
    staffMeasurements: mapStaffMeasurements(staffMeasurements),
    labResults: {
      xrayDate: xray?.xray_date,
      xrayResult: xray?.xray_result,
      xrayFindings: xray?.xray_findings,
      cbcDate: cbc?.cbc_date,
      hemoglobin: cbc?.hemoglobin,
      hematocrit: cbc?.hematocrit,
      wbc: cbc?.wbc,
      plateletCount: cbc?.platelet_count,
      bloodType: cbc?.blood_type,
      glucose: cbc?.glucose,
      protein: cbc?.protein,
      urinalysisDate: urinalysis?.urinalysis_date,
      urinalysisGlucose: urinalysis?.glucose,
      urinalysisProtein: urinalysis?.protein,
    },
    clearanceInfo: certificate
      ? {
          findingsNormal: certificate.findings_normal,
          diagnosis: certificate.diagnosis,
          remarks: certificate.remarks,
          purpose: certificate.purpose,
          controlNo: certificate.control_no,
          issuedDate: certificate.issued_date || certificate.issued_at,
        }
      : undefined,
    photoUrl: normalizeStorageFileUrl(files.photo?.url || profileAssets.photo?.url),
    signatureUrl: normalizeStorageFileUrl(files.signature?.url || profileAssets.signature?.url),
    xrayFileUrl: normalizeStorageFileUrl(xrayFileFromLab?.url || files.xray?.url || xrayFileByHint?.url || genericLabFile?.url),
    cbcFileUrl: normalizeStorageFileUrl(cbcFileFromLab?.url || files.cbc?.url || cbcFileByHint?.url || genericLabFile?.url),
    urinalysisFileUrl: normalizeStorageFileUrl(urinalysisFileFromLab?.url || files.urinalysis?.url || urinalysisFileByHint?.url || genericLabFile?.url),
    certificatePdfUrl: normalizeStorageFileUrl(files.certificate?.url || certificate?.pdf_url),
    labTestLocation: row.lab_test_location || '',
    otherClinicName: row.lab_test_clinic || '',
  };
}

async function loadRelatedData(rows: any[]) {
  const submissionIds = rows.map((row) => row.id);
  const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];
  const idList = submissionIds.map((id) => encodeURIComponent(id)).join(',');
  const studentIdList = studentIds.map((id) => encodeURIComponent(id)).join(',');

  const token = getAccessToken();
  const [
    students,
    emergencyContacts,
    medicalHistory,
    staffMeasurements,
    xray,
    cbc,
    urinalysis,
    certificates,
    files,
  ] = await Promise.all([
    studentIds.length
      ? restRequest<any[]>('students', `student_id=in.(${studentIdList})`)
      : Promise.resolve([]),
    submissionIds.length
      ? restRequest<any[]>('emergency_contacts', `submission_id=in.(${idList})`)
      : Promise.resolve([]),
    submissionIds.length
      ? restRequest<any[]>('medical_history', `submission_id=in.(${idList})`)
      : Promise.resolve([]),
    submissionIds.length
      ? restRequest<any[]>('staff_measurements', `submission_id=in.(${idList})`)
      : Promise.resolve([]),
    submissionIds.length
      ? restRequest<any[]>('lab_chest_xray', `submission_id=in.(${idList})`)
      : Promise.resolve([]),
    submissionIds.length
      ? restRequest<any[]>('lab_cbc', `submission_id=in.(${idList})`)
      : Promise.resolve([]),
    submissionIds.length
      ? restRequest<any[]>('lab_urinalysis', `submission_id=in.(${idList})`)
      : Promise.resolve([]),
    submissionIds.length
      ? restRequest<any[]>('certificates', `submission_id=in.(${idList})`)
      : Promise.resolve([]),
    submissionIds.length
      ? restRequest<any[]>('files', `submission_id=in.(${idList})`)
      : Promise.resolve([]),
  ]);

  const normalizedFiles = await normalizeFileRows(files, token);

  const filesBySubmissionCurrent = (normalizedFiles || []).reduce((acc, file) => {
    acc[file.submission_id] = acc[file.submission_id] || [];
    acc[file.submission_id].push(file);
    return acc;
  }, {} as Record<string, any[]>);

  const shouldRunStorageFallback = submissionIds.length <= STORAGE_FALLBACK_MAX_SUBMISSIONS;
  const submissionsMissingFiles = shouldRunStorageFallback
    ? submissionIds.filter((id) => !(filesBySubmissionCurrent[id]?.length))
    : [];
  const fallbackBuckets = [...new Set([STORAGE_BUCKET, ...Object.values(STORAGE_BUCKET_BY_FILE_TYPE)])];
  const listedFallbackFiles = (
    await Promise.all(
      submissionsMissingFiles.flatMap((id) =>
        fallbackBuckets.map((bucketName) => listStorageFilesForSubmission(id, token, bucketName)),
      ),
    )
  ).flat();
  const allFiles = [...(normalizedFiles || []), ...listedFallbackFiles];
  const studentRows = students || [];
  const studentProfileIds = [...new Set(studentRows.map((student) => student?.profile_id).filter(Boolean))];
  const studentProfileIdList = studentProfileIds.map((id) => encodeURIComponent(id)).join(',');
  const profileAssetFilesRaw = studentProfileIds.length
    ? await restRequest<any[]>(
        'files',
        `uploaded_by=in.(${studentProfileIdList})&submission_id=is.null&type=in.(photo,signature)&order=uploaded_at.desc`,
      ).catch(() => [])
    : [];
  const normalizedProfileAssetFiles = await normalizeFileRows(profileAssetFilesRaw, token);
  const profileAssetsByUploadedBy = normalizedProfileAssetFiles.reduce((acc, file) => {
    if (!file?.uploaded_by) return acc;
    acc[file.uploaded_by] = acc[file.uploaded_by] || [];
    acc[file.uploaded_by].push(file);
    return acc;
  }, {} as Record<string, any[]>);
  const shouldRunProfileAssetFallback = studentRows.length <= PROFILE_ASSET_FALLBACK_MAX_STUDENTS;
  const missingProfileAssetStudents = shouldRunProfileAssetFallback
    ? studentRows.filter((student) => {
        const latest = latestFilesByType(profileAssetsByUploadedBy[student?.profile_id] || []);
        return !latest.photo || !latest.signature;
      })
    : [];
  const fallbackProfileAssets = await Promise.all(
    missingProfileAssetStudents.map(async (student) => ({
      profileId: student.profile_id,
      files: await listProfileAssetsFromStorage(student.student_id, token),
    })),
  );
  const profileAssetsByProfileId = studentRows.reduce((acc, student) => {
    if (!student?.profile_id) return acc;
    const metadataFiles = profileAssetsByUploadedBy[student.profile_id] || [];
    const storageFallbackFiles =
      fallbackProfileAssets.find((entry) => entry.profileId === student.profile_id)?.files || [];
    acc[student.profile_id] = latestFilesByType([...metadataFiles, ...storageFallbackFiles]);
    return acc;
  }, {} as Record<string, Record<string, any>>);

  const byKey = (rowsData: any[] | null | undefined, key: string) =>
    (rowsData || []).reduce((acc, item) => {
      acc[item[key]] = item;
      return acc;
    }, {} as Record<string, any>);

  const filesBySubmission = allFiles.reduce((acc, file) => {
    acc[file.submission_id] = acc[file.submission_id] || [];
    acc[file.submission_id].push(file);
    return acc;
  }, {} as Record<string, any[]>);

  return {
    students: byKey(students, 'student_id'),
    emergencyContacts: byKey(emergencyContacts, 'submission_id'),
    medicalHistory: byKey(medicalHistory, 'submission_id'),
    staffMeasurements: byKey(staffMeasurements, 'submission_id'),
    xray: byKey(xray, 'submission_id'),
    cbc: byKey(cbc, 'submission_id'),
    urinalysis: byKey(urinalysis, 'submission_id'),
    certificates: byKey(certificates, 'submission_id'),
    profileAssetsByProfileId,
    files: filesBySubmission,
    filesById: byId(allFiles),
  };
}

async function getMappedSubmissions(query: string) {
  const rows = await restRequest<any[]>('submissions', query);
  const related = await loadRelatedData(rows || []);
  return (rows || []).map((row: any) => mapSubmission(row, related));
}

export async function authenticateWithPassword(email: string, password: string) {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error(
      'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in your .env file.',
    );
  }
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: publicAnonKey,
      Authorization: `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const rawBody = await response.text();
  let payload: Record<string, any> = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(
      payload.msg ||
      payload.error_description ||
      payload.error ||
      `Failed to sign in (${response.status})`,
    );
  }

  if (!payload?.access_token) {
    throw new Error('Sign in succeeded but no session token was returned.');
  }

  return payload as AuthSession;
}

export async function signInWithPassword(email: string, password: string) {
  const session = await authenticateWithPassword(email, password);

  setStoredSession(session);

  // Enforce domain restriction using actual persisted role:
  // only student accounts must use @gordoncollege.edu.ph.
  try {
    const profileId = session.user?.id;
    if (profileId) {
      const profiles = await restRequest<any[]>(
        'profiles',
        `id=eq.${encodeURIComponent(profileId)}&select=role,email`,
        { token: session.access_token },
      );
      const profile = (profiles || [])[0];
      if (profile?.role === 'student' && !isGCDomainEmail(email)) {
        clearStoredSession();
        throw new Error(`Only @${GC_DOMAIN} email accounts are allowed for students.`);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('@gordoncollege.edu.ph')) {
      throw error;
    }
    // If profile lookup fails, keep sign-in behavior unchanged rather than locking out valid users.
  }

  return session;
}

export async function signUpWithPassword(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
) {
  const supabase = getAuthClient();
  if (!isGCDomainEmail(email)) {
    throw new Error(`Please use your @${GC_DOMAIN} email address to register.`);
  }
  if (!isValidStudentRegistrationEmail(email)) {
    throw new Error(`Use your 9-digit student email, for example 202311165@${GC_DOMAIN}.`);
  }

  const normalizedFirstName = normalizeNamePart(firstName);
  const normalizedLastName = normalizeNamePart(lastName);
  const fullName = [normalizedFirstName, normalizedLastName].filter(Boolean).join(' ').trim();
  const emailRedirectTo = buildAuthRedirectUrl('/auth?mode=signin&verified=1');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        full_name: fullName,
        first_name: normalizedFirstName,
        last_name: normalizedLastName,
        student_id: deriveStudentIdFromEmail(email),
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const session: AuthSession | null =
    data.session
      ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
          token_type: data.session.token_type,
          user: data.session.user
            ? {
                id: data.session.user.id,
                email: data.session.user.email || undefined,
              }
            : undefined,
        }
      : null;
  const user = (data.user || null) as SupabaseAuthUser | null;
  const hasNoIdentity = Array.isArray(user?.identities) && user.identities.length === 0;
  if (!session && hasNoIdentity) {
    throw new Error('This email may already be registered. Try Sign In or reset your password.');
  }

  if (session) {
    setStoredSession(session);
  } else {
    clearStoredSession();
  }

  return {
    session,
    user,
    emailConfirmationRequired: !session,
  };
}

export async function resendVerificationEmail(email: string) {
  const supabase = getAuthClient();

  const emailRedirectTo = buildAuthRedirectUrl('/auth?mode=signin&verified=1');

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true as const };
}

export async function sendPasswordResetEmail(email: string) {
  const supabase = getAuthClient();

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Please enter your email first.');
  }

  const cooldownRemaining = getPasswordResetCooldownRemaining(normalizedEmail);
  if (cooldownRemaining > 0) {
    const minutes = Math.floor(cooldownRemaining / 60);
    const seconds = cooldownRemaining % 60;
    const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    throw new Error(`Please wait ${formatted} before requesting another password reset email.`);
  }

  const emailRedirectTo = buildAuthRedirectUrl('/auth?mode=signin');
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: emailRedirectTo,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (typeof window !== 'undefined') {
    const storageKey = getPasswordResetCooldownStorageKey(normalizedEmail);
    window.localStorage.setItem(storageKey, Date.now().toString());
  }

  return { success: true as const };
}

export async function signOut() {
  if (!supabaseUrl || !publicAnonKey) {
    clearStoredSession();
    return;
  }

  const session = getStoredSession();

  try {
    if (session?.access_token) {
      await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    }
  } finally {
    clearStoredSession();
  }
}

export async function getMe(token?: string | null) {
  const cacheKey = getMeCacheKey(token);
  const now = Date.now();
  const cached = _meCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inFlight = _mePromiseCache.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const requestPromise = (async () => {
    let resolvedMe: AuthMe;
    try {
      resolvedMe = await apiRequest<AuthMe>('/functions/v1/server/me', { token });
    } catch {
      const user = await getCurrentAuthUser(token);
      const derivedStudentId = deriveStudentIdFromEmail(user.email);
      const { firstName, lastName } = deriveNamePartsFromUser(user);
      const profileRows = await restRequest<any[]>(
        'profiles',
        `id=eq.${user.id}&select=*`,
        {
          token,
          headers: { Prefer: 'count=exact' },
        },
      );
      const profile = profileRows[0];
      const normalizedEmail = normalizeEmail(user.email) || null;
      const resolvedRole = resolveRoleFromEmail(user.email);
      let resolvedProfile = profile;

      if (!resolvedProfile) {
        resolvedProfile = (
          await restRequest<any[]>(
            'profiles',
            'select=*',
            {
              method: 'POST',
              token,
              headers: {
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify({
                id: user.id,
                role: resolvedRole,
                email: normalizedEmail,
                student_id: derivedStudentId,
                first_name: firstName,
                last_name: lastName,
              }),
            },
          )
        )[0];
      } else if (
        resolvedRole === 'student' &&
        (
          resolvedProfile.student_id !== derivedStudentId
          || resolvedProfile.email !== normalizedEmail
          || (firstName && !resolvedProfile.first_name)
          || (lastName && !resolvedProfile.last_name)
        )
      ) {
        resolvedProfile = (
          await restRequest<any[]>(
            'profiles',
            `id=eq.${user.id}&select=*`,
            {
              method: 'PATCH',
              token,
              headers: {
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify({
                email: normalizedEmail,
                student_id: derivedStudentId,
                first_name: resolvedProfile.first_name || firstName,
                last_name: resolvedProfile.last_name || lastName,
              }),
            },
          )
        )[0] || resolvedProfile;
      }

      if (!resolvedProfile) {
        throw new Error('Profile not found for authenticated user.');
      }

      const [studentRows, staffRows] = await Promise.all([
        resolvedProfile.student_id
          ? restRequest<any[]>(
              'students',
              `student_id=eq.${encodeURIComponent(resolvedProfile.student_id)}&select=*`,
              { token },
            )
          : Promise.resolve([]),
        restRequest<any[]>('staff_users', `profile_id=eq.${user.id}&select=*`, { token }),
      ]);

      resolvedMe = {
        profile: resolvedProfile,
        student: studentRows[0] || null,
        staff: staffRows[0] || null,
      } satisfies AuthMe;
    }

    _meCache.set(cacheKey, {
      value: resolvedMe,
      expiresAt: Date.now() + ME_CACHE_TTL_MS,
    });
    return resolvedMe;
  })();

  _mePromiseCache.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    _mePromiseCache.delete(cacheKey);
  }
}

async function listProfileAssetsFromStorage(studentId: string, token?: string | null) {
  const targetStudentId = String(studentId || '').trim();
  if (!targetStudentId || !supabaseUrl || !publicAnonKey) return [] as any[];

  const prefix = `profiles/${targetStudentId}/`;
  const assetConfigs = [
    { type: 'photo', bucket: 'profile' },
    { type: 'signature', bucket: 'student_signature' },
  ] as const;

  try {
    const results = await Promise.all(
      assetConfigs.map(async ({ type, bucket }) => {
        const response = await fetch(
          `${supabaseUrl}/storage/v1/object/list/${bucket}`,
          {
            method: 'POST',
            headers: {
              apikey: publicAnonKey,
              Authorization: `Bearer ${token || getAccessToken() || publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prefix,
              limit: 20,
              offset: 0,
            }),
          },
        );

        const payload = await response.json().catch(() => []);
        if (!response.ok || !Array.isArray(payload)) return [] as any[];

        const mapped = await Promise.all(
          payload
            .filter((item: any) => item?.name)
            .map(async (item: any) => {
              const storagePath = `${prefix}${String(item.name)}`;
              const signedUrl = await createSignedStorageUrl(storagePath, token, bucket);
              return {
                id: `profile-${bucket}-${targetStudentId}-${item.name}`,
                submission_id: null,
                type,
                file_name: String(item.name),
                storage_bucket: bucket,
                storage_path: storagePath,
                mime_type: null,
                uploaded_at: new Date().toISOString(),
                uploaded_by: null,
                url: signedUrl || null,
              };
            }),
        );

        return mapped.filter((item) => item.url);
      }),
    );

    return results.flat();
  } catch {
    return [] as any[];
  }
}

async function normalizeFileRows(files: any[] | null | undefined, token?: string | null) {
  return Promise.all(
    (files || []).map(async (file) => {
      if (file?.storage_path) {
        const resolvedBucket =
          String(file?.storage_bucket || '').trim() ||
          inferBucketFromStoragePath(file.storage_path) ||
          inferBucketFromType(file.type) ||
          inferBucketFromNameOrPath(file.file_name, file.storage_path) ||
          STORAGE_BUCKET;
        const signedUrl = await createSignedStorageUrlWithBucketFallbacks(
          file.storage_path,
          token,
          resolvedBucket,
          file.type,
        );
        return {
          ...file,
          storage_bucket: resolvedBucket,
          url: signedUrl || normalizeStorageFileUrl(file.url) || null,
        };
      }
      return { ...file, url: normalizeStorageFileUrl(file?.url) || null };
    }),
  );
}

export async function updateStudentProfile(data: StudentProfileUpdateInput) {
  const payload = {
    studentId: data.studentId || null,
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    middleInitial: data.middleInitial || '',
    department: data.department || '',
    course: data.course || '',
    age: data.age || '',
    sex: data.sex || '',
    birthday: data.birthday || '',
    civilStatus: data.civilStatus || '',
    contactNumber: data.contactNumber || '',
    address: data.address || '',
  };

  const me = await getMe();
  const studentId = me.profile.student_id || payload.studentId;

  if (!studentId) {
    throw new Error('Student ID is required.');
  }

  const updatedProfileRows = await restRequest<any[]>(
    'profiles',
    `id=eq.${encodeURIComponent(me.profile.id)}&select=*`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        first_name: payload.firstName || null,
        last_name: payload.lastName || null,
        department: payload.department || null,
        course: payload.course || null,
        student_id: studentId,
      }),
    },
  );

  await restRequest<any[]>(
    'students',
    'on_conflict=student_id',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        student_id: studentId,
        profile_id: me.profile.id,
        first_name: payload.firstName || null,
        last_name: payload.lastName || null,
        middle_initial: payload.middleInitial || null,
        department: payload.department || null,
        course: payload.course || null,
        age: payload.age ? Number.parseInt(payload.age, 10) : null,
        sex: payload.sex || null,
        birthday: payload.birthday || null,
        civil_status: payload.civilStatus || null,
        contact_number: payload.contactNumber || null,
        address: payload.address || null,
      }),
    },
  );

  const updatedStudentRows = await restRequest<any[]>(
    'students',
    `student_id=eq.${encodeURIComponent(studentId)}&select=*`,
  );

  invalidateMeCache();
  return {
    success: true as const,
    profile: updatedProfileRows[0] || me.profile,
    student: updatedStudentRows[0] || me.student,
  };
}

function splitNameParts(fullName?: string | null) {
  const normalized = String(fullName || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!normalized) {
    return { firstName: '', lastName: '' };
  }

  const parts = normalized.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.slice(-1).join(' '),
  };
}

export async function updateStaffProfile(data: StaffProfileUpdateInput) {
  const payload = {
    name: String(data.name || '').trim(),
    email: normalizeEmail(data.email) || '',
    position: String(data.position || '').trim(),
    phone: String(data.phone || '').trim(),
    applyAcrossRoles: data.applyAcrossRoles !== false,
  };

  if (!payload.name || !payload.email || !payload.position) {
    throw new Error('Name, email, and position are required.');
  }

  try {
    return await apiRequest<{
      success: boolean;
      profile: AuthMe['profile'];
      staff: AuthMe['staff'];
    }>('/functions/v1/server/staff-profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const missingRoute = message.includes('404') || message.includes('not found');

    if (!missingRoute) {
      throw error;
    }
  }

  const me = await getMe();
  const { firstName, lastName } = splitNameParts(payload.name);

  let updatedProfileRows: any[] = [];
  if (payload.applyAcrossRoles) {
    updatedProfileRows = await restRequest<any[]>(
      'profiles',
      `id=eq.${encodeURIComponent(me.profile.id)}&select=*`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          first_name: firstName || null,
          last_name: lastName || null,
          email: payload.email || null,
        }),
      },
    );
  }

  await restRequest<any[]>(
    'staff_users',
    'on_conflict=profile_id',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        profile_id: me.profile.id,
        email: payload.email || null,
        first_name: firstName || null,
        last_name: lastName || null,
        position: payload.position || null,
        phone: payload.phone || null,
      }),
    },
  );

  if (payload.applyAcrossRoles && me.profile.student_id) {
    await restRequest<any[]>(
      'students',
      'on_conflict=student_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          student_id: me.profile.student_id,
          profile_id: me.profile.id,
          first_name: firstName || null,
          last_name: lastName || null,
          contact_number: payload.phone || null,
        }),
      },
    );
  }

  invalidateMeCache();
  const refreshedMe = await getMe();

  return {
    success: true as const,
    profile: updatedProfileRows[0] || refreshedMe.profile,
    staff: refreshedMe.staff,
  };
}

export async function submitMedicalRecord(data: any) {
  const me = await getMe();
  const studentId = me.profile.student_id || data.studentId;
  if (!studentId) {
    throw new Error('Student ID is required.');
  }
  const yearLevel = String(data.yearLevel || '').trim();
  if (!yearLevel) {
    throw new Error('Year level is required.');
  }

  const existingForYear = await restRequest<any[]>(
    'submissions',
    `select=id,status&student_id=eq.${encodeURIComponent(studentId)}&year_level=eq.${encodeURIComponent(yearLevel)}&order=submitted_at.desc&limit=1`,
  );
  const latestYearStatus = String(existingForYear?.[0]?.status || '').toLowerCase();
  if (latestYearStatus && latestYearStatus !== 'returned') {
    throw new Error(`A submission for Year ${yearLevel} already exists and is currently ${latestYearStatus}.`);
  }

  const studentPayload = {
    student_id: studentId,
    profile_id: me.profile.id,
    first_name: data.firstName || null,
    last_name: data.lastName || null,
    middle_initial: data.middleInitial || null,
    department: data.department || null,
    course: data.course || null,
    age: data.age ? Number(data.age) : null,
    sex: data.sex || null,
    birthday: data.birthday || null,
    civil_status: data.civilStatus || null,
    contact_number: data.contactNumber || null,
    address: data.address || null,
  };

  await restRequest<any>(
    'students',
    'on_conflict=student_id',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(studentPayload),
    },
  );

  const submissionInsertPayload = {
    student_id: studentId,
    year_level: yearLevel,
    status: 'pending',
    first_name: data.firstName || null,
    last_name: data.lastName || null,
    middle_initial: data.middleInitial || null,
    department: data.department || null,
    course: data.course || null,
    age: data.age ? Number(data.age) : null,
    sex: data.sex || null,
    birthday: data.birthday || null,
    civil_status: data.civilStatus || null,
    contact_number: data.contactNumber || null,
    address: data.address || null,
    allergy_details: data.allergyDetails || null,
    had_operation: data.hadOperation || null,
    operation_details: data.operationDetails || null,
    weight: data.weight || null,
    height: data.height || null,
    bmi: data.bmi || null,
    data_privacy_consent: Boolean(data.dataPrivacyConsent),
    lab_test_location: data.labTestLocation || null,
    lab_test_clinic: data.labTestLocation === 'other' ? data.otherClinicName || null : null,
  };

  let insertedSubmission: any[] = [];
  try {
    insertedSubmission = await restRequest<any[]>(
      'submissions',
      'select=*',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(submissionInsertPayload),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const hasMissingColumns = message.includes('lab_test_location') || message.includes('lab_test_clinic');
    if (!hasMissingColumns) throw error;

    insertedSubmission = await restRequest<any[]>(
      'submissions',
      'select=*',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          ...submissionInsertPayload,
          lab_test_location: undefined,
          lab_test_clinic: undefined,
        }),
      },
    );
  }

  const recordId = insertedSubmission[0]?.id;
  if (!recordId) {
    throw new Error('Failed to create submission.');
  }

  await Promise.all([
    restRequest(
      'emergency_contacts',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          submission_id: recordId,
          name: data.emergencyContact?.name || null,
          relationship: data.emergencyContact?.relationship || null,
          phone: data.emergencyContact?.phone || null,
          address: data.emergencyContact?.address || null,
        }),
      },
    ),
    restRequest(
      'medical_history',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          submission_id: recordId,
          allergy: Boolean(data.medicalHistory?.allergy),
          asthma: Boolean(data.medicalHistory?.asthma),
          chicken_pox: Boolean(data.medicalHistory?.chickenPox),
          diabetes: Boolean(data.medicalHistory?.diabetes),
          dysmenorrhea: Boolean(data.medicalHistory?.dysmenorrhea),
          epilepsy_seizure: Boolean(data.medicalHistory?.epilepsySeizure),
          heart_disorder: Boolean(data.medicalHistory?.heartDisorder),
          hepatitis: Boolean(data.medicalHistory?.hepatitis),
          hypertension: Boolean(data.medicalHistory?.hypertension),
          measles: Boolean(data.medicalHistory?.measles),
          mumps: Boolean(data.medicalHistory?.mumps),
          anxiety_disorder: Boolean(data.medicalHistory?.anxietyDisorder),
          panic_attack: Boolean(data.medicalHistory?.panicAttack),
          pneumonia: Boolean(data.medicalHistory?.pneumonia),
          ptb_primary_complex: Boolean(data.medicalHistory?.ptbPrimaryComplex),
          typhoid_fever: Boolean(data.medicalHistory?.typhoidFever),
          covid19: Boolean(data.medicalHistory?.covid19),
          uti: Boolean(data.medicalHistory?.uti),
        }),
      },
    ),
  ]);

  return { success: true as const, recordId };
}

export async function updateMedicalRecord(recordId: string, data: any) {
  const me = await getMe();
  const studentId = me.profile.student_id || data.studentId;
  if (!studentId) {
    throw new Error('Student ID is required.');
  }

  const studentPayload = {
    student_id: studentId,
    profile_id: me.profile.id,
    first_name: data.firstName || null,
    last_name: data.lastName || null,
    middle_initial: data.middleInitial || null,
    department: data.department || null,
    course: data.course || null,
    age: data.age ? Number(data.age) : null,
    sex: data.sex || null,
    birthday: data.birthday || null,
    civil_status: data.civilStatus || null,
    contact_number: data.contactNumber || null,
    address: data.address || null,
  };

  await restRequest(
    'students',
    'on_conflict=student_id',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(studentPayload),
    },
  );

  const submissionPatchPayload = {
    status: data.status || undefined,
    year_level: String(data.yearLevel || ''),
    first_name: data.firstName || null,
    last_name: data.lastName || null,
    middle_initial: data.middleInitial || null,
    department: data.department || null,
    course: data.course || null,
    age: data.age ? Number(data.age) : null,
    sex: data.sex || null,
    birthday: data.birthday || null,
    civil_status: data.civilStatus || null,
    contact_number: data.contactNumber || null,
    address: data.address || null,
    allergy_details: data.allergyDetails || null,
    had_operation: data.hadOperation || null,
    operation_details: data.operationDetails || null,
    weight: data.weight || null,
    height: data.height || null,
    bmi: data.bmi || null,
    data_privacy_consent: Boolean(data.dataPrivacyConsent),
    lab_test_location: data.labTestLocation || undefined,
    lab_test_clinic: data.labTestLocation === 'other' ? data.otherClinicName || null : null,
    updated_at: new Date().toISOString(),
  };

  try {
    await restRequest(
      'submissions',
      `id=eq.${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionPatchPayload),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const isResubmittedConstraintError =
      String(data.status || '').toLowerCase() === 'resubmitted' &&
      message.includes('submissions_status_check');
    const hasMissingLabSourceColumns = message.includes('lab_test_location') || message.includes('lab_test_clinic');

    if (!isResubmittedConstraintError && !hasMissingLabSourceColumns) {
      throw error;
    }

    // Backward-compatible fallback for databases where either:
    // 1) status check does not include "resubmitted"
    // 2) lab source columns are not migrated yet
    await restRequest(
      'submissions',
      `id=eq.${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...submissionPatchPayload,
          status: isResubmittedConstraintError ? 'pending' : submissionPatchPayload.status,
          lab_test_location: undefined,
          lab_test_clinic: undefined,
        }),
      },
    );
  }

  await Promise.all([
    restRequest(
      'emergency_contacts',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          submission_id: recordId,
          name: data.emergencyContact?.name || null,
          relationship: data.emergencyContact?.relationship || null,
          phone: data.emergencyContact?.phone || null,
          address: data.emergencyContact?.address || null,
        }),
      },
    ),
    restRequest(
      'medical_history',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          submission_id: recordId,
          allergy: Boolean(data.medicalHistory?.allergy),
          asthma: Boolean(data.medicalHistory?.asthma),
          chicken_pox: Boolean(data.medicalHistory?.chickenPox),
          diabetes: Boolean(data.medicalHistory?.diabetes),
          dysmenorrhea: Boolean(data.medicalHistory?.dysmenorrhea),
          epilepsy_seizure: Boolean(data.medicalHistory?.epilepsySeizure),
          heart_disorder: Boolean(data.medicalHistory?.heartDisorder),
          hepatitis: Boolean(data.medicalHistory?.hepatitis),
          hypertension: Boolean(data.medicalHistory?.hypertension),
          measles: Boolean(data.medicalHistory?.measles),
          mumps: Boolean(data.medicalHistory?.mumps),
          anxiety_disorder: Boolean(data.medicalHistory?.anxietyDisorder),
          panic_attack: Boolean(data.medicalHistory?.panicAttack),
          pneumonia: Boolean(data.medicalHistory?.pneumonia),
          ptb_primary_complex: Boolean(data.medicalHistory?.ptbPrimaryComplex),
          typhoid_fever: Boolean(data.medicalHistory?.typhoidFever),
          covid19: Boolean(data.medicalHistory?.covid19),
          uti: Boolean(data.medicalHistory?.uti),
        }),
      },
    ),
  ]);

  return { success: true as const, recordId };
}


export async function getStudentRecords(studentId?: string) {
  const targetStudentId = String(studentId || '').trim();
  const me = await getMe();
  const fallbackStudentId = targetStudentId || me.profile.student_id;
  if (!fallbackStudentId) {
    return { records: [] };
  }

  const records = await getMappedSubmissions(
    `student_id=eq.${encodeURIComponent(fallbackStudentId)}&order=submitted_at.desc`,
  );
  return { records };
}

export async function getStudentNotificationState(studentId?: string) {
  const targetStudentId = String(studentId || '').trim();
  if (!targetStudentId) {
    return { state: null as StudentNotificationStatePayload | null };
  }

  return apiRequest<{ state: StudentNotificationStatePayload | null }>(
    `/functions/v1/server/student-notifications/state?studentId=${encodeURIComponent(targetStudentId)}`,
  );
}

export async function saveStudentNotificationState(
  studentId: string,
  state: StudentNotificationStatePayload,
) {
  const targetStudentId = String(studentId || '').trim();
  if (!targetStudentId) {
    return { success: false as const };
  }

  return apiRequest<{ success: boolean }>('/functions/v1/server/student-notifications/state', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      studentId: targetStudentId,
      state,
    }),
  });
}

export async function getStudentProfileAssets(studentId?: string, profileId?: string | null) {
    const me = await getMe();
  const resolvedStudentId = studentId || me.student?.student_id || me.profile.student_id || '';
  const resolvedProfileId = profileId || me.student?.profile_id || me.profile.id || '';
  const token = getAccessToken();

  let assetRows: any[] = [];
  if (resolvedProfileId) {
    assetRows = await restRequest<any[]>(
      'files',
      `uploaded_by=eq.${encodeURIComponent(resolvedProfileId)}&submission_id=is.null&type=in.(photo,signature)&order=uploaded_at.desc`,
    ).catch(() => []);
  }

  const normalizedAssetRows = await normalizeFileRows(assetRows, token);
  const latestAssets = latestFilesByType(normalizedAssetRows);
  const needsStorageFallback = !latestAssets.photo || !latestAssets.signature;
  const storageFallbackRows =
    needsStorageFallback && resolvedStudentId
      ? await listProfileAssetsFromStorage(resolvedStudentId, token)
      : [];
  const finalAssets = latestFilesByType([...(normalizedAssetRows || []), ...storageFallbackRows]);

  return {
    photoUrl: normalizeStorageFileUrl(finalAssets.photo?.url) || null,
    signatureUrl: normalizeStorageFileUrl(finalAssets.signature?.url) || null,
    photoFileName: finalAssets.photo?.file_name || null,
    signatureFileName: finalAssets.signature?.file_name || null,
  } satisfies StudentProfileAssets;
}

export async function getStudentProfilePhoto(studentId?: string) {
  const assets = await getStudentProfileAssets(studentId);
  if (assets.photoUrl) {
    return { photoUrl: assets.photoUrl };
  }

    const me = await getMe();
  const targetStudentId = studentId || me.profile.student_id;
  if (!targetStudentId) return { photoUrl: null as string | null };

  const submissions = await restRequest<any[]>(
    'submissions',
    `select=id&student_id=eq.${encodeURIComponent(targetStudentId)}&order=submitted_at.desc&limit=20`,
  );
  const submissionIds = (submissions || []).map((row) => row.id).filter(Boolean);
  if (!submissionIds.length) return { photoUrl: null as string | null };

  const idList = submissionIds.map((id) => encodeURIComponent(id)).join(',');
  const token = getAccessToken();
  const photoFiles = await restRequest<any[]>(
    'files',
    `submission_id=in.(${idList})&type=eq.photo&order=uploaded_at.desc`,
  );

  for (const file of photoFiles || []) {
    const resolvedBucket =
      String(file?.storage_bucket || '').trim() ||
      inferBucketFromStoragePath(file?.storage_path) ||
      inferBucketFromType(file?.type) ||
      inferBucketFromNameOrPath(file?.file_name, file?.storage_path) ||
      'profile';

    const signed = file?.storage_path
      ? await createSignedStorageUrlWithBucketFallbacks(
          file.storage_path,
          token,
          resolvedBucket,
          file.type,
        )
      : null;

    const finalUrl = signed || normalizeStorageFileUrl(file?.url) || null;
    if (finalUrl) return { photoUrl: finalUrl };
  }

  return { photoUrl: null as string | null };
}

export async function getSubmissions() {
  try {
    return await apiRequest<{ submissions: any[] }>('/functions/v1/server/submissions');
  } catch (error) {
    if (!shouldFallbackToRest(error)) {
      throw error;
    }
  }

  const submissions = await getMappedSubmissions('order=submitted_at.desc');
  return { submissions };
}

export async function getSubmission(id: string) {
  try {
    return await apiRequest<{ submission: any }>(`/functions/v1/server/submission/${encodeURIComponent(id)}`);
  } catch (error) {
    if (!shouldFallbackToRest(error)) {
      throw error;
    }
  }

  const submissions = await getMappedSubmissions(`id=eq.${id}&order=submitted_at.desc`);
  const submission = submissions[0];
  if (!submission) {
    throw new Error('Record not found');
  }
  return { submission };
}

export async function saveSubmissionReview(id: string, review: any) {
  const personalInfo = review.personalInfo || {};
  const emergencyContact = review.emergencyContact || {};
  const medicalHistory = review.medicalHistory || {};
  const studentMeasurements = review.studentMeasurements || {};
  const hasStudentBloodPressure = Object.prototype.hasOwnProperty.call(studentMeasurements, 'bloodPressure');
  const staffMeasurements = review.staffMeasurements || {};
  const labResults = review.labResults || {};
  const clearanceInfo = review.clearanceInfo || {};
  const nextStatus = review.status;
  const now = new Date().toISOString();

    const me = await getMe();
  const reviewedBy = me.staff?.id || null;

  await Promise.all([
    restRequest(
      'submissions',
      `id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: personalInfo.firstName || null,
          last_name: personalInfo.lastName || null,
          middle_initial: personalInfo.middleInitial || null,
          department: personalInfo.department || null,
          course: personalInfo.course || null,
          year_level: personalInfo.year || null,
          age: personalInfo.age ? Number(personalInfo.age) : null,
          sex: personalInfo.sex || null,
          birthday: personalInfo.birthday || null,
          civil_status: personalInfo.civilStatus || null,
          contact_number: personalInfo.contactNumber || null,
          address: personalInfo.address || null,
          allergy_details: review.allergyDetails || null,
          had_operation: review.hadOperation || null,
          operation_details: review.operationDetails || null,
          blood_pressure: hasStudentBloodPressure ? (studentMeasurements.bloodPressure || null) : undefined,
          weight: studentMeasurements.weight || null,
          height: studentMeasurements.height || null,
          bmi: studentMeasurements.bmi || null,
          staff_notes: review.staffNotes || review.staff_notes || null,
          status: nextStatus || undefined,
          reviewed_by: reviewedBy,
          updated_at: now,
        }),
      },
    ),
    personalInfo.studentId
      ? restRequest(
          'students',
          `student_id=eq.${encodeURIComponent(personalInfo.studentId)}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              first_name: personalInfo.firstName || null,
              last_name: personalInfo.lastName || null,
              middle_initial: personalInfo.middleInitial || null,
              department: personalInfo.department || null,
              course: personalInfo.course || null,
              age: personalInfo.age ? Number(personalInfo.age) : null,
              sex: personalInfo.sex || null,
              birthday: personalInfo.birthday || null,
              civil_status: personalInfo.civilStatus || null,
              contact_number: personalInfo.contactNumber || null,
              address: personalInfo.address || null,
            }),
          },
        )
      : Promise.resolve({}),
    restRequest(
      'emergency_contacts',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          submission_id: id,
          name: emergencyContact.name || null,
          relationship: emergencyContact.relationship || null,
          phone: emergencyContact.phone || null,
          address: emergencyContact.address || null,
        }),
      },
    ),
    restRequest(
      'medical_history',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          submission_id: id,
          allergy: Boolean(medicalHistory.allergy),
          asthma: Boolean(medicalHistory.asthma),
          chicken_pox: Boolean(medicalHistory.chickenPox),
          diabetes: Boolean(medicalHistory.diabetes),
          dysmenorrhea: Boolean(medicalHistory.dysmenorrhea),
          epilepsy_seizure: Boolean(medicalHistory.epilepsySeizure),
          heart_disorder: Boolean(medicalHistory.heartDisorder),
          hepatitis: Boolean(medicalHistory.hepatitis),
          hypertension: Boolean(medicalHistory.hypertension),
          measles: Boolean(medicalHistory.measles),
          mumps: Boolean(medicalHistory.mumps),
          anxiety_disorder: Boolean(medicalHistory.anxietyDisorder),
          panic_attack: Boolean(medicalHistory.panicAttack),
          pneumonia: Boolean(medicalHistory.pneumonia),
          ptb_primary_complex: Boolean(medicalHistory.ptbPrimaryComplex),
          typhoid_fever: Boolean(medicalHistory.typhoidFever),
          covid19: Boolean(medicalHistory.covid19),
          uti: Boolean(medicalHistory.uti),
        }),
      },
    ),
    restRequest(
      'staff_measurements',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          submission_id: id,
          blood_pressure: staffMeasurements.bloodPressure || null,
          cardiac_rate: staffMeasurements.cardiacRate || null,
          respiratory_rate: staffMeasurements.respiratoryRate || null,
          temperature: staffMeasurements.temperature || null,
          weight: staffMeasurements.weight || null,
          height: staffMeasurements.height || null,
          bmi: staffMeasurements.bmi || null,
          visual_acuity: staffMeasurements.visualAcuity || null,
          skin: staffMeasurements.skin || null,
          heent: staffMeasurements.heent || null,
          chest_lungs: staffMeasurements.chestLungs || null,
          heart: staffMeasurements.heart || null,
          abdomen: staffMeasurements.abdomen || null,
          extremities: staffMeasurements.extremities || null,
          others: staffMeasurements.others || null,
          examined_by: staffMeasurements.examinedBy || null,
          updated_by: reviewedBy,
          updated_at: now,
        }),
      },
    ),
    restRequest(
      'lab_chest_xray',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          submission_id: id,
          xray_date: labResults.xrayDate || null,
          xray_result: labResults.xrayResult || null,
          xray_findings: labResults.xrayFindings || null,
        }),
      },
    ),
    restRequest(
      'lab_cbc',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          submission_id: id,
          cbc_date: labResults.cbcDate || null,
          hemoglobin: labResults.hemoglobin || null,
          hematocrit: labResults.hematocrit || null,
          wbc: labResults.wbc || null,
          platelet_count: labResults.plateletCount || null,
          blood_type: labResults.bloodType || null,
          glucose: labResults.glucose || null,
          protein: labResults.protein || null,
        }),
      },
    ),
    restRequest(
      'lab_urinalysis',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          submission_id: id,
          urinalysis_date: labResults.urinalysisDate || null,
          glucose: labResults.urinalysisGlucose || null,
          protein: labResults.urinalysisProtein || null,
        }),
      },
    ),
    restRequest(
      'certificates',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          submission_id: id,
          findings_normal: typeof clearanceInfo.findingsNormal === 'boolean' ? clearanceInfo.findingsNormal : null,
          diagnosis: clearanceInfo.diagnosis || null,
          remarks: clearanceInfo.remarks || null,
          purpose: clearanceInfo.purpose || null,
          control_no: clearanceInfo.controlNo || null,
          issued_at: clearanceInfo.issuedDate || null,
        }),
      },
    ),
  ]);

  // Trigger email notification if status is one of the target states
  if (nextStatus === 'returned' || nextStatus === 'approved' || nextStatus === 'physical_exam_done') {
    try {
      await sendStatusEmailNotification(id, nextStatus, review.staffNotes || review.staff_notes || '');
    } catch (error) {
      console.warn('Failed to send email notification:', error);
    }
  }

  return { success: true as const };
}

async function sendStatusEmailNotification(submissionId: string, status: string, staffNotes: string) {
  const payload = await apiRequest<{ success: boolean; skipped?: boolean; reason?: string }>(
    '/functions/v1/server/notifications/status-email',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        submissionId,
        status,
        staffNotes,
      }),
    },
  );

  if (!payload.success && !payload.skipped) {
    throw new Error('Failed to send email notification.');
  }

  return payload;
}

export async function updateSubmissionStatus(id: string, status: string, staffNotes?: string) {
  try {
    await apiRequest<{ success: boolean }>(`/functions/v1/server/submission/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        staffNotes: staffNotes || null,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const missingRoute = message.includes('404') || message.includes('not found');
    if (!missingRoute) {
      throw error;
    }

    const me = await getMe();
    const reviewedBy = me.staff?.id || null;
    await restRequest(
      'submissions',
      `id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          staff_notes: staffNotes || null,
          reviewed_by: reviewedBy,
          updated_at: new Date().toISOString(),
        }),
      },
    );
  }

  // Trigger email notification
  if (status === 'returned' || status === 'approved' || status === 'physical_exam_done') {
    try {
      await sendStatusEmailNotification(id, status, staffNotes || '');
    } catch (error) {
      console.warn('Failed to send email notification:', error);
    }
  }

  return { success: true as const };
}

export async function updateMeasurements(id: string, measurements: any) {
  try {
    await apiRequest<{ success: boolean }>(`/functions/v1/server/submission/${encodeURIComponent(id)}/measurements`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(measurements || {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const missingRoute = message.includes('404') || message.includes('not found');
    if (!missingRoute) {
      throw error;
    }

    const me = await getMe();
    await Promise.all([
      restRequest(
        'staff_measurements',
        'on_conflict=submission_id',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            submission_id: id,
            blood_pressure: measurements.bloodPressure || null,
            cardiac_rate: measurements.cardiacRate || null,
            respiratory_rate: measurements.respiratoryRate || null,
            temperature: measurements.temperature || null,
            weight: measurements.weight || null,
            height: measurements.height || null,
            bmi: measurements.bmi || null,
            visual_acuity: measurements.visualAcuity || null,
            skin: measurements.skin || null,
            heent: measurements.heent || null,
            chest_lungs: measurements.chestLungs || null,
            heart: measurements.heart || null,
            abdomen: measurements.abdomen || null,
            extremities: measurements.extremities || null,
            others: measurements.others || null,
            examined_by: measurements.examinedBy || null,
            updated_by: me.staff?.id || null,
            updated_at: new Date().toISOString(),
          }),
        },
      ),
      restRequest(
        'lab_chest_xray',
        'on_conflict=submission_id',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            submission_id: id,
            xray_date: measurements.xrayDate || null,
            xray_result: measurements.xrayResult || null,
            xray_findings: measurements.xrayFindings || null,
          }),
        },
      ),
      restRequest(
        'lab_cbc',
        'on_conflict=submission_id',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            submission_id: id,
            cbc_date: measurements.cbcDate || null,
            hemoglobin: measurements.hemoglobin || null,
            hematocrit: measurements.hematocrit || null,
            wbc: measurements.wbc || null,
            platelet_count: measurements.plateletCount || null,
            blood_type: measurements.bloodType || null,
            glucose: measurements.glucose || null,
            protein: measurements.protein || null,
          }),
        },
      ),
      restRequest(
        'lab_urinalysis',
        'on_conflict=submission_id',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            submission_id: id,
            urinalysis_date: measurements.urinalysisDate || null,
            glucose: measurements.urinalysisGlucose || null,
            protein: measurements.urinalysisProtein || null,
          }),
        },
      ),
      restRequest(
        'submissions',
        `id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            updated_at: new Date().toISOString(),
          }),
        },
      ),
    ]);
  }

  return { success: true as const };
}

export async function uploadFile(file: File, recordId: string, fileType: string) {
    const storageBucket = STORAGE_BUCKET_BY_FILE_TYPE[fileType] || STORAGE_BUCKET;
  const token = getAccessToken();
  if (!token || !supabaseUrl || !publicAnonKey) {
    throw new Error('You must be signed in to upload files.');
  }

  const objectName = buildStorageObjectName(fileType, file);
  const storagePath = `${recordId}/${objectName}`;
  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/${storageBucket}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        apikey: publicAnonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    },
  );

  if (!uploadResponse.ok) {
    const raw = await uploadResponse.text().catch(() => '');
    let payload: Record<string, any> = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }
    const message =
      payload.message ||
      payload.error ||
      payload.details ||
      raw ||
      `Failed to upload file (${uploadResponse.status})`;
    throw new Error(message);
  }

  const signedResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${storageBucket}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        apikey: publicAnonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
    },
  );

  const signedPayload = await signedResponse.json().catch(() => ({}));
  const rawSignedUrl =
    signedPayload?.signedURL || signedPayload?.signedUrl || signedPayload?.signed_url || null;
  const fileUrl =
    typeof rawSignedUrl === 'string'
      ? (/^https?:\/\//i.test(rawSignedUrl) ? rawSignedUrl : `${supabaseUrl}/storage/v1${rawSignedUrl}`)
      : null;

  const inserted = await restRequest<any[]>(
    'files',
    'select=*',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        submission_id: recordId,
        type: fileType,
        file_name: file.name,
        mime_type: file.type,
        url: fileUrl,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        uploaded_by: (await getCurrentAuthUser()).id,
      }),
    },
  );

  const fileId = inserted[0]?.id;
  if (fileId && (fileType === 'xray' || fileType === 'cbc' || fileType === 'urinalysis')) {
    const table = fileType === 'xray' ? 'lab_chest_xray' : fileType === 'cbc' ? 'lab_cbc' : 'lab_urinalysis';
    await restRequest(
      table,
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ submission_id: recordId, file_id: fileId }),
      },
    );
  }

  return {
    success: true as const,
    url: fileUrl || undefined,
    fileName: storagePath,
  };
}

export async function uploadStudentProfileAsset(file: File, studentId: string, fileType: 'photo' | 'signature') {
    const targetStudentId = String(studentId || '').trim();
  if (!targetStudentId) {
    throw new Error('Student ID is required to upload profile assets.');
  }

  const storageBucket = STORAGE_BUCKET_BY_FILE_TYPE[fileType];
  const token = getAccessToken();
  if (!token || !supabaseUrl || !publicAnonKey) {
    throw new Error('You must be signed in to upload files.');
  }

  const objectName = buildStorageObjectName(fileType, file);
  const storagePath = `profiles/${targetStudentId}/${objectName}`;
  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/${storageBucket}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        apikey: publicAnonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    },
  );

  if (!uploadResponse.ok) {
    const raw = await uploadResponse.text().catch(() => '');
    let payload: Record<string, any> = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }
    throw new Error(
      payload.message ||
      payload.error ||
      payload.details ||
      raw ||
      `Failed to upload file (${uploadResponse.status})`,
    );
  }

  const signedResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${storageBucket}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        apikey: publicAnonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
    },
  );

  const signedPayload = await signedResponse.json().catch(() => ({}));
  const rawSignedUrl =
    signedPayload?.signedURL || signedPayload?.signedUrl || signedPayload?.signed_url || null;
  const fileUrl =
    typeof rawSignedUrl === 'string'
      ? (/^https?:\/\//i.test(rawSignedUrl) ? rawSignedUrl : `${supabaseUrl}/storage/v1${rawSignedUrl}`)
      : null;

  try {
    const authUser = await getCurrentAuthUser();
    await restRequest<any[]>(
      'files',
      'select=*',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          submission_id: null,
          type: fileType,
          file_name: file.name,
          mime_type: file.type,
          url: fileUrl,
          storage_bucket: storageBucket,
          storage_path: storagePath,
          uploaded_by: authUser.id,
        }),
      },
    );
  } catch {
    // Storage is the source of truth for profile assets; metadata is best-effort
    // so older schemas can still function.
  }

  return {
    success: true as const,
    url: fileUrl || undefined,
    fileName: storagePath,
  };
}

export async function getAnalytics() {
  try {
    return await apiRequest<{
      totalStudents: number;
      pendingRecords: number;
      approvedRecords: number;
      returnedRecords: number;
      totalSubmissions: number;
    }>('/functions/v1/server/analytics');
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const missingRoute = message.includes('404') || message.includes('not found');
    if (!missingRoute) {
      throw error;
    }
  }

  const [students, submissionStatuses] = await Promise.all([
    restRequest<any[]>('students', 'select=student_id'),
    restRequest<any[]>('submissions', 'select=status'),
  ]);

  const pendingRecords = (submissionStatuses || []).filter((row) => row.status === 'pending' || row.status === 'in_review').length;
  const approvedRecords = (submissionStatuses || []).filter((row) => row.status === 'approved').length;
  const returnedRecords = (submissionStatuses || []).filter((row) => row.status === 'returned').length;

  return {
    totalStudents: students?.length || 0,
    pendingRecords,
    approvedRecords,
    returnedRecords,
    totalSubmissions: submissionStatuses?.length || 0,
  };
}

export async function getStaffUsers() {
    return apiRequest<{ staff: Array<{ id: string; userId?: string; name: string; role: string; status: string; email: string }> }>(
    '/functions/v1/server/staff-users',
  );
}

export type AdminSystemSettings = {
  academicYear: string;
  semester: 'First Semester' | 'Second Semester' | 'Summer';
  acceptingSubmissions: boolean;
  requireTwoFactorAuth: boolean;
  sessionTimeoutMinutes: number;
  auditLogging: boolean;
  approvalEmailNotifications: boolean;
  pendingReviewReminders: boolean;
  autoArchiveAfterMonths: number;
};

const ADMIN_SYSTEM_SETTINGS_STORAGE_KEY = 'admin_system_settings_v1';
const ADMIN_SYSTEM_SETTINGS_SEMESTERS = new Set<AdminSystemSettings['semester']>([
  'First Semester',
  'Second Semester',
  'Summer',
]);
const ADMIN_SYSTEM_SETTINGS_TIMEOUT_OPTIONS = new Set([15, 30, 45, 60, 120]);
const ADMIN_SYSTEM_SETTINGS_ARCHIVE_OPTIONS = new Set([0, 12, 24, 36]);

function getDefaultAcademicYear() {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

export function createDefaultAdminSystemSettings(): AdminSystemSettings {
  return {
    academicYear: getDefaultAcademicYear(),
    semester: 'Second Semester',
    acceptingSubmissions: true,
    requireTwoFactorAuth: true,
    sessionTimeoutMinutes: 30,
    auditLogging: true,
    approvalEmailNotifications: true,
    pendingReviewReminders: true,
    autoArchiveAfterMonths: 12,
  };
}

function normalizeAdminSystemSettings(
  value?: Partial<AdminSystemSettings> | null,
): AdminSystemSettings {
  const defaults = createDefaultAdminSystemSettings();
  const academicYearValue = String(value?.academicYear ?? defaults.academicYear).trim();
  const parsedTimeout = Number(value?.sessionTimeoutMinutes);
  const parsedAutoArchive = Number(value?.autoArchiveAfterMonths);

  const academicYear =
    /^\d{4}-\d{4}$/.test(academicYearValue) &&
    Number(academicYearValue.slice(5, 9)) - Number(academicYearValue.slice(0, 4)) === 1
      ? academicYearValue
      : defaults.academicYear;
  const semester = ADMIN_SYSTEM_SETTINGS_SEMESTERS.has(value?.semester as AdminSystemSettings['semester'])
    ? (value?.semester as AdminSystemSettings['semester'])
    : defaults.semester;

  return {
    academicYear,
    semester,
    acceptingSubmissions:
      typeof value?.acceptingSubmissions === 'boolean'
        ? value.acceptingSubmissions
        : defaults.acceptingSubmissions,
    requireTwoFactorAuth:
      typeof value?.requireTwoFactorAuth === 'boolean'
        ? value.requireTwoFactorAuth
        : defaults.requireTwoFactorAuth,
    sessionTimeoutMinutes: ADMIN_SYSTEM_SETTINGS_TIMEOUT_OPTIONS.has(parsedTimeout)
      ? parsedTimeout
      : defaults.sessionTimeoutMinutes,
    auditLogging:
      typeof value?.auditLogging === 'boolean' ? value.auditLogging : defaults.auditLogging,
    approvalEmailNotifications:
      typeof value?.approvalEmailNotifications === 'boolean'
        ? value.approvalEmailNotifications
        : defaults.approvalEmailNotifications,
    pendingReviewReminders:
      typeof value?.pendingReviewReminders === 'boolean'
        ? value.pendingReviewReminders
        : defaults.pendingReviewReminders,
    autoArchiveAfterMonths: ADMIN_SYSTEM_SETTINGS_ARCHIVE_OPTIONS.has(parsedAutoArchive)
      ? parsedAutoArchive
      : defaults.autoArchiveAfterMonths,
  };
}

function readStoredAdminSystemSettings() {
  if (typeof window === 'undefined') {
    return createDefaultAdminSystemSettings();
  }

  const raw = window.localStorage.getItem(ADMIN_SYSTEM_SETTINGS_STORAGE_KEY);
  if (!raw) return createDefaultAdminSystemSettings();

  try {
    return normalizeAdminSystemSettings(JSON.parse(raw) as Partial<AdminSystemSettings>);
  } catch {
    return createDefaultAdminSystemSettings();
  }
}

function writeStoredAdminSystemSettings(settings: AdminSystemSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    ADMIN_SYSTEM_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeAdminSystemSettings(settings)),
  );
}

type AdminCreateAccountInput = {
  email: string;
  password: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  studentId?: string;
  department?: string;
  course?: string;
};

export async function createAdminAccount(input: AdminCreateAccountInput) {
    return apiRequest<{ success: boolean; userId?: string }>('/functions/v1/server/admin/create-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

type AdminCreateStaffInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  position?: string;
};

export async function createAdminStaff(input: AdminCreateStaffInput) {
    return apiRequest<{ success: boolean; userId?: string }>('/functions/v1/server/admin/create-staff', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function getUserAccounts() {
    return apiRequest<{ users: AdminUserAccount[] }>('/functions/v1/server/user-accounts');
}

export async function getAdminSystemSettings() {
  try {
    const settings = await apiRequest<AdminSystemSettings>('/functions/v1/server/admin/system-settings');
    const normalized = normalizeAdminSystemSettings(settings);
    writeStoredAdminSystemSettings(normalized);
    return normalized;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const missingRoute = message.includes('404') || message.includes('not found');
    if (!missingRoute) {
      throw error;
    }

    return readStoredAdminSystemSettings();
  }
}

export async function updateAdminSystemSettings(input: AdminSystemSettings) {
  const payload = normalizeAdminSystemSettings(input);

  try {
    const settings = await apiRequest<AdminSystemSettings>('/functions/v1/server/admin/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const normalized = normalizeAdminSystemSettings(settings);
    writeStoredAdminSystemSettings(normalized);
    return normalized;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const missingRoute = message.includes('404') || message.includes('not found');
    if (!missingRoute) {
      throw error;
    }

    writeStoredAdminSystemSettings(payload);
    return payload;
  }
}

export async function getArchivedUserAccounts() {
    return apiRequest<{ users: ArchivedUserAccount[] }>('/functions/v1/server/archived-accounts');
}

export async function archiveUserAccount(input: { userId: string; reason?: string }) {
    return apiRequest<{ success: boolean }>('/functions/v1/server/admin/archive-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deleteArchivedUserAccount(archiveId: string) {
    return apiRequest<{ success: boolean }>(`/functions/v1/server/admin/archive-account/${encodeURIComponent(archiveId)}`, {
    method: 'DELETE',
  });
}

export async function restoreArchivedUserAccount(archiveId: string) {
    return apiRequest<{ success: boolean }>(`/functions/v1/server/admin/restore-account/${encodeURIComponent(archiveId)}`, {
    method: 'POST',
  });
}
