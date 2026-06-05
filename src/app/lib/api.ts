
import {
  type AuthChangeEvent,
  createClient,
  type Session as SupabaseSession,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type {
  ApprovedStudentSummary,
  StaffDashboardOverview,
  SubmissionRecord,
  SubmissionSummaryRecord,
} from './record-types';
import {
  createDefaultAdminSystemSettings,
  isMissingKvStoreError,
  isMissingRouteError,
  normalizeAdminSystemSettings,
  readStoredAdminSystemSettings,
  writeStoredAdminSystemSettings,
} from './admin-system-settings';
import type { AdminSystemSettings } from './admin-system-settings';
import {
  getPasswordPolicyMessage,
  getRegistrationPasswordMessage,
  getPasswordStrengthResult,
  isRegistrationPasswordLongEnough,
  type PasswordPolicyUserInputs,
} from './password-policy';
import {
  assertPublicSupabaseConfig,
  configuredSiteUrl,
  publicAnonKey,
  PUBLIC_SUPABASE_CONFIG_ERROR,
  supabaseUrl,
} from './supabase-config';
import { normalizeYearLevel } from './student-year';
import {
  getAcademicYearRange,
  getDefaultAcademicYear,
  getLatestRecordForAcademicYear,
  getNextSubmissionSlot,
  getRecordAcademicYear,
  getSubmissionSlotLabel,
  MAX_SUBMISSION_CYCLE,
  normalizeAcademicYear,
  normalizeSubmissionSlot,
} from './academic-year';
import { beginTrackedUpload } from './upload-activity';
import type { LabUploadType, StudentProfileAssetUploadType } from './media-upload-types';

export { createDefaultAdminSystemSettings } from './admin-system-settings';
export type { AdminSystemSettings } from './admin-system-settings';

const GC_DOMAIN = 'gordoncollege.edu.ph';
export const AUTH_STORAGE_KEY = 'gc_supabase_session';
export const PASSWORD_RESET_COOLDOWN_SECONDS = 300;
const PASSWORD_RESET_COOLDOWN_KEY_PREFIX = 'lastPasswordResetEmailSent_';
const LAB_UPLOAD_IMAGE_OPTIMIZE_THRESHOLD_BYTES = 1 * 1024 * 1024;
const LAB_UPLOAD_TARGET_BYTES = 950 * 1024;
const LAB_UPLOAD_CANVAS_MAX_DIMENSIONS = [2200, 1800, 1500, 1200];
const LAB_UPLOAD_CANVAS_QUALITIES = [0.86, 0.76, 0.66, 0.56];
const CURRENT_ACADEMIC_YEAR_SETTING_KEY = 'current_academic_year';
let studentProfileAssetsRouteUnavailable = false;
let authClient: SupabaseClient | null = null;

function getAuthClient() {
  assertPublicSupabaseConfig();

  if (!authClient) {
    authClient = createClient(supabaseUrl, publicAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: true,
      },
    });
  }

  return authClient;
}

function getCanvasUploadFileName(fileName: string) {
  const cleanedName = String(fileName || 'lab-result').trim() || 'lab-result';
  const withoutExtension = cleanedName.includes('.') ? cleanedName.replace(/\.[^.]+$/, '') : cleanedName;
  return `${withoutExtension || 'lab-result'}.jpg`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function loadImageForUpload(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to read image for upload optimization.'));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function optimizeLabImageInBrowser(file: File) {
  if (
    file.size <= LAB_UPLOAD_IMAGE_OPTIMIZE_THRESHOLD_BYTES ||
    !file.type.toLowerCase().startsWith('image/') ||
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof URL === 'undefined'
  ) {
    return file;
  }

  try {
    const image = await loadImageForUpload(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return file;

    let bestBlob: Blob | null = null;
    for (const maxDimension of LAB_UPLOAD_CANVAS_MAX_DIMENSIONS) {
      const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) continue;

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of LAB_UPLOAD_CANVAS_QUALITIES) {
        const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (!blob) continue;
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
        if (blob.size <= LAB_UPLOAD_TARGET_BYTES) {
          return new File([blob], getCanvasUploadFileName(file.name), {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          });
        }
      }
    }

    if (bestBlob && bestBlob.size < file.size) {
      return new File([bestBlob], getCanvasUploadFileName(file.name), {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      });
    }
  } catch {
    return file;
  }

  return file;
}

export type UserRole = 'student' | 'staff' | 'admin' | 'super_admin';

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

export type SupabaseAuthUser = {
  id: string;
  email?: string;
  app_metadata?: {
    provider?: string | null;
  } | null;
  identities?: Array<{
    id?: string;
    provider?: string;
    identity_data?: {
      given_name?: string | null;
      family_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      full_name?: string | null;
      name?: string | null;
    } | null;
  }>;
  user_metadata?: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    given_name?: string | null;
    family_name?: string | null;
    name?: string | null;
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
    profile_id?: string | null;
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

export type StaffSignatureAsset = {
  signatureUrl: string | null;
  signatureFileName?: string | null;
};

export type StudentNotificationStatePayload = {
  items?: unknown[];
  snapshot?: Record<string, string>;
};

export type StudentNotificationRecord = {
  id: string;
  notificationKey: string;
  submissionId: string;
  status: 'approved' | 'returned';
  title: string;
  message: string;
  note?: string;
  actionLabel: string;
  actionPath: string;
  timestamp: string;
  yearLabel: string;
  read: boolean;
};

export type StudentNotificationSyncInput = Omit<StudentNotificationRecord, 'id'>;

export type StudentAnnouncement = {
  id: string;
  title: string;
  description: string;
  datePosted: string;
  imageUrl?: string | null;
  imagePath?: string | null;
  createdAt?: string | null;
};

export type AnnouncementUpsertInput = {
  title: string;
  description: string;
  datePosted?: string | null;
  isPublished?: boolean;
  imagePath?: string | null;
};

export type StaffSubmissionSummaryFilters = {
  searchQuery?: string;
  statusFilter?: string;
  departmentFilter?: string;
  yearFilter?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type StaffApprovedStudentFilters = {
  searchQuery?: string;
  departmentFilter?: string;
  yearFilter?: string;
  courseFilter?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
};

export type StudentProfileUpdateInput = {
  studentId?: string | null;
  firstName: string;
  lastName: string;
  middleInitial: string;
  department: string;
  course: string;
  yearLevel: string;
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
  position?: string;
  phone: string;
  applyAcrossRoles?: boolean;
};

export type AcademicYearSetting = {
  key: typeof CURRENT_ACADEMIC_YEAR_SETTING_KEY;
  value: string;
  academicYear: string;
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

export type SuperAdminAdministrator = {
  userId: string;
  id: string;
  name: string;
  email?: string;
  role: 'Administrator';
  roleKey: 'admin';
  status: 'Active';
  createdAt?: string;
  lastActive?: string;
};

export type SuperAdminArchivedAdministrator = {
  archiveId: string;
  userId: string;
  id: string;
  name: string;
  email?: string;
  role: 'Administrator';
  roleKey: 'admin';
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

function formatAcademicYearSettingValue(value: string) {
  return `SY ${normalizeAcademicYear(value)}`;
}

function isMissingSystemSettingsError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    message.includes('system_settings') ||
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
}

function buildAcademicYearSetting(value?: string | null): AcademicYearSetting {
  const academicYear = normalizeAcademicYear(
    value || readStoredAdminSystemSettings().academicYear || getDefaultAcademicYear(),
  );
  writeStoredAdminSystemSettings(
    normalizeAdminSystemSettings({
      ...readStoredAdminSystemSettings(),
      academicYear,
    }),
  );

  return {
    key: CURRENT_ACADEMIC_YEAR_SETTING_KEY,
    value: formatAcademicYearSettingValue(academicYear),
    academicYear,
  };
}

function normalizeNamePart(value?: string | null) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function splitFullNameParts(fullName?: string | null) {
  const parts = String(fullName || '').split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: null, lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: parts[0] || null, lastName: null };
  }
  return {
    firstName: parts.slice(0, -1).join(' ').trim() || null,
    lastName: parts.slice(-1).join(' ').trim() || null,
  };
}

function nameTokensMatchSuffix(value: string, suffix: string) {
  const valueParts = String(value || '').split(/\s+/).filter(Boolean);
  const suffixParts = String(suffix || '').split(/\s+/).filter(Boolean);
  if (!valueParts.length || !suffixParts.length || suffixParts.length >= valueParts.length) {
    return false;
  }
  return suffixParts.every((part, index) => (
    valueParts[valueParts.length - suffixParts.length + index]?.toLowerCase() === part.toLowerCase()
  ));
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

function deriveNamePartsFromUser(user?: SupabaseAuthUser | null) {
  const isGoogleUser = isGoogleAuthUser(user);
  const googleIdentityData =
    (Array.isArray(user?.identities)
      ? user.identities.find((identity) => String(identity?.provider || '').trim().toLowerCase() === 'google')?.identity_data
      : null) || null;
  const identityFirstName = normalizeNamePart(
    googleIdentityData?.given_name
    || googleIdentityData?.first_name,
  );
  const identityLastName = normalizeNamePart(
    googleIdentityData?.family_name
    || googleIdentityData?.last_name,
  );
  const fullName = normalizeNamePart(
    user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || googleIdentityData?.full_name
    || googleIdentityData?.name,
  );
  if (isGoogleUser && fullName) {
    if (identityLastName && nameTokensMatchSuffix(fullName, identityLastName)) {
      const fullNameParts = fullName.split(/\s+/).filter(Boolean);
      const lastNameParts = identityLastName.split(/\s+/).filter(Boolean);
      return {
        firstName: fullNameParts.slice(0, fullNameParts.length - lastNameParts.length).join(' ').trim() || identityFirstName,
        lastName: identityLastName,
      };
    }
    if (identityFirstName && identityLastName) {
      return { firstName: identityFirstName, lastName: identityLastName };
    }
    return splitFullNameParts(fullName);
  }

  const firstName = normalizeNamePart(
    user?.user_metadata?.first_name
    || user?.user_metadata?.given_name,
  );
  const lastName = normalizeNamePart(
    user?.user_metadata?.last_name
    || user?.user_metadata?.family_name,
  );

  if (firstName || lastName) {
    return { firstName, lastName };
  }

  if (!fullName) {
    return { firstName: null, lastName: null };
  }

  const splitNames = splitFullNameParts(fullName);
  return {
    firstName: splitNames.firstName || firstName,
    lastName: splitNames.lastName || lastName,
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

export function isDoctorPosition(position?: string | null) {
  if (!position) return false;
  return ['clinic doctor', 'doctor'].includes(position.trim().toLowerCase());
}

export function getRoleLabel(role?: string | null, position?: string | null) {
  if (role === 'super_admin') return 'Super Admin';
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
const STUDENT_PROFILE_ASSETS_CACHE_TTL_MS = 60_000;

type TimedValue<T> = {
  value: T;
  expiresAt: number;
};

const _meCache = new Map<string, TimedValue<AuthMe>>();
const _mePromiseCache = new Map<string, Promise<AuthMe>>();
const _studentProfileAssetsCache = new Map<string, TimedValue<StudentProfileAssets>>();
const _studentProfileAssetsPromiseCache = new Map<string, Promise<StudentProfileAssets>>();
let _studentProfileAssetsCacheVersion = 0;

function getMeCacheKey(token?: string | null) {
  return `me:${token || getAccessToken() || 'anon'}`;
}

function invalidateMeCache() {
  _meCache.clear();
  _mePromiseCache.clear();
}

function getStudentProfileAssetsCacheKey(studentId?: string | null, profileId?: string | null, token?: string | null) {
  return [
    'student-profile-assets',
    token || getAccessToken() || 'anon',
    String(studentId || '').trim(),
    String(profileId || '').trim(),
  ].join(':');
}

function invalidateStudentProfileAssetsCache() {
  _studentProfileAssetsCacheVersion += 1;
  _studentProfileAssetsCache.clear();
  _studentProfileAssetsPromiseCache.clear();
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
  invalidateStudentProfileAssetsCache();
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

class ApiRequestError extends Error {
  status: number;

  body: string;

  constructor(message: string, status: number, body = '') {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = body;
  }
}

async function apiRequest<T>(path: string, options: RequestOptions = {}, _retried = false): Promise<T> {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error(PUBLIC_SUPABASE_CONFIG_ERROR);
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

    throw new ApiRequestError(message, response.status, rawBody);
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

async function restCount(table: string, query = '', token?: string | null) {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error(PUBLIC_SUPABASE_CONFIG_ERROR);
  }

  const encodedTable = encodeURIComponent(table);
  const path = `/rest/v1/${encodedTable}${query ? `?${query}` : ''}`;
  const resolvedToken = token ?? (await getValidAccessToken());
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: 'GET',
    headers: {
      apikey: publicAnonKey,
      Authorization: `Bearer ${resolvedToken || publicAnonKey}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(raw || `Count request failed (${response.status})`);
  }

  const contentRange = response.headers.get('content-range') || '';
  const total = Number.parseInt(contentRange.split('/')[1] || '0', 10);
  return Number.isFinite(total) ? total : 0;
}

async function authRequest<T>(path: string, options: RequestOptions = {}, _retried = false): Promise<T> {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error(PUBLIC_SUPABASE_CONFIG_ERROR);
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
  if (error instanceof ApiRequestError && error.status >= 500) return true;

  const message = error.message.toLowerCase();
  const isMissingRoute = message.includes('404') || message.includes('not found');
  const isSchemaCacheError = message.includes('schema cache') && message.includes('students');
  const isYearLevelMissing = message.includes('year_level') && message.includes('students');
  const isInternalServerError = message.includes('internal server error');
  const isServerFetchFailure =
    message.includes('failed to fetch records') ||
    message.includes('failed to fetch certificate records') ||
    message.includes('failed to fetch submissions') ||
    message.includes('failed to fetch submission');
  return isMissingRoute || isSchemaCacheError || isYearLevelMissing || isInternalServerError || isServerFetchFailure;
}

function isMissingStaffSignatureUrlColumnError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('signature_url') && message.includes('staff_users');
}

async function restRequestStaffUsers(queryWithSignature: string, queryLegacy?: string) {
  try {
    return await restRequest<any[]>('staff_users', queryWithSignature);
  } catch (error) {
    if (!isMissingStaffSignatureUrlColumnError(error)) {
      throw error;
    }

    const fallbackQuery = queryLegacy || queryWithSignature.replace(/,signature_url/g, '').replace(/signature_url,?/g, '');
    return restRequest<any[]>('staff_users', fallbackQuery);
  }
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

function toAuthSession(session: SupabaseSession | null): AuthSession | null {
  if (!session?.access_token) return null;

  return normalizeSessionTimestamps({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
    user: session.user
      ? {
          id: session.user.id,
          email: session.user.email || undefined,
        }
      : undefined,
  });
}

export type SupabaseAuthStateChangeEvent = AuthChangeEvent;

export function onSupabaseAuthStateChange(
  callback: (
    event: SupabaseAuthStateChangeEvent,
    session: AuthSession | null,
    user: SupabaseAuthUser | null,
  ) => void,
) {
  return getAuthClient().auth.onAuthStateChange((event, session) => {
    callback(
      event,
      toAuthSession(session),
      session?.user ? (session.user as unknown as SupabaseAuthUser) : null,
    );
  });
}

export async function getSupabaseAuthSession() {
  const { data, error } = await getAuthClient().auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return {
    session: toAuthSession(data.session),
    user: data.session?.user ? (data.session.user as unknown as SupabaseAuthUser) : null,
  };
}

export async function clearSupabaseAuthSession() {
  const { error } = await getAuthClient().auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncSupabaseAuthSession(session: AuthSession | null) {
  if (!session?.access_token || !session.refresh_token) {
    return null;
  }

  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error) {
    throw new Error(error.message);
  }

  return toAuthSession(data.session);
}

export async function updateCurrentSessionPassword(
  newPassword: string,
  userInputs?: PasswordPolicyUserInputs,
) {
  const password = String(newPassword || '');
  const result = getPasswordStrengthResult(password, userInputs);
  if (!result.isStrongEnough) {
    throw new Error(getPasswordPolicyMessage(result));
  }

  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}

export async function updateUserPassword(
  newPassword: string,
  token?: string | null,
  userInputs?: PasswordPolicyUserInputs,
) {
  const password = String(newPassword || '');
  const result = getPasswordStrengthResult(password, userInputs);
  if (!result.isStrongEnough) {
    throw new Error(getPasswordPolicyMessage(result));
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

function mapStaffMeasurements(row: any, examinedBySignatureUrl?: string | null) {
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
    examinedBySignatureUrl: normalizeStorageFileUrl(examinedBySignatureUrl || null),
    updatedAt: row.updated_at || null,
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

function normalizeProfileAssetType(file: any) {
  const rawType = String(file?.type || '').trim().toLowerCase();
  const bucket = String(file?.storage_bucket || '').trim().toLowerCase();
  const haystack = [
    rawType,
    file?.file_name,
    file?.storage_path,
    file?.url,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');

  if (
    rawType === 'staff_signature' ||
    rawType === 'staff-signature' ||
    bucket === 'staff_signature' ||
    bucket === 'staff_signatures' ||
    haystack.includes('staff_signature') ||
    haystack.includes('staff-signature') ||
    haystack.includes('staff_signatures') ||
    haystack.includes('staff-signatures')
  ) {
    return '';
  }

  if (['photo', 'profile', 'profile_photo', 'student_photo'].includes(rawType)) return 'photo';
  if (['signature', 'student_signature', 'student-signature'].includes(rawType)) return 'signature';

  if (bucket === 'profile') return 'photo';
  if (bucket === 'student_signature') return 'signature';

  if (
    haystack.includes('student_signature') ||
    /(^|[\/_\-\s])signature([._\-\s]|$)/.test(haystack) ||
    /(^|[\/_\-\s])sign([._\-\s]|$)/.test(haystack)
  ) {
    return 'signature';
  }

  if (
    haystack.includes('profile') ||
    haystack.includes('photo') ||
    haystack.includes('1x1') ||
    haystack.includes('picture')
  ) {
    return 'photo';
  }

  return '';
}

function normalizeProfileAssetRows(files: any[] | null | undefined) {
  return (files || [])
    .map((file) => {
      const type = normalizeProfileAssetType(file);
      return type ? { ...file, type } : null;
    })
    .filter(Boolean);
}

function normalizeStaffSignatureRows(files: any[] | null | undefined) {
  return (files || [])
    .map((file) => {
      const rawType = String(file?.type || '').trim().toLowerCase();
      const bucket = String(file?.storage_bucket || '').trim().toLowerCase();
      const haystack = [
        rawType,
        bucket,
        file?.file_name,
        file?.storage_path,
        file?.url,
      ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
      const isStaffSignature =
        rawType === 'staff_signature' ||
        rawType === 'staff-signature' ||
        bucket === 'staff_signature' ||
        bucket === 'staff_signatures' ||
        haystack.includes('staff_signature') ||
        haystack.includes('staff-signature') ||
        haystack.includes('staff_signatures') ||
        haystack.includes('staff-signatures');

      return isStaffSignature ? { ...file, type: 'staff_signature' } : null;
    })
    .filter(Boolean);
}

function buildStaffSignatureAssetFromRow(staff: any) {
  const signatureUrl = normalizeStorageFileUrl(staff?.signature_url || null);
  if (!signatureUrl || !staff?.id || !staff?.profile_id) return null;

  return {
    id: `staff-user-signature-${staff.id}`,
    submission_id: null,
    type: 'staff_signature',
    file_name: null,
    storage_bucket: null,
    storage_path: null,
    mime_type: null,
    uploaded_at: null,
    uploaded_by: staff.profile_id,
    url: signatureUrl,
  };
}

function buildStudentProfileAssetFromRow(student: any, type: 'photo' | 'signature') {
  const url =
    type === 'photo'
      ? normalizeStorageFileUrl(student?.profile_photo_url || null)
      : normalizeStorageFileUrl(student?.signature_url || null);
  if (!url) return null;

  return {
    id: `student-${type}-${student?.student_id || student?.profile_id || 'asset'}`,
    submission_id: null,
    type,
    file_name:
      type === 'photo'
        ? student?.profile_photo_file_name || null
        : student?.signature_file_name || null,
    storage_bucket: null,
    storage_path: null,
    mime_type: null,
    uploaded_at: student?.media_updated_at || null,
    uploaded_by: student?.profile_id || null,
    url,
  };
}

function buildLabFileAssetFromRow(row: any, type: string) {
  const url = normalizeStorageFileUrl(row?.file_url || null);
  if (!url) return null;

  return {
    id: row?.file_id || `${type}-${row?.submission_id || 'file'}`,
    submission_id: row?.submission_id || null,
    type,
    file_name: row?.file_name || null,
    storage_bucket: null,
    storage_path: null,
    mime_type: row?.mime_type || null,
    uploaded_at: row?.media_updated_at || null,
    uploaded_by: null,
    url,
  };
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
  const trimmed = String(url || '').trim();
  if (!trimmed) return undefined;
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  try {
    const hostname = new URL(trimmed).hostname.toLowerCase();
    return hostname === 'res.cloudinary.com' || hostname.endsWith('.cloudinary.com')
      ? trimmed
      : undefined;
  } catch {
    return undefined;
  }
}

const cloudinaryCloudName = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();

function isCloudinaryFileRow(file: any) {
  const provider = String(file?.storage_provider || '').trim().toLowerCase();
  const publicId = String(file?.cloudinary_public_id || '').trim();
  const url = String(file?.url || '').trim();
  return provider === 'cloudinary' || Boolean(publicId) || /res\.cloudinary\.com/i.test(url);
}

function buildCloudinaryDeliveryUrl(file: any) {
  const url = normalizeStorageFileUrl(file?.url || null);
  if (url && /^https?:\/\//i.test(url)) return url;
  const publicId = String(file?.cloudinary_public_id || '').trim();
  if (!publicId || !cloudinaryCloudName) return null;
  const resourceType = String(file?.cloudinary_resource_type || 'image').trim() || 'image';
  const version = String(file?.cloudinary_version || '').trim();
  const encodedPublicId = publicId
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const versionPath = version ? `v${version}/` : '';
  return `https://res.cloudinary.com/${cloudinaryCloudName}/${resourceType}/upload/${versionPath}${encodedPublicId}`;
}

function formatStaffDisplayName(staff?: any) {
  const fullName = [normalizeNamePart(staff?.first_name), normalizeNamePart(staff?.last_name)]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (fullName) return fullName;

  return normalizeNamePart(staff?.name);
}

const CLEARANCE_SIGNATORY_NAMES = ['GERALD S. BERNAL, MD', 'ARMANDO TAMAYO, MD'] as const;

function normalizeSignatureName(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b(m\.?\s*d\.?|doctor|dr\.?|rn|r\.?\s*n\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isClearanceSignatoryName(value?: string | null) {
  const normalized = normalizeSignatureName(value);
  return Boolean(
    normalized &&
    CLEARANCE_SIGNATORY_NAMES.some((name) => normalizeSignatureName(name) === normalized),
  );
}

function staffNameMatchesExaminer(staff: any, examinerName?: string | null) {
  const normalizedExaminer = normalizeSignatureName(examinerName);
  if (!staff || !normalizedExaminer) return false;

  const candidates = [
    formatStaffDisplayName(staff),
    staff?.name,
    [staff?.first_name, staff?.middle_initial, staff?.last_name].filter(Boolean).join(' '),
    [staff?.first_name, staff?.last_name].filter(Boolean).join(' '),
  ]
    .map((value) => normalizeSignatureName(value))
    .filter(Boolean);

  if (candidates.includes(normalizedExaminer)) return true;

  const examinerTokens = new Set(normalizedExaminer.split(' ').filter(Boolean));
  const firstName = normalizeSignatureName(staff?.first_name).split(' ')[0] || '';
  const lastNameParts = normalizeSignatureName(staff?.last_name).split(' ').filter(Boolean);
  const lastName = lastNameParts[lastNameParts.length - 1] || '';

  return Boolean(firstName && lastName && examinerTokens.has(firstName) && examinerTokens.has(lastName));
}

function resolveExaminerSignature(row: any, staffMeasurements: any, related: Record<string, any>) {
  const examinedBy = staffMeasurements?.examined_by || '';
  const certificate = related.certificates?.[row.id] || {};
  const staffRows = related.staffRows || [];
  const matchedStaff = staffRows.find(
    (staff: any) => staffNameMatchesExaminer(staff, examinedBy) && related.staffSignaturesByStaffId?.[staff.id],
  );
  if (matchedStaff) {
    return related.staffSignaturesByStaffId[matchedStaff.id];
  }

  const examinerStaffId = staffMeasurements?.updated_by || row.reviewed_by || certificate?.issued_by || null;
  const examinerStaff = examinerStaffId ? related.reviewers?.[examinerStaffId] : null;
  const canUseStaffIdSignature =
    !String(examinedBy || '').trim() ||
    isClearanceSignatoryName(examinedBy) ||
    staffNameMatchesExaminer(examinerStaff, examinedBy);
  return canUseStaffIdSignature && examinerStaffId
    ? related.staffSignaturesByStaffId?.[examinerStaffId]
    : null;
}

function mapSubmission(row: any, related: Record<string, any>) {
  const student = related.students[row.student_id] || {};
  const emergencyContact = related.emergencyContacts[row.id];
  const medicalHistory = related.medicalHistory[row.id];
  const staffMeasurements = related.staffMeasurements[row.id];
  const reviewer = related.reviewers[row.reviewed_by] || null;
  const examinerSignature = resolveExaminerSignature(row, staffMeasurements, related);
  const xray = related.xray[row.id];
  const cbc = related.cbc[row.id];
  const urinalysis = related.urinalysis[row.id];
  const certificate = related.certificates[row.id];
  const files = latestFilesByType(related.files[row.id] || []);
  const submissionFiles = related.files[row.id] || [];
  const xrayFileFromLab = xray?.file_id ? related.filesById[xray.file_id] : null;
  const cbcFileFromLab = cbc?.file_id ? related.filesById[cbc.file_id] : null;
  const urinalysisFileFromLab = urinalysis?.file_id ? related.filesById[urinalysis.file_id] : null;
  const directXrayFile = buildLabFileAssetFromRow(xray, 'xray');
  const directCbcFile = buildLabFileAssetFromRow(cbc, 'cbc');
  const directUrinalysisFile = buildLabFileAssetFromRow(urinalysis, 'urinalysis');
  const xrayFileByHint = findLabFileByHint(submissionFiles, 'xray');
  const cbcFileByHint = findLabFileByHint(submissionFiles, 'cbc');
  const urinalysisFileByHint = findLabFileByHint(submissionFiles, 'urinalysis');
  const genericLabFile = findGenericLabFile(submissionFiles);
  const metadataProfileAssets = student?.profile_id ? related.profileAssetsByProfileId?.[student.profile_id] || {} : {};
  const directPhoto = buildStudentProfileAssetFromRow(student, 'photo');
  const directSignature = buildStudentProfileAssetFromRow(student, 'signature');
  const profileAssets = {
    ...metadataProfileAssets,
    ...(directPhoto ? { photo: directPhoto } : {}),
    ...(directSignature ? { signature: directSignature } : {}),
  };

  return {
    id: row.id,
    studentId: row.student_id,
    firstName: row.first_name || student.first_name || '',
    lastName: row.last_name || student.last_name || '',
    middleInitial: row.middle_initial || student.middle_initial || '',
    course: row.course || student.course || row.department || student.department || '',
    department: row.department || student.department || row.course || student.course || '',
    year: String(row.year_level || ''),
    academicYear: row.academic_year || undefined,
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    reviewedByStaffId: row.reviewed_by || undefined,
    reviewedByName: formatStaffDisplayName(reviewer) || undefined,
    reviewedByPosition: normalizeNamePart(reviewer?.position) || undefined,
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
    staffMeasurements: mapStaffMeasurements(staffMeasurements, examinerSignature?.url),
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
          licenseNo: certificate.license_no,
          signatoryName: certificate.signatory_name,
        }
      : undefined,
    photoUrl: normalizeStorageFileUrl(files.photo?.url || profileAssets.photo?.url),
    signatureUrl: normalizeStorageFileUrl(files.signature?.url || profileAssets.signature?.url),
    xrayFileUrl: normalizeStorageFileUrl(directXrayFile?.url || xrayFileFromLab?.url || files.xray?.url || xrayFileByHint?.url || genericLabFile?.url),
    cbcFileUrl: normalizeStorageFileUrl(directCbcFile?.url || cbcFileFromLab?.url || files.cbc?.url || cbcFileByHint?.url || genericLabFile?.url),
    urinalysisFileUrl: normalizeStorageFileUrl(directUrinalysisFile?.url || urinalysisFileFromLab?.url || files.urinalysis?.url || urinalysisFileByHint?.url || genericLabFile?.url),
    certificatePdfUrl: normalizeStorageFileUrl(files.certificate?.url || certificate?.pdf_url),
    labTestLocation: row.lab_test_location || '',
    otherClinicName: row.lab_test_clinic || '',
    cbcTestClinic: row.cbc_test_clinic || '',
    urinalysisTestClinic: row.urinalysis_test_clinic || '',
    xrayTestClinic: row.xray_test_clinic || '',
  };
}

async function loadRelatedData(rows: any[]) {
  const submissionIds = rows.map((row) => row.id);
  const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];
  const reviewerIds = [...new Set(rows.map((row) => row.reviewed_by).filter(Boolean))];
  const idList = submissionIds.map((id) => encodeURIComponent(id)).join(',');
  const studentIdList = studentIds.map((id) => encodeURIComponent(id)).join(',');
  const reviewerIdList = reviewerIds.map((id) => encodeURIComponent(id)).join(',');

  const token = getAccessToken();
  const [
    students,
    emergencyContacts,
    medicalHistory,
    staffMeasurements,
    reviewers,
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
    reviewerIds.length
      ? restRequestStaffUsers(
          `id=in.(${reviewerIdList})&select=id,profile_id,first_name,last_name,middle_initial,position,name,signature_url`,
          `id=in.(${reviewerIdList})&select=id,profile_id,first_name,last_name,middle_initial,position,name`,
        )
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

  const initialReviewerRows = reviewers || [];
  const knownReviewerIds = new Set(
    initialReviewerRows.map((staff) => String(staff?.id || '').trim()).filter(Boolean),
  );
  const measurementUpdaterIds = [
    ...new Set(
      (staffMeasurements || [])
        .map((row) => String(row?.updated_by || '').trim())
        .filter(Boolean),
    ),
  ];
  const certificateIssuerIds = [
    ...new Set(
      (certificates || [])
        .map((row) => String(row?.issued_by || '').trim())
        .filter(Boolean),
    ),
  ];
  const missingReviewerIds = [
    ...new Set([...measurementUpdaterIds, ...certificateIssuerIds]),
  ].filter((id) => !knownReviewerIds.has(id));
  const missingReviewerIdList = missingReviewerIds.map((id) => encodeURIComponent(id)).join(',');
  const extraReviewers = missingReviewerIds.length
    ? await restRequestStaffUsers(
        `id=in.(${missingReviewerIdList})&select=id,profile_id,first_name,last_name,middle_initial,position,name,signature_url`,
        `id=in.(${missingReviewerIdList})&select=id,profile_id,first_name,last_name,middle_initial,position,name`,
      ).catch(() => [])
    : [];
  const examinedByNames = [
    ...new Set(
      (staffMeasurements || [])
        .map((row) => String(row?.examined_by || '').trim())
        .filter(Boolean),
    ),
  ];
  const examinerDirectory = examinedByNames.length
    ? await restRequestStaffUsers(
        'select=id,profile_id,first_name,last_name,middle_initial,position,name,is_active,signature_url&is_active=eq.true&limit=200',
        'select=id,profile_id,first_name,last_name,middle_initial,position,name,is_active&is_active=eq.true&limit=200',
      ).catch(() => [])
    : [];
  const staffRows = Object.values(
    [...initialReviewerRows, ...(extraReviewers || []), ...(examinerDirectory || [])].reduce<Record<string, any>>((acc, staff: any) => {
      if (staff?.id) acc[staff.id] = staff;
      return acc;
    }, {} as Record<string, any>),
  ) as any[];
  const staffProfileIds = [...new Set(staffRows.map((staff) => staff?.profile_id).filter(Boolean))];
  const staffProfileIdList = staffProfileIds.map((id) => encodeURIComponent(id)).join(',');
  const staffSignatureFilesRaw = staffProfileIds.length
    ? await restRequest<any[]>(
        'files',
        `select=id,submission_id,type,file_name,storage_bucket,storage_path,storage_provider,cloudinary_public_id,cloudinary_resource_type,cloudinary_version,cloudinary_folder,mime_type,uploaded_at,url,uploaded_by&uploaded_by=in.(${staffProfileIdList})&submission_id=is.null&order=uploaded_at.desc`,
      ).catch(() => [])
    : [];
  const normalizedStaffSignatureFiles = normalizeStaffSignatureRows(
    await normalizeFileRows(staffSignatureFilesRaw, token),
  );
  const staffSignaturesByProfileId = normalizedStaffSignatureFiles.reduce((acc, file) => {
    if (!file?.uploaded_by) return acc;
    const existing = acc[file.uploaded_by];
    if (!existing || new Date(file.uploaded_at || 0).getTime() > new Date(existing.uploaded_at || 0).getTime()) {
      acc[file.uploaded_by] = file;
    }
    return acc;
  }, {} as Record<string, any>);
  const staffSignaturesByStaffId = staffRows.reduce((acc, staff) => {
    if (!staff?.id || !staff?.profile_id) return acc;
    const signature = buildStaffSignatureAssetFromRow(staff) || staffSignaturesByProfileId[staff.profile_id];
    if (signature) acc[staff.id] = signature;
    return acc;
  }, {} as Record<string, any>);

  const studentRows = students || [];
  const studentProfileIds = [
    ...new Set(
      studentRows
        .filter((student) => !student?.profile_photo_url || !student?.signature_url)
        .map((student) => student?.profile_id)
        .filter(Boolean),
    ),
  ];
  const studentProfileIdList = studentProfileIds.map((id) => encodeURIComponent(id)).join(',');
  const profileAssetFilesRaw = studentProfileIds.length
    ? await restRequest<any[]>(
        'files',
        `uploaded_by=in.(${studentProfileIdList})&submission_id=is.null&order=uploaded_at.desc`,
      ).catch(() => [])
    : [];
  const normalizedProfileAssetFiles = normalizeProfileAssetRows(
    await normalizeFileRows(profileAssetFilesRaw, token),
  );
  const profileAssetsByUploadedBy = normalizedProfileAssetFiles.reduce((acc, file) => {
    if (!file?.uploaded_by) return acc;
    acc[file.uploaded_by] = acc[file.uploaded_by] || [];
    acc[file.uploaded_by].push(file);
    return acc;
  }, {} as Record<string, any[]>);
  const profileAssetsByProfileId = studentRows.reduce((acc, student) => {
    if (!student?.profile_id) return acc;
    const metadataFiles = profileAssetsByUploadedBy[student.profile_id] || [];
    const latest = latestFilesByType(metadataFiles);
    const directPhoto = buildStudentProfileAssetFromRow(student, 'photo');
    const directSignature = buildStudentProfileAssetFromRow(student, 'signature');
    acc[student.profile_id] = {
      ...latest,
      ...(directPhoto ? { photo: directPhoto } : {}),
      ...(directSignature ? { signature: directSignature } : {}),
    };
    return acc;
  }, {} as Record<string, Record<string, any>>);

  const byKey = (rowsData: any[] | null | undefined, key: string) =>
    (rowsData || []).reduce((acc, item) => {
      acc[item[key]] = item;
      return acc;
    }, {} as Record<string, any>);

  const filesBySubmission = (normalizedFiles || []).reduce((acc, file) => {
    acc[file.submission_id] = acc[file.submission_id] || [];
    acc[file.submission_id].push(file);
    return acc;
  }, {} as Record<string, any[]>);

  return {
    students: byKey(students, 'student_id'),
    emergencyContacts: byKey(emergencyContacts, 'submission_id'),
    medicalHistory: byKey(medicalHistory, 'submission_id'),
    staffMeasurements: byKey(staffMeasurements, 'submission_id'),
    reviewers: byKey(staffRows, 'id'),
    staffRows,
    staffSignaturesByStaffId,
    xray: byKey(xray, 'submission_id'),
    cbc: byKey(cbc, 'submission_id'),
    urinalysis: byKey(urinalysis, 'submission_id'),
    certificates: byKey(certificates, 'submission_id'),
    profileAssetsByProfileId,
    files: filesBySubmission,
    filesById: byId(normalizedFiles),
  };
}

async function loadCertificatePreviewRelatedData(rows: any[]) {
  const submissionIds = rows.map((row) => row.id).filter(Boolean);
  const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];
  const reviewerIds = [...new Set(rows.map((row) => row.reviewed_by).filter(Boolean))];
  const idList = submissionIds.map((id) => encodeURIComponent(id)).join(',');
  const studentIdList = studentIds.map((id) => encodeURIComponent(id)).join(',');
  const reviewerIdList = reviewerIds.map((id) => encodeURIComponent(id)).join(',');
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
    submissionAssetFilesRaw,
    reviewers,
  ] = await Promise.all([
    studentIds.length
      ? restRequest<any[]>(
        'students',
          `student_id=in.(${studentIdList})&select=student_id,profile_id,first_name,last_name,middle_initial,department,course,age,sex,birthday,civil_status,contact_number,address,profile_photo_url,profile_photo_file_name,signature_url,signature_file_name,media_updated_at`,
        )
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
      ? restRequest<any[]>(
          'files',
          `submission_id=in.(${idList})&type=in.(photo,signature)&order=uploaded_at.desc`,
        ).catch(() => [])
      : Promise.resolve([]),
    reviewerIds.length
      ? restRequestStaffUsers(
          `id=in.(${reviewerIdList})&select=id,profile_id,first_name,last_name,middle_initial,position,name,signature_url`,
          `id=in.(${reviewerIdList})&select=id,profile_id,first_name,last_name,middle_initial,position,name`,
        ).catch(() => [])
      : Promise.resolve([]),
  ]);

  const normalizedSubmissionAssetFiles = await normalizeFileRows(submissionAssetFilesRaw, token);
  const initialReviewerRows = reviewers || [];
  const knownReviewerIds = new Set(
    initialReviewerRows.map((staff) => String(staff?.id || '').trim()).filter(Boolean),
  );
  const measurementUpdaterIds = [
    ...new Set(
      (staffMeasurements || [])
        .map((row) => String(row?.updated_by || '').trim())
        .filter(Boolean),
    ),
  ];
  const certificateIssuerIds = [
    ...new Set(
      (certificates || [])
        .map((row) => String(row?.issued_by || '').trim())
        .filter(Boolean),
    ),
  ];
  const missingReviewerIds = [
    ...new Set([...measurementUpdaterIds, ...certificateIssuerIds]),
  ].filter((id) => !knownReviewerIds.has(id));
  const missingReviewerIdList = missingReviewerIds
    .map((id) => encodeURIComponent(id))
    .join(',');
  const extraReviewers = missingReviewerIds.length
    ? await restRequestStaffUsers(
        `id=in.(${missingReviewerIdList})&select=id,profile_id,first_name,last_name,middle_initial,position,name,signature_url`,
        `id=in.(${missingReviewerIdList})&select=id,profile_id,first_name,last_name,middle_initial,position,name`,
      ).catch(() => [])
    : [];
  const examinedByNames = [
    ...new Set(
      (staffMeasurements || [])
        .map((row) => String(row?.examined_by || '').trim())
        .filter(Boolean),
    ),
  ];
  const examinerDirectory = examinedByNames.length
    ? await restRequestStaffUsers(
        'select=id,profile_id,first_name,last_name,middle_initial,position,name,is_active,signature_url&is_active=eq.true&limit=200',
        'select=id,profile_id,first_name,last_name,middle_initial,position,name,is_active&is_active=eq.true&limit=200',
      ).catch(() => [])
    : [];
  const staffRows = Object.values(
    [...initialReviewerRows, ...(extraReviewers || []), ...(examinerDirectory || [])].reduce<Record<string, any>>((acc, staff: any) => {
      if (staff?.id) acc[staff.id] = staff;
      return acc;
    }, {} as Record<string, any>),
  ) as any[];
  const staffProfileIds = [...new Set(staffRows.map((staff) => staff?.profile_id).filter(Boolean))];
  const staffProfileIdList = staffProfileIds
    .map((id) => encodeURIComponent(id))
    .join(',');
  const staffSignatureFilesRaw = staffProfileIds.length
    ? await restRequest<any[]>(
        'files',
        `select=id,submission_id,type,file_name,storage_bucket,storage_path,storage_provider,cloudinary_public_id,cloudinary_resource_type,cloudinary_version,cloudinary_folder,mime_type,uploaded_at,url,uploaded_by&uploaded_by=in.(${staffProfileIdList})&submission_id=is.null&order=uploaded_at.desc`,
      ).catch(() => [])
    : [];
  const normalizedStaffSignatureFiles = normalizeStaffSignatureRows(
    await normalizeFileRows(staffSignatureFilesRaw, token),
  );
  const staffSignaturesByProfileId = normalizedStaffSignatureFiles.reduce((acc, file) => {
    if (!file?.uploaded_by) return acc;
    const existing = acc[file.uploaded_by];
    if (!existing || new Date(file.uploaded_at || 0).getTime() > new Date(existing.uploaded_at || 0).getTime()) {
      acc[file.uploaded_by] = file;
    }
    return acc;
  }, {} as Record<string, any>);
  const staffSignaturesByStaffId = staffRows.reduce((acc, staff) => {
    if (!staff?.id || !staff?.profile_id) return acc;
    const signature = buildStaffSignatureAssetFromRow(staff) || staffSignaturesByProfileId[staff.profile_id];
    if (signature) acc[staff.id] = signature;
    return acc;
  }, {} as Record<string, any>);
  const studentRows = students || [];
  const studentProfileIds = [
    ...new Set(
      studentRows
        .filter((student) => !student?.profile_photo_url || !student?.signature_url)
        .map((student) => student?.profile_id)
        .filter(Boolean),
    ),
  ];
  const studentProfileIdList = studentProfileIds
    .map((id) => encodeURIComponent(id))
    .join(',');
  const profileAssetFilesRaw = studentProfileIds.length
    ? await restRequest<any[]>(
        'files',
        `uploaded_by=in.(${studentProfileIdList})&submission_id=is.null&order=uploaded_at.desc`,
      ).catch(() => [])
    : [];
  const normalizedProfileAssetFiles = normalizeProfileAssetRows(
    await normalizeFileRows(profileAssetFilesRaw, token),
  );
  const profileAssetsByUploadedBy = normalizedProfileAssetFiles.reduce((acc, file) => {
    if (!file?.uploaded_by) return acc;
    acc[file.uploaded_by] = acc[file.uploaded_by] || [];
    acc[file.uploaded_by].push(file);
    return acc;
  }, {} as Record<string, any[]>);
  const profileAssetsByProfileId = studentRows.reduce((acc, student) => {
    if (!student?.profile_id) return acc;
    const metadataFiles = profileAssetsByUploadedBy[student.profile_id] || [];
    const latest = latestFilesByType(metadataFiles);
    const directPhoto = buildStudentProfileAssetFromRow(student, 'photo');
    const directSignature = buildStudentProfileAssetFromRow(student, 'signature');
    acc[student.profile_id] = {
      ...latest,
      ...(directPhoto ? { photo: directPhoto } : {}),
      ...(directSignature ? { signature: directSignature } : {}),
    };
    return acc;
  }, {} as Record<string, Record<string, any>>);

  const byKey = (rowsData: any[] | null | undefined, key: string) =>
    (rowsData || []).reduce((acc, item) => {
      acc[item[key]] = item;
      return acc;
    }, {} as Record<string, any>);

  const filesBySubmission = normalizedSubmissionAssetFiles.reduce((acc, file) => {
    acc[file.submission_id] = acc[file.submission_id] || [];
    acc[file.submission_id].push(file);
    return acc;
  }, {} as Record<string, any[]>);

  return {
    students: byKey(students, 'student_id'),
    emergencyContacts: byKey(emergencyContacts, 'submission_id'),
    medicalHistory: byKey(medicalHistory, 'submission_id'),
    staffMeasurements: byKey(staffMeasurements, 'submission_id'),
    reviewers: byKey(staffRows, 'id'),
    staffRows,
    staffSignaturesByStaffId,
    xray: byKey(xray, 'submission_id'),
    cbc: byKey(cbc, 'submission_id'),
    urinalysis: byKey(urinalysis, 'submission_id'),
    certificates: byKey(certificates, 'submission_id'),
    profileAssetsByProfileId,
    files: filesBySubmission,
    filesById: {} as Record<string, any>,
  };
}

async function getMappedCertificatePreviewSubmissions(studentId: string) {
  const normalizedStudentId = String(studentId || '').trim();
  if (!normalizedStudentId) return [] as SubmissionRecord[];

  const rows = await restRequest<any[]>(
    'submissions',
    `student_id=eq.${encodeURIComponent(normalizedStudentId)}&status=eq.approved&order=submitted_at.desc`,
  );
  if (!rows.length) return [] as SubmissionRecord[];

  const related = await loadCertificatePreviewRelatedData(rows);
  return rows.map((row: any) => mapSubmission(row, related)) as SubmissionRecord[];
}

async function getMappedSubmissions(query: string) {
  const rows = await restRequest<any[]>('submissions', query);
  const related = await loadRelatedData(rows || []);
  return (rows || []).map((row: any) => mapSubmission(row, related));
}

export async function authenticateWithPassword(email: string, password: string) {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error(PUBLIC_SUPABASE_CONFIG_ERROR);
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
    const message =
      payload.msg ||
      payload.error_description ||
      payload.error ||
      `Failed to sign in (${response.status})`;

    if (String(message).trim().toLowerCase().includes('user is banned')) {
      throw new Error('This account is not available. Contact the administrator for assistance.');
    }

    throw new Error(message);
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

  if (!isRegistrationPasswordLongEnough(password)) {
    throw new Error(getRegistrationPasswordMessage());
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

  const emailRedirectTo = buildAuthRedirectUrl('/auth?mode=signin&recovery=1');
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
  const supabase = supabaseUrl && publicAnonKey ? getAuthClient() : null;
  if (!supabaseUrl || !publicAnonKey) {
    try {
      await supabase?.auth.signOut();
    } catch {
      // Best effort clear for the in-memory client session.
    }
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
    try {
      await supabase?.auth.signOut();
    } catch {
      // Best effort clear for the in-memory client session.
    }
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
      const canSelfProvisionStudent = isValidStudentRegistrationEmail(user.email);
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
      let resolvedProfile = profile;

      if (!resolvedProfile) {
        if (!canSelfProvisionStudent) {
          throw new Error('Profile not found for authenticated user.');
        }
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
                role: 'student',
                email: normalizedEmail,
                student_id: derivedStudentId,
                first_name: firstName,
                last_name: lastName,
              }),
            },
          )
        )[0];
      } else if (
        resolvedProfile.role === 'student' &&
        canSelfProvisionStudent &&
        (
          resolvedProfile.student_id !== derivedStudentId
          || resolvedProfile.email !== normalizedEmail
          || (firstName && !resolvedProfile.first_name)
          || (lastName && !resolvedProfile.last_name)
          || (
            isGoogleAuthUser(user)
            && (
              (firstName && normalizeNamePart(resolvedProfile.first_name) !== firstName)
              || (lastName && normalizeNamePart(resolvedProfile.last_name) !== lastName)
            )
          )
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
                first_name: (
                  isGoogleAuthUser(user)
                    ? (firstName || resolvedProfile.first_name || null)
                    : (resolvedProfile.first_name || firstName || null)
                ),
                last_name: (
                  isGoogleAuthUser(user)
                    ? (lastName || resolvedProfile.last_name || null)
                    : (resolvedProfile.last_name || lastName || null)
                ),
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

      let resolvedStudent = studentRows[0] || null;
      if (
        resolvedStudent &&
        resolvedProfile.role === 'student' &&
        canSelfProvisionStudent &&
        isGoogleAuthUser(user) &&
        (
          (firstName && normalizeNamePart(resolvedStudent.first_name) !== firstName)
          || (lastName && normalizeNamePart(resolvedStudent.last_name) !== lastName)
          || (!resolvedStudent.profile_id && resolvedStudent.student_id === derivedStudentId)
        )
      ) {
        const studentMatchQuery = resolvedStudent.profile_id
          ? `profile_id=eq.${user.id}`
          : `student_id=eq.${encodeURIComponent(derivedStudentId || '')}`;
        const patchedStudents = await restRequest<any[]>(
          'students',
          `${studentMatchQuery}&select=*`,
          {
            method: 'PATCH',
            token,
            headers: {
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify({
              profile_id: resolvedStudent.profile_id || user.id,
              first_name: firstName || resolvedStudent.first_name || null,
              last_name: lastName || resolvedStudent.last_name || null,
            }),
          },
        );
        resolvedStudent = patchedStudents[0] || resolvedStudent;
      }

      resolvedMe = {
        profile: resolvedProfile,
        student: resolvedStudent,
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

async function normalizeFileRows(files: any[] | null | undefined, _token?: string | null) {
  return Promise.all(
    (files || []).map(async (file) => {
      if (isCloudinaryFileRow(file)) {
        return {
          ...file,
          storage_provider: 'cloudinary',
          storage_bucket: file?.storage_bucket || null,
          url: buildCloudinaryDeliveryUrl(file) || null,
        };
      }

      return { ...file, url: null };
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
    yearLevel: data.yearLevel || '',
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

  try {
    const result = await apiRequest<{ success: true; profile: any; student: any }>(
      '/functions/v1/server/student-profile',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    invalidateMeCache();
    return {
      success: true as const,
      profile: result.profile || me.profile,
      student: result.student || me.student,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const shouldFallback =
      shouldFallbackToRest(error) ||
      message.includes('failed to update student profile') ||
      message.includes('internal server error');

    if (!shouldFallback) {
      throw error;
    }
  }

  const profileRows = await restRequest<any[]>(
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

  const normalizedYearLevel = normalizeYearLevel(payload.yearLevel);
  const parsedAge = Number.parseInt(String(payload.age || '').trim(), 10);
  const normalizedAge = Number.isFinite(parsedAge) ? parsedAge : null;

  const studentRows = await restRequest<any[]>(
    'students',
    'on_conflict=student_id&select=*',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        student_id: studentId,
        profile_id: me.profile.id,
        first_name: payload.firstName || null,
        last_name: payload.lastName || null,
        middle_initial: payload.middleInitial || null,
        department: payload.department || null,
        course: payload.course || null,
        year_level: normalizedYearLevel,
        age: normalizedAge,
        sex: payload.sex || null,
        birthday: payload.birthday || null,
        civil_status: payload.civilStatus || null,
        contact_number: payload.contactNumber || null,
        address: payload.address || null,
      }),
    },
  );

  invalidateMeCache();
  return {
    success: true as const,
    profile: profileRows[0] || me.profile,
    student: studentRows[0] || me.student,
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

function mapSubmissionSlotRow(row: any): SubmissionRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    middleInitial: row.middle_initial || '',
    course: row.course || row.department || '',
    department: row.department || row.course || '',
    year: String(row.year_level || ''),
    academicYear: row.academic_year || undefined,
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  } as SubmissionRecord;
}

async function getSubmissionSlotRows(studentId: string) {
  const normalizedStudentId = String(studentId || '').trim();
  if (!normalizedStudentId) return [] as SubmissionRecord[];

  try {
    const rows = await restRequest<any[]>(
      'submissions',
      `select=id,student_id,first_name,last_name,middle_initial,course,department,year_level,academic_year,status,submitted_at,updated_at&student_id=eq.${encodeURIComponent(normalizedStudentId)}&order=submitted_at.desc`,
    );
    return (rows || []).map(mapSubmissionSlotRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('academic_year')) throw error;
  }

  const rows = await restRequest<any[]>(
    'submissions',
    `select=id,student_id,first_name,last_name,middle_initial,course,department,year_level,status,submitted_at,updated_at&student_id=eq.${encodeURIComponent(normalizedStudentId)}&order=submitted_at.desc`,
  );
  return (rows || []).map(mapSubmissionSlotRow);
}

async function resolveActiveAcademicYear(value?: unknown) {
  if (value) return normalizeAcademicYear(value);
  try {
    const settings = await getActiveAcademicYearSettings();
    return normalizeAcademicYear(settings.academicYear);
  } catch {
    return getDefaultAcademicYear();
  }
}

export async function updateStaffProfile(data: StaffProfileUpdateInput) {
  const payload = {
    name: String(data.name || '').trim(),
    email: normalizeEmail(data.email) || '',
    position: String(data.position || '').trim(),
    phone: String(data.phone || '').trim(),
    applyAcrossRoles: data.applyAcrossRoles !== false,
  };

  if (!payload.name || !payload.email) {
    throw new Error('Name and email are required.');
  }

  try {
    const result = await apiRequest<{
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
    invalidateMeCache();
    return result;
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
        position: me.staff?.position || payload.position || null,
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

export async function getStaffSignature(): Promise<StaffSignatureAsset> {
  try {
    const payload = await apiRequest<{
      success: boolean;
      signatureUrl?: string | null;
      signatureFileName?: string | null;
    }>('/functions/v1/server/staff-signature');

    return {
      signatureUrl: normalizeStorageFileUrl(payload.signatureUrl || null) || null,
      signatureFileName: payload.signatureFileName || null,
    };
  } catch (error) {
    if (!shouldFallbackToRest(error)) {
      throw error;
    }
  }

  const token = getAccessToken();
  const me = await getMe();
  const profileId = String(me.profile.id || '').trim();
  if (!profileId) {
    return { signatureUrl: null, signatureFileName: null };
  }

  const staffRows = await restRequestStaffUsers(
    `profile_id=eq.${encodeURIComponent(profileId)}&select=signature_url&limit=1`,
    `profile_id=eq.${encodeURIComponent(profileId)}&select=id&limit=1`,
  ).catch(() => []);
  const directSignatureUrl = normalizeStorageFileUrl(staffRows[0]?.signature_url || null);
  if (directSignatureUrl) {
    return {
      signatureUrl: directSignatureUrl,
      signatureFileName: null,
    };
  }

  const rows = await restRequest<any[]>(
    'files',
    `select=id,type,file_name,storage_bucket,storage_path,storage_provider,cloudinary_public_id,cloudinary_resource_type,cloudinary_version,cloudinary_folder,mime_type,uploaded_at,url,uploaded_by&uploaded_by=eq.${encodeURIComponent(profileId)}&submission_id=is.null&order=uploaded_at.desc&limit=50`,
  ).catch(() => []);
  const latest = latestFilesByType(normalizeStaffSignatureRows(await normalizeFileRows(rows, token))).staff_signature;

  return {
    signatureUrl: normalizeStorageFileUrl(latest?.url || null) || null,
    signatureFileName: latest?.file_name || null,
  };
}

export async function uploadStaffSignature(file: File) {
  const token = getAccessToken();
  if (!token || !supabaseUrl || !publicAnonKey) {
    throw new Error('You must be signed in to upload files.');
  }

  const prepare = await apiRequest<CloudinaryUploadTicket>(
    '/functions/v1/server/staff-signature/prepare',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }),
    },
  );
  assertCloudinaryUploadTicket(prepare, 'Staff signature upload');

  const cloudinary = await uploadToCloudinary(prepare, file);
  const payload = await apiRequest<{ success: true; signatureUrl?: string | null; signatureFileName?: string | null }>(
    '/functions/v1/server/staff-signature/complete',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: prepare.mimeType || file.type || 'application/octet-stream',
        cloudinary,
      }),
    },
  );

  return {
    success: true as const,
    signatureUrl: normalizeStorageFileUrl(payload.signatureUrl || null) || undefined,
    signatureFileName: payload.signatureFileName || undefined,
  };
}

const CLINIC_INTERNAL_LAB_SOURCE = 'James L. Gordon Hospital';

function deriveSubmissionLabSourceMetadata(data: any) {
  const explicitLocation = String(data?.labTestLocation || '').trim().toLowerCase();
  const explicitClinic = String(data?.otherClinicName || '').trim();
  const normalizedLocation =
    explicitLocation === 'jlgh' || explicitLocation === 'other'
      ? (explicitLocation as 'jlgh' | 'other')
      : '';

  if (normalizedLocation === 'jlgh') {
    return {
      labTestLocation: 'jlgh' as const,
      otherClinicName: '',
    };
  }

  if (normalizedLocation === 'other' && explicitClinic) {
    return {
      labTestLocation: 'other' as const,
      otherClinicName: explicitClinic,
    };
  }

  const resolvedSources = [
    String(data?.cbcTestClinic || '').trim(),
    String(data?.urinalysisTestClinic || '').trim(),
    String(data?.xrayTestClinic || '').trim(),
  ].filter(Boolean);

  if (!resolvedSources.length) {
    return {
      labTestLocation: normalizedLocation || '',
      otherClinicName: explicitClinic,
    };
  }

  const externalSource = resolvedSources.find(
    (source) => source.toLowerCase() !== CLINIC_INTERNAL_LAB_SOURCE.toLowerCase(),
  );

  if (!externalSource) {
    return {
      labTestLocation: 'jlgh' as const,
      otherClinicName: '',
    };
  }

  return {
    labTestLocation: 'other' as const,
    otherClinicName: explicitClinic || externalSource,
  };
}

export async function submitMedicalRecord(data: any) {
  const me = await getMe();
  const studentId = me.profile.student_id || data.studentId;
  if (!studentId) {
    throw new Error('Student ID is required.');
  }
  const requestedAcademicYearLevel = normalizeYearLevel(data.yearLevel);
  if (!requestedAcademicYearLevel) {
    throw new Error('Academic year level is required.');
  }
  const requestedRecordCycle = normalizeSubmissionSlot(data.recordCycle ?? data.year);
  if (!requestedRecordCycle) {
    throw new Error('Record cycle is required.');
  }
  const activeAcademicYear = await resolveActiveAcademicYear(data.academicYear);
  const existingRecords = await getSubmissionSlotRows(studentId);
  const existingCurrentAcademicYearRecord = getLatestRecordForAcademicYear(existingRecords, activeAcademicYear);
  const expectedRecordCycle = getNextSubmissionSlot(existingRecords, activeAcademicYear);

  if (!expectedRecordCycle) {
    throw new Error(`All ${MAX_SUBMISSION_CYCLE} record cycles have already been used.`);
  }

  if (requestedRecordCycle !== expectedRecordCycle) {
    throw new Error(
      `This submission must be filed under ${getSubmissionSlotLabel(expectedRecordCycle)} for SY ${activeAcademicYear}.`,
    );
  }

  const latestAcademicYearStatus = String(existingCurrentAcademicYearRecord?.status || '').toLowerCase();
  if (latestAcademicYearStatus) {
    throw new Error(
      latestAcademicYearStatus === 'returned'
        ? `Your SY ${activeAcademicYear} submission was returned. Please edit and resubmit that record.`
        : `A submission for SY ${activeAcademicYear} already exists and is currently ${latestAcademicYearStatus}.`,
    );
  }

  const studentPayload = {
    student_id: studentId,
    profile_id: me.profile.id,
    first_name: data.firstName || null,
    last_name: data.lastName || null,
    middle_initial: data.middleInitial || null,
    department: data.department || null,
    course: data.course || null,
    year_level: requestedAcademicYearLevel,
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

  const resolvedLabSource = deriveSubmissionLabSourceMetadata(data);

  const submissionInsertPayload = {
    student_id: studentId,
    year_level: String(requestedRecordCycle),
    academic_year: activeAcademicYear,
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
    cbc_test_clinic: data.cbcTestClinic || null,
    urinalysis_test_clinic: data.urinalysisTestClinic || null,
    xray_test_clinic: data.xrayTestClinic || null,
    lab_test_location: resolvedLabSource.labTestLocation || null,
    lab_test_clinic: resolvedLabSource.labTestLocation === 'other' ? resolvedLabSource.otherClinicName || null : null,
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
    const hasMissingColumns =
      message.includes('academic_year') ||
      message.includes('lab_test_location') ||
      message.includes('lab_test_clinic');
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
          academic_year: undefined,
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
  const requestedAcademicYearLevel = normalizeYearLevel(data.yearLevel);
  if (!requestedAcademicYearLevel) {
    throw new Error('Academic year level is required.');
  }
  const requestedRecordCycle = normalizeSubmissionSlot(data.recordCycle ?? data.year);
  if (!requestedRecordCycle) {
    throw new Error('Record cycle is required.');
  }

  let existingSubmission: any[] = [];
  try {
    existingSubmission = await restRequest<any[]>(
      'submissions',
      `select=id,student_id,year_level,academic_year,submitted_at&id=eq.${encodeURIComponent(recordId)}&limit=1`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('academic_year')) throw error;
    existingSubmission = await restRequest<any[]>(
      'submissions',
      `select=id,student_id,year_level,submitted_at&id=eq.${encodeURIComponent(recordId)}&limit=1`,
    );
  }
  const submissionRow = existingSubmission?.[0];
  if (!submissionRow) {
    throw new Error('Medical record not found.');
  }
  if (String(submissionRow.student_id || '').trim() !== studentId) {
    throw new Error('You can only update your own medical record.');
  }

  const existingRecordCycle = normalizeSubmissionSlot(submissionRow.year_level);
  if (existingRecordCycle && existingRecordCycle !== requestedRecordCycle) {
    throw new Error('The record cycle for an existing submission cannot be changed.');
  }
  const activeAcademicYear = normalizeAcademicYear(
    getRecordAcademicYear(
      {
        academicYear: submissionRow.academic_year || undefined,
        submittedAt: submissionRow.submitted_at,
      } as SubmissionRecord,
      data.academicYear || (await resolveActiveAcademicYear(data.academicYear)),
    ),
  );

  const studentPayload = {
    student_id: studentId,
    profile_id: me.profile.id,
    first_name: data.firstName || null,
    last_name: data.lastName || null,
    middle_initial: data.middleInitial || null,
    department: data.department || null,
    course: data.course || null,
    year_level: requestedAcademicYearLevel,
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

  const resolvedLabSource = deriveSubmissionLabSourceMetadata(data);

  const submissionPatchPayload = {
    status: data.status || undefined,
    year_level: String(requestedRecordCycle),
    academic_year: activeAcademicYear,
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
    cbc_test_clinic: data.cbcTestClinic || null,
    urinalysis_test_clinic: data.urinalysisTestClinic || null,
    xray_test_clinic: data.xrayTestClinic || null,
    lab_test_location: resolvedLabSource.labTestLocation || undefined,
    lab_test_clinic: resolvedLabSource.labTestLocation === 'other' ? resolvedLabSource.otherClinicName || null : null,
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
    const hasMissingAcademicYearColumn = message.includes('academic_year');

    if (
      !isResubmittedConstraintError &&
      !hasMissingLabSourceColumns &&
      !hasMissingAcademicYearColumn
    ) {
      throw error;
    }

    // Backward-compatible fallback for databases where either:
    // 1) status check does not include "resubmitted"
    // 2) lab source columns are not migrated yet
    // Note: Test clinic columns (cbc_test_clinic, urinalysis_test_clinic, xray_test_clinic) should always exist
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
          academic_year: undefined,
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


type GetStudentRecordsOptions = {
  includeProfileAssetsFallback?: boolean;
};

function mapStudentRecordSummary(row: any, emergencyContactsBySubmission: Record<string, any>) {
  const emergencyContact = emergencyContactsBySubmission[row.id];
  return {
    id: row.id,
    studentId: row.student_id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    middleInitial: row.middle_initial || '',
    course: row.course || row.department || '',
    department: row.department || row.course || '',
    year: String(row.year_level || ''),
    academicYear: row.academic_year || undefined,
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    reviewedByStaffId: row.reviewed_by || undefined,
    staffNotes: row.staff_notes,
    age: row.age ? String(row.age) : '',
    sex: row.sex || '',
    birthday: row.birthday || '',
    civilStatus: row.civil_status || '',
    contactNumber: row.contact_number || '',
    address: row.address || '',
    allergyDetails: row.allergy_details,
    hadOperation: row.had_operation,
    operationDetails: row.operation_details,
    emergencyContact: emergencyContact
      ? {
          name: emergencyContact.name,
          relationship: emergencyContact.relationship,
          phone: emergencyContact.phone,
          address: emergencyContact.address,
        }
      : undefined,
    labTestLocation: row.lab_test_location || '',
    otherClinicName: row.lab_test_clinic || '',
    cbcTestClinic: row.cbc_test_clinic || '',
    urinalysisTestClinic: row.urinalysis_test_clinic || '',
    xrayTestClinic: row.xray_test_clinic || '',
  } satisfies SubmissionRecord;
}

export async function getStudentRecordSummaries(studentId?: string) {
  const targetStudentId = String(studentId || '').trim();
  const fallbackStudentId = targetStudentId || (await getMe()).profile.student_id;
  if (!fallbackStudentId) {
    return { records: [] as SubmissionRecord[] };
  }

  try {
    const rows = await restRequest<any[]>(
      'submissions',
      `select=id,student_id,first_name,last_name,middle_initial,course,department,year_level,academic_year,status,reviewed_by,submitted_at,updated_at,staff_notes,age,sex,birthday,civil_status,contact_number,address,allergy_details,had_operation,operation_details,lab_test_location,lab_test_clinic,cbc_test_clinic,urinalysis_test_clinic,xray_test_clinic&student_id=eq.${encodeURIComponent(fallbackStudentId)}&order=submitted_at.desc`,
    );
    const submissionIds = (rows || []).map((row) => row.id).filter(Boolean);
    const idList = submissionIds.map((id) => encodeURIComponent(id)).join(',');
    const emergencyContacts = submissionIds.length
      ? await restRequest<any[]>(
          'emergency_contacts',
          `select=submission_id,name,relationship,phone,address&submission_id=in.(${idList})`,
        ).catch(() => [])
      : [];
    const emergencyContactsBySubmission = (emergencyContacts || []).reduce((acc, contact) => {
      acc[contact.submission_id] = contact;
      return acc;
    }, {} as Record<string, any>);

    return {
      records: (rows || []).map((row) => mapStudentRecordSummary(row, emergencyContactsBySubmission)),
    };
  } catch {
    return getStudentRecords(fallbackStudentId, { includeProfileAssetsFallback: false });
  }
}

export async function getStudentRecords(studentId?: string, options: GetStudentRecordsOptions = {}) {
  const targetStudentId = String(studentId || '').trim();
  const fallbackStudentId = targetStudentId || (await getMe()).profile.student_id;
  const includeProfileAssetsFallback = options.includeProfileAssetsFallback ?? true;
  if (!fallbackStudentId) {
    return { records: [] };
  }

  const attachProfileAssetsFallback = async (records: SubmissionRecord[]) => {
    if (!includeProfileAssetsFallback || !Array.isArray(records) || records.length === 0) {
      return records;
    }

    const hasMissingAssets = records.some(
      (record) => !String(record?.photoUrl || '').trim() || !String(record?.signatureUrl || '').trim(),
    );
    if (!hasMissingAssets) {
      return records;
    }

    try {
      const me = await getMe();
      const assets = await getStudentProfileAssets(
        fallbackStudentId,
        me?.student?.profile_id || me?.profile?.id || null,
      );
      const photoUrl = String(assets?.photoUrl || '').trim();
      const signatureUrl = String(assets?.signatureUrl || '').trim();

      if (!photoUrl && !signatureUrl) return records;

      return records.map((record) => ({
        ...record,
        photoUrl: String(record?.photoUrl || '').trim() || photoUrl || undefined,
        signatureUrl: String(record?.signatureUrl || '').trim() || signatureUrl || undefined,
      }));
    } catch {
      return records;
    }
  };

  try {
    const response = await apiRequest<{ records: SubmissionRecord[] }>(
      `/functions/v1/server/student-records/${encodeURIComponent(fallbackStudentId)}`,
    );
    const records = Array.isArray(response?.records) ? response.records : [];
    return { records: await attachProfileAssetsFallback(records) };
  } catch (routeError) {
    try {
      const records = await getMappedSubmissions(
        `student_id=eq.${encodeURIComponent(fallbackStudentId)}&order=submitted_at.desc`,
      );
      return { records: await attachProfileAssetsFallback(records as SubmissionRecord[]) };
    } catch (restError) {
      if (!shouldFallbackToRest(routeError) && routeError instanceof Error) {
        throw routeError;
      }
      throw restError;
    }
  }
}

export async function getStudentAnnouncements() {
  const rows = await restRequest<any[]>(
    'announcements',
    'select=id,title,description,date_posted,image_path,created_at&is_published=eq.true&order=date_posted.desc.nullslast,created_at.desc',
  );

  const announcements = await Promise.all(
    (rows || []).map((row) => {
      const rawPath = String(row?.image_path || '').trim();
      const absoluteImageUrl = /^https?:\/\//i.test(rawPath) ? normalizeStorageFileUrl(rawPath) : null;

      return {
        id: String(row?.id || ''),
        title: String(row?.title || '').trim(),
        description: String(row?.description || '').trim(),
        datePosted: String(row?.date_posted || row?.created_at || ''),
        imageUrl: absoluteImageUrl || null,
        imagePath: rawPath || null,
        createdAt: row?.created_at ? String(row.created_at) : null,
      } satisfies StudentAnnouncement;
    }),
  );

  return {
    announcements: announcements.filter((item) => item.id && item.title),
  };
}

export async function getManagedAnnouncements() {
  const rows = await restRequest<any[]>(
    'announcements',
    'select=id,title,description,date_posted,image_path,is_published,created_by,created_at,updated_at&order=date_posted.desc.nullslast,created_at.desc',
  );

  const announcements = await Promise.all(
    (rows || []).map((row) => {
      const rawPath = String(row?.image_path || '').trim();
      const absoluteImageUrl = /^https?:\/\//i.test(rawPath) ? normalizeStorageFileUrl(rawPath) : null;

      return {
        id: String(row?.id || ''),
        title: String(row?.title || '').trim(),
        description: String(row?.description || '').trim(),
        datePosted: String(row?.date_posted || row?.created_at || ''),
        imageUrl: absoluteImageUrl || null,
        imagePath: rawPath || null,
        createdBy: String(row?.created_by || ''),
        isPublished: Boolean(row?.is_published),
      };
    }),
  );

  return {
    announcements: announcements.filter((item) => item.id),
  };
}

export async function createAnnouncement(payload: AnnouncementUpsertInput) {
  const authUser = await getCurrentAuthUser();
  const rows = await restRequest<any[]>(
    'announcements',
    'select=*',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        date_posted: payload.datePosted || new Date().toISOString().slice(0, 10),
        is_published: payload.isPublished ?? true,
        image_path: payload.imagePath || null,
        created_by: authUser.id,
      }),
    },
  );
  return rows?.[0] || null;
}

export async function updateAnnouncement(id: string, payload: AnnouncementUpsertInput) {
  const targetId = String(id || '').trim();
  if (!targetId) throw new Error('Announcement ID is required.');

  const rows = await restRequest<any[]>(
    'announcements',
    `id=eq.${encodeURIComponent(targetId)}&select=*`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        date_posted: payload.datePosted || new Date().toISOString().slice(0, 10),
        is_published: payload.isPublished ?? true,
        image_path: payload.imagePath || null,
      }),
    },
  );

  return rows?.[0] || null;
}

export async function deleteAnnouncement(id: string) {
  const targetId = String(id || '').trim();
  if (!targetId) throw new Error('Announcement ID is required.');

  await restRequest(
    'announcements',
    `id=eq.${encodeURIComponent(targetId)}`,
    {
      method: 'DELETE',
      headers: {
        Prefer: 'return=minimal',
      },
    },
  );
  return { success: true as const };
}

export async function uploadAnnouncementImage(file: File, ownerId: string) {
  const token = getAccessToken();
  const cleanedOwnerId = String(ownerId || '').trim();
  if (!token || !supabaseUrl || !publicAnonKey || !cleanedOwnerId) {
    throw new Error('You must be signed in to upload announcement images.');
  }

  const prepare = await apiRequest<CloudinaryUploadTicket>(
    '/functions/v1/server/announcement-image/prepare',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ownerId: cleanedOwnerId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }),
    },
  );
  assertCloudinaryUploadTicket(prepare, 'Announcement image upload');

  const cloudinary = await uploadToCloudinary(prepare, file);
  const payload = await apiRequest<{ success: true; imagePath?: string | null; imageUrl?: string | null }>(
    '/functions/v1/server/announcement-image/complete',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ownerId: cleanedOwnerId,
        fileName: file.name,
        mimeType: prepare.mimeType || file.type || 'application/octet-stream',
        cloudinary,
      }),
    },
  );

  const imagePath = normalizeStorageFileUrl(payload.imagePath || payload.imageUrl || cloudinary?.secure_url || null);
  if (!imagePath) {
    throw new Error('Cloudinary upload did not return an image URL.');
  }

  return { imagePath };
}

export async function getStaffDashboardOverview() {
  return apiRequest<StaffDashboardOverview>('/functions/v1/server/staff/dashboard-overview');
}

export async function getStaffSubmissionSummaries(filters: StaffSubmissionSummaryFilters = {}) {
  const params = new URLSearchParams();
  const searchQuery = String(filters.searchQuery || '').trim();
  const statusFilter = String(filters.statusFilter || 'action_needed').trim();
  const departmentFilter = String(filters.departmentFilter || '').trim();
  const yearFilter = String(filters.yearFilter || '').trim();
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(filters.page || 1) || 1);
  const pageSize = Math.max(1, Number(filters.pageSize || 25) || 25);

  if (searchQuery) params.set('search', searchQuery);
  if (statusFilter) params.set('status', statusFilter);
  if (departmentFilter && departmentFilter !== 'all') params.set('department', departmentFilter);
  if (yearFilter && yearFilter !== 'all') params.set('year', yearFilter);
  params.set('sort', sortOrder);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  const response = await apiRequest<{
    items: SubmissionSummaryRecord[];
    total: number;
    page: number;
    pageSize: number;
    counts: {
      pending: number;
      inReview: number;
      returned: number;
      resubmitted: number;
      actionNeeded: number;
    };
  }>(`/functions/v1/server/staff/submission-summaries?${params.toString()}`);

  return response;
}

async function loadActiveStudentDirectory(studentIds: string[]) {
  const uniqueStudentIds = [
    ...new Set((studentIds || []).map((value) => String(value || '').trim()).filter(Boolean)),
  ];
  if (!uniqueStudentIds.length) {
    return {} as Record<string, any>;
  }

  const studentIdList = uniqueStudentIds
    .map((id) => encodeURIComponent(id))
    .join(',');
  const [students, archivedAccounts] = await Promise.all([
    restRequest<any[]>(
      'students',
      `student_id=in.(${studentIdList})&select=student_id,profile_id,first_name,last_name,middle_initial,department,course`,
    ).catch(() => []),
    restRequest<any[]>('archived_accounts', 'select=user_id').catch(() => []),
  ]);

  const archivedProfileIds = new Set(
    (archivedAccounts || []).map((row) => String(row?.user_id || '').trim()).filter(Boolean),
  );

  return (students || []).reduce((acc, student) => {
    const studentId = String(student?.student_id || '').trim();
    const profileId = String(student?.profile_id || '').trim();
    if (!studentId || !profileId || archivedProfileIds.has(profileId)) {
      return acc;
    }
    acc[studentId] = student;
    return acc;
  }, {} as Record<string, any>);
}

function normalizeApprovedStudentsDate(value?: string | null, endOfDay = false) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const iso = endOfDay ? `${raw}T23:59:59.999Z` : `${raw}T00:00:00.000Z`;
  const timestamp = new Date(iso).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

async function loadApprovedStudentsFromDatabase(
  filters: StaffApprovedStudentFilters = {},
) {
  const searchQuery = String(filters.searchQuery || '').trim().toLowerCase();
  const departmentFilter = String(filters.departmentFilter || '').trim();
  const yearFilter = String(filters.yearFilter || '').trim();
  const courseFilter = String(filters.courseFilter || '').trim();
  const page = Math.max(1, Number(filters.page || 1) || 1);
  const pageSize = Math.max(1, Number(filters.pageSize || 20) || 20);
  const fromDate = normalizeApprovedStudentsDate(filters.fromDate);
  const toDate = normalizeApprovedStudentsDate(filters.toDate, true);

  const approvedRows = await restRequest<any[]>(
    'submissions',
    'select=id,student_id,first_name,last_name,middle_initial,course,department,year_level,academic_year,status,submitted_at,updated_at&status=eq.approved&order=updated_at.desc',
  );

  const activeStudentsById = await loadActiveStudentDirectory(
    (approvedRows || []).map((row) => row.student_id),
  );
  const groups = new Map<string, any>();

  for (const row of approvedRows || []) {
    const studentId = String(row?.student_id || '').trim();
    const activeStudent = activeStudentsById[studentId];
    if (!studentId || !activeStudent) continue;

    const updatedTimestamp = new Date(row.updated_at || row.submitted_at || 0).getTime();
    if (fromDate && updatedTimestamp < fromDate) continue;
    if (toDate && updatedTimestamp > toDate) continue;

    const rowYear = String(row.year_level || '').trim();
    if (yearFilter && yearFilter !== 'all' && rowYear !== yearFilter) continue;

    const rowCourse = String(row.course || activeStudent.course || '').trim();
    if (courseFilter && courseFilter !== 'all' && rowCourse !== courseFilter) continue;

    const rowDepartment = String(row.department || activeStudent.department || '').trim();
    if (
      departmentFilter
      && departmentFilter !== 'all'
      && rowDepartment !== departmentFilter
      && !rowCourse.toLowerCase().includes(departmentFilter.toLowerCase())
    ) {
      continue;
    }

    if (searchQuery) {
      const haystack = [
        row.first_name,
        activeStudent.first_name,
        row.last_name,
        activeStudent.last_name,
        row.middle_initial,
        activeStudent.middle_initial,
        row.student_id,
        row.course,
        activeStudent.course,
      ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
      if (!haystack.includes(searchQuery)) continue;
    }

    const firstName = String(row.first_name || activeStudent.first_name || '').trim();
    const lastName = String(row.last_name || activeStudent.last_name || '').trim();
    const middleInitial = String(
      row.middle_initial || activeStudent.middle_initial || '',
    ).trim();
    const existing = groups.get(studentId);

    if (!existing) {
      groups.set(studentId, {
        studentId,
        firstName,
        lastName,
        middleInitial,
        course: rowCourse,
        department: rowDepartment,
        latestSubmittedAt: row.submitted_at,
        latestUpdatedAt: row.updated_at,
        approvedCount: 1,
        records: [
          {
            id: row.id,
            year: rowYear,
            submittedAt: row.submitted_at,
            updatedAt: row.updated_at,
          },
        ],
      });
      continue;
    }

    existing.approvedCount += 1;
    existing.records.push({
      id: row.id,
      year: rowYear,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
    });

    const existingTimestamp = new Date(
      existing.latestUpdatedAt || existing.latestSubmittedAt || 0,
    ).getTime();
    if (updatedTimestamp >= existingTimestamp) {
      existing.firstName = firstName;
      existing.lastName = lastName;
      existing.middleInitial = middleInitial;
      existing.course = rowCourse;
      existing.department = rowDepartment;
      existing.latestSubmittedAt = row.submitted_at;
      existing.latestUpdatedAt = row.updated_at;
    }
  }

  const students = Array.from(groups.values())
    .map((student) => ({
      ...student,
      records: student.records.sort((a: any, b: any) => {
        const yearDifference =
          Number.parseInt(a.year || '0', 10) - Number.parseInt(b.year || '0', 10);
        if (yearDifference !== 0) return yearDifference;
        return (
          new Date(b.updatedAt || b.submittedAt || 0).getTime()
          - new Date(a.updatedAt || a.submittedAt || 0).getTime()
        );
      }),
    }))
    .sort(
      (a, b) =>
        new Date(b.latestUpdatedAt || b.latestSubmittedAt || 0).getTime()
        - new Date(a.latestUpdatedAt || a.latestSubmittedAt || 0).getTime(),
    );

  const availableCourses = Array.from(
    new Set(
      students
        .map((student) => String(student.course || '').trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const total = students.length;
  const from = (page - 1) * pageSize;
  const paginatedStudents = students.slice(from, from + pageSize);

  return {
    students: paginatedStudents,
    availableCourses,
    total,
    page,
    pageSize,
  };
}

export async function getStaffApprovedStudents(filters: StaffApprovedStudentFilters = {}) {
  return loadApprovedStudentsFromDatabase(filters);
}

export async function getStaffCertificateRecords(studentId?: string) {
  const targetStudentId = String(studentId || '').trim();
  if (!targetStudentId) {
    return { records: [] as SubmissionRecord[] };
  }

  try {
    const response = await apiRequest<{ records: SubmissionRecord[] }>(
      `/functions/v1/server/staff/certificate-records/${encodeURIComponent(targetStudentId)}`,
    );
    return {
      records: Array.isArray(response?.records) ? response.records : [],
    };
  } catch (error) {
    if (!shouldFallbackToRest(error)) {
      throw error;
    }
  }

  const records = await getMappedCertificatePreviewSubmissions(targetStudentId);
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

export async function getStudentNotifications(studentId?: string) {
  const targetStudentId = String(studentId || '').trim();
  const query = targetStudentId ? `?studentId=${encodeURIComponent(targetStudentId)}` : '';

  return apiRequest<{ notifications: StudentNotificationRecord[] }>(
    `/functions/v1/server/student-notifications${query}`,
  );
}

export async function syncStudentNotifications(
  studentId: string,
  notifications: StudentNotificationSyncInput[],
) {
  const targetStudentId = String(studentId || '').trim();
  if (!targetStudentId) {
    return { notifications: [] as StudentNotificationRecord[] };
  }

  return apiRequest<{ notifications: StudentNotificationRecord[] }>(
    '/functions/v1/server/student-notifications/sync',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId: targetStudentId,
        notifications,
      }),
    },
  );
}

export async function updateStudentNotification(
  notificationId: string,
  updates: Pick<StudentNotificationRecord, 'read'>,
) {
  return apiRequest<{ notification: StudentNotificationRecord }>(
    `/functions/v1/server/student-notifications/${encodeURIComponent(notificationId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    },
  );
}

export async function markAllStudentNotificationsAsRead(studentId?: string) {
  const targetStudentId = String(studentId || '').trim();

  return apiRequest<{ success: boolean }>(
    '/functions/v1/server/student-notifications/mark-all-read',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId: targetStudentId || undefined,
      }),
    },
  );
}

export async function deleteStudentNotification(notificationId: string) {
  return apiRequest<{ success: boolean }>(
    `/functions/v1/server/student-notifications/${encodeURIComponent(notificationId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function clearStudentNotifications(studentId?: string) {
  const targetStudentId = String(studentId || '').trim();

  return apiRequest<{ success: boolean }>(
    '/functions/v1/server/student-notifications/clear',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId: targetStudentId || undefined,
      }),
    },
  );
}

export async function getStudentProfileAssets(studentId?: string, profileId?: string | null) {
  const token = getAccessToken();
  let resolvedStudentId = String(studentId || '').trim();
  let resolvedProfileId = String(profileId || '').trim();

  if (!resolvedStudentId || !resolvedProfileId) {
    const me = await getMe();
    resolvedStudentId = resolvedStudentId || me.student?.student_id || me.profile.student_id || '';
    resolvedProfileId = resolvedProfileId || me.student?.profile_id || me.profile.id || '';
  }

  const cacheKey = getStudentProfileAssetsCacheKey(resolvedStudentId, resolvedProfileId, token);
  const now = Date.now();
  const cached = _studentProfileAssetsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inFlight = _studentProfileAssetsPromiseCache.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const cacheVersion = _studentProfileAssetsCacheVersion;
  const requestPromise = (async () => {
    let resolvedAssets: StudentProfileAssets | null = null;
    let routeAssets: StudentProfileAssets | null = null;

    if (!studentProfileAssetsRouteUnavailable) {
      try {
        const query = resolvedStudentId ? `?studentId=${encodeURIComponent(resolvedStudentId)}` : '';
        const payload = await apiRequest<{
          success: boolean;
          photoUrl?: string | null;
          signatureUrl?: string | null;
          photoFileName?: string | null;
          signatureFileName?: string | null;
        }>(`/functions/v1/server/student-profile-assets${query}`);

        if (payload?.success) {
          routeAssets = {
            photoUrl: normalizeStorageFileUrl(payload.photoUrl) || null,
            signatureUrl: normalizeStorageFileUrl(payload.signatureUrl) || null,
            photoFileName: payload.photoFileName || null,
            signatureFileName: payload.signatureFileName || null,
          };
          if (routeAssets.photoUrl && routeAssets.signatureUrl) {
            resolvedAssets = routeAssets;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        if (message.includes('404') || message.includes('not found')) {
          studentProfileAssetsRouteUnavailable = true;
        }
        // Fall back to Cloudinary metadata rows when the route is unavailable.
      }
    }

    if (!resolvedAssets) {
      let assetRows: any[] = [];
      if (resolvedProfileId) {
        assetRows = await restRequest<any[]>(
          'files',
          `select=id,type,file_name,storage_bucket,storage_path,storage_provider,cloudinary_public_id,cloudinary_resource_type,cloudinary_version,cloudinary_folder,mime_type,uploaded_at,url&uploaded_by=eq.${encodeURIComponent(resolvedProfileId)}&submission_id=is.null&order=uploaded_at.desc&limit=50`,
        ).catch(() => []);
      }

      const normalizedAssetRows = normalizeProfileAssetRows(await normalizeFileRows(assetRows, token));
      const latestAssets = latestFilesByType(normalizedAssetRows);

      resolvedAssets = {
        photoUrl: routeAssets?.photoUrl || normalizeStorageFileUrl(latestAssets.photo?.url) || null,
        signatureUrl: routeAssets?.signatureUrl || normalizeStorageFileUrl(latestAssets.signature?.url) || null,
        photoFileName: routeAssets?.photoFileName || latestAssets.photo?.file_name || null,
        signatureFileName: routeAssets?.signatureFileName || latestAssets.signature?.file_name || null,
      };
    }

    if (cacheVersion === _studentProfileAssetsCacheVersion) {
      _studentProfileAssetsCache.set(cacheKey, {
        value: resolvedAssets,
        expiresAt: Date.now() + STUDENT_PROFILE_ASSETS_CACHE_TTL_MS,
      });
    }

    return resolvedAssets;
  })();

  _studentProfileAssetsPromiseCache.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    _studentProfileAssetsPromiseCache.delete(cacheKey);
  }
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
  const photoFiles = await restRequest<any[]>(
    'files',
    `select=id,type,file_name,storage_bucket,storage_path,storage_provider,cloudinary_public_id,cloudinary_resource_type,cloudinary_version,cloudinary_folder,mime_type,uploaded_at,url&submission_id=in.(${idList})&type=eq.photo&order=uploaded_at.desc&limit=20`,
  );

  for (const file of photoFiles || []) {
    if (isCloudinaryFileRow(file)) {
      const cloudinaryUrl = buildCloudinaryDeliveryUrl(file);
      if (cloudinaryUrl) return { photoUrl: cloudinaryUrl };
      continue;
    }

    const finalUrl = normalizeStorageFileUrl(file?.url);
    if (finalUrl && /res\.cloudinary\.com/i.test(finalUrl)) {
      return { photoUrl: finalUrl };
    }
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

export async function getSubmissionReportSummaries() {
  const rows = await restRequest<any[]>(
    'submissions',
    'select=id,student_id,department,course,year_level,sex,submitted_at,academic_year&order=submitted_at.desc',
  ).catch(() => []);

  return {
    submissions: (rows || []).map((row) => ({
      id: row.id,
      studentId: row.student_id || '',
      department: row.department || '',
      course: row.course || '',
      year: String(row.year_level || ''),
      sex: row.sex || '',
      submittedAt: row.submitted_at,
      academicYear: row.academic_year || undefined,
    })),
  };
}


export async function getSubmission(id: string) {
  try {
    return await apiRequest<{ submission: any }>(
      `/functions/v1/server/submission/${encodeURIComponent(id)}`,
    );
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

const MEDICAL_RECORD_DATE_RANGE_MONTHS = 6;

function formatDateInputValue(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateInputValue(value?: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const candidate = raw.includes('T') ? raw.slice(0, 10) : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return '';

  const [year, month, day] = candidate.split('-').map((part) => Number(part));
  if (!year || !month || !day) return '';

  const date = new Date(Date.UTC(year, month - 1, day));
  const isSameDate =
    date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;

  return isSameDate ? candidate : '';
}

function shiftCalendarMonths(date: Date, amount: number) {
  const shifted = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const lastDayOfShiftedMonth = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(date.getDate(), lastDayOfShiftedMonth));
  return shifted;
}

function getMedicalRecordDateBounds(referenceDate = new Date()) {
  return {
    min: formatDateInputValue(shiftCalendarMonths(referenceDate, -MEDICAL_RECORD_DATE_RANGE_MONTHS)),
    max: formatDateInputValue(referenceDate),
  };
}

function assertMedicalRecordDateInRange(label: string, value?: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return;

  const normalized = normalizeDateInputValue(raw);
  if (!normalized) {
    throw new Error(`${label} must be a valid date.`);
  }

  const { min, max } = getMedicalRecordDateBounds();
  if (normalized > max) {
    throw new Error(`${label} cannot be in the future.`);
  }
  if (normalized < min) {
    throw new Error(`${label} must be within the past ${MEDICAL_RECORD_DATE_RANGE_MONTHS} months.`);
  }
}

function isMissingSignatoryNameColumnError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('signatory_name') || (
    message.includes('schema cache') &&
    message.includes('certificates')
  );
}

async function upsertCertificateRecord(submissionId: string, clearanceInfo: any) {
  const basePayload = {
    submission_id: submissionId,
    findings_normal: typeof clearanceInfo.findingsNormal === 'boolean' ? clearanceInfo.findingsNormal : null,
    diagnosis: clearanceInfo.diagnosis || null,
    remarks: clearanceInfo.remarks || null,
    purpose: clearanceInfo.purpose || null,
    control_no: clearanceInfo.controlNo || null,
    issued_at: clearanceInfo.issuedDate || null,
    license_no: clearanceInfo.licenseNo || null,
  };
  const signatoryName = String(clearanceInfo.signatoryName || '').trim();
  const payload = signatoryName
    ? { ...basePayload, signatory_name: signatoryName }
    : basePayload;

  try {
    return await restRequest(
      'certificates',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      },
    );
  } catch (error) {
    if (!signatoryName || !isMissingSignatoryNameColumnError(error)) {
      throw error;
    }

    return restRequest(
      'certificates',
      'on_conflict=submission_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(basePayload),
      },
    );
  }
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

  const shouldEnforceMedicalRecordDateGuards = nextStatus !== 'returned';

  if (shouldEnforceMedicalRecordDateGuards) {
    assertMedicalRecordDateInRange('Chest X-Ray date', labResults.xrayDate);
    assertMedicalRecordDateInRange('CBC date', labResults.cbcDate);
    assertMedicalRecordDateInRange('Urinalysis date', labResults.urinalysisDate);
    assertMedicalRecordDateInRange('Issued date', clearanceInfo.issuedDate);
  }

  const me = await getMe();
  const reviewedBy = me.staff?.id || null;
  const requestedControlNo = String(clearanceInfo.controlNo || '').trim();

  // Guard early against duplicate control numbers so we can return a clear error
  // instead of surfacing a generic DB unique-constraint failure from the certificates upsert.
  if (requestedControlNo) {
    const existingControlNoRows = await restRequest<any[]>(
      'certificates',
      `control_no=eq.${encodeURIComponent(requestedControlNo)}&select=submission_id,control_no&limit=1`,
    ).catch(() => []);
    const existing = (existingControlNoRows || [])[0];
    if (existing?.submission_id && String(existing.submission_id) !== String(id)) {
      throw new Error(`Control number "${requestedControlNo}" is already used in another certificate. Please use a unique control number.`);
    }
  }

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
    upsertCertificateRecord(id, clearanceInfo),
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

export type ChestXrayOcrExtraction = {
  confidence?: number;
  findings: string;
  pageCount: number;
  rawText: string;
  result?: 'normal' | 'abnormal';
  source: 'ocr-space';
  success: true;
};

export type CbcOcrExtraction = {
  fields: {
    bloodType?: string;
    date?: string;
    hematocrit?: string;
    hemoglobin?: string;
    plateletCount?: string;
    wbc?: string;
  };
  pageCount: number;
  rawText: string;
  source: 'ocr-space';
  success: true;
};

export type UrinalysisOcrExtraction = {
  fields: {
    date?: string;
    glucose?: string;
    protein?: string;
  };
  pageCount: number;
  rawText: string;
  source: 'ocr-space';
  success: true;
};

export async function extractChestXrayFindings(id: string) {
  const submissionId = String(id || '').trim();
  if (!submissionId) {
    throw new Error('Submission ID is required to extract Chest X-Ray findings.');
  }

  return apiRequest<ChestXrayOcrExtraction>(
    `/functions/v1/server/submission/${encodeURIComponent(submissionId)}/chest-xray-ocr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

export async function extractCbcFields(id: string) {
  const submissionId = String(id || '').trim();
  if (!submissionId) {
    throw new Error('Submission ID is required to extract CBC values.');
  }

  return apiRequest<CbcOcrExtraction>(
    `/functions/v1/server/submission/${encodeURIComponent(submissionId)}/cbc-ocr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

export async function extractUrinalysisFields(id: string) {
  const submissionId = String(id || '').trim();
  if (!submissionId) {
    throw new Error('Submission ID is required to extract Urinalysis values.');
  }

  return apiRequest<UrinalysisOcrExtraction>(
    `/functions/v1/server/submission/${encodeURIComponent(submissionId)}/urinalysis-ocr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

type CloudinaryUploadTicket = {
  success?: boolean;
  provider: 'cloudinary';
  cloudName: string;
  uploadUrl: string;
  timestamp: number;
  signature: string;
  apiKey: string;
  folder?: string | null;
  assetFolder?: string | null;
  publicId: string;
  resourceType?: string | null;
  mimeType?: string | null;
  context?: Record<string, unknown> | null;
  contextString?: string | null;
  tags?: string | null;
  overwrite?: boolean;
  useAssetFolderAsPublicIdPrefix?: boolean;
};

function isCloudinaryUploadTicket(ticket: unknown): ticket is CloudinaryUploadTicket {
  return String((ticket as CloudinaryUploadTicket)?.provider || '').toLowerCase() === 'cloudinary';
}

function assertCloudinaryUploadTicket(ticket: unknown, label: string): asserts ticket is CloudinaryUploadTicket {
  if (!isCloudinaryUploadTicket(ticket)) {
    throw new Error(`${label} did not receive a Cloudinary upload ticket.`);
  }
}

async function uploadToCloudinary(ticket: CloudinaryUploadTicket, file: File) {
  const formData = new FormData();
  formData.set('file', file);
  formData.set('api_key', ticket.apiKey);
  formData.set('timestamp', String(ticket.timestamp));
  formData.set('signature', ticket.signature);
  formData.set('public_id', ticket.publicId);
  if (ticket.assetFolder) formData.set('asset_folder', ticket.assetFolder);
  if (ticket.contextString) formData.set('context', ticket.contextString);
  if (ticket.tags) formData.set('tags', ticket.tags);
  if (ticket.overwrite !== undefined) formData.set('overwrite', String(Boolean(ticket.overwrite)));
  if (ticket.useAssetFolderAsPublicIdPrefix !== undefined) {
    formData.set(
      'use_asset_folder_as_public_id_prefix',
      String(Boolean(ticket.useAssetFolderAsPublicIdPrefix)),
    );
  }

  const response = await fetch(ticket.uploadUrl, {
    method: 'POST',
    body: formData,
  });
  const raw = await response.text().catch(() => '');
  let payload: any = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      payload?.error ||
      raw ||
      `Cloudinary upload failed (${response.status})`;
    throw new Error(String(message));
  }

  return payload;
}

export async function uploadFile(file: File, recordId: string, fileType: LabUploadType) {
  const token = getAccessToken();
  if (!token || !supabaseUrl || !publicAnonKey) {
    throw new Error('You must be signed in to upload files.');
  }

  const finishTrackedUpload = beginTrackedUpload();

  try {
    const transportFile = await optimizeLabImageInBrowser(file);
    const originalFileSize = file.size;
    const normalizedRecordId = String(recordId || '').trim();
    const normalizedFileType = String(fileType || '').trim().toLowerCase();
    const prepare = await apiRequest<CloudinaryUploadTicket>(
      '/functions/v1/server/upload-file/prepare',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordId: normalizedRecordId,
          fileType: normalizedFileType,
          fileName: transportFile.name,
          mimeType: transportFile.type || file.type || 'application/octet-stream',
          size: transportFile.size,
          originalFileSize,
        }),
      },
    );
    assertCloudinaryUploadTicket(prepare, 'Laboratory file upload');

    const cloudinary = await uploadToCloudinary(prepare, transportFile);
    const payload = await apiRequest<{ success: true; url?: string | null; fileName?: string | null }>(
      '/functions/v1/server/upload-file/complete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordId: normalizedRecordId,
          fileType: normalizedFileType,
          fileName: transportFile.name,
          mimeType: prepare.mimeType || transportFile.type || file.type || 'application/octet-stream',
          originalFileSize,
          uploadedFileSize: transportFile.size,
          uploadedFileName: transportFile.name,
          uploadedMimeType: prepare.mimeType || transportFile.type || file.type || 'application/octet-stream',
          cloudinary,
        }),
      },
    );

    return {
      success: true as const,
      url: normalizeStorageFileUrl(payload.url || null) || undefined,
      fileName: payload.fileName || undefined,
    };
  } finally {
    finishTrackedUpload();
  }
}

export async function uploadStudentProfileAsset(
  file: File,
  studentId: string,
  fileType: StudentProfileAssetUploadType,
) {
  const targetStudentId = String(studentId || '').trim();
  if (!targetStudentId) {
    throw new Error('Student ID is required to upload profile assets.');
  }

  const token = getAccessToken();
  if (!token || !supabaseUrl || !publicAnonKey) {
    throw new Error('You must be signed in to upload files.');
  }

  const finishTrackedUpload = beginTrackedUpload();

  try {
    const prepare = await apiRequest<CloudinaryUploadTicket>(
      '/functions/v1/server/student-profile-asset/prepare',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileType,
          studentId: targetStudentId,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        }),
      },
    );
    assertCloudinaryUploadTicket(prepare, 'Student profile asset upload');

    const cloudinary = await uploadToCloudinary(prepare, file);
    const payload = await apiRequest<{ success: true; url?: string | null; fileName?: string | null }>(
      '/functions/v1/server/student-profile-asset/complete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileType,
          studentId: targetStudentId,
          fileName: file.name,
          mimeType: prepare.mimeType || file.type || 'application/octet-stream',
          cloudinary,
        }),
      },
    );
    invalidateStudentProfileAssetsCache();

    return {
      success: true as const,
      url: normalizeStorageFileUrl(payload.url || null) || undefined,
      fileName: payload.fileName || undefined,
    };
  } finally {
    finishTrackedUpload();
  }
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

  const [totalStudents, totalSubmissions, pendingRecords, approvedRecords, returnedRecords] = await Promise.all([
    restCount('students'),
    restCount('submissions'),
    restCount('submissions', 'status=in.(pending,in_review)'),
    restCount('submissions', 'status=eq.approved'),
    restCount('submissions', 'status=eq.returned'),
  ]);

  return {
    totalStudents,
    pendingRecords,
    approvedRecords,
    returnedRecords,
    totalSubmissions,
  };
}

export async function getStaffUsers() {
    return apiRequest<{ staff: Array<{ id: string; userId?: string; name: string; role: string; status: string; email: string }> }>(
    '/functions/v1/server/staff-users',
  );
}

type AdminCreateAccountInput = {
  email: string;
  password: string;
  role: 'student' | 'staff';
  firstName?: string;
  lastName?: string;
  studentId?: string;
  department?: string;
  course?: string;
};

export async function createAdminAccount(input: AdminCreateAccountInput) {
  const passwordResult = getPasswordStrengthResult(input.password, {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    studentId: input.studentId,
  });
  if (!passwordResult.isStrongEnough) {
    throw new Error(getPasswordPolicyMessage(passwordResult));
  }

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
  const passwordResult = getPasswordStrengthResult(input.password, {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
  });
  if (!passwordResult.isStrongEnough) {
    throw new Error(getPasswordPolicyMessage(passwordResult));
  }

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
    if (!isMissingRouteError(error) && !isMissingKvStoreError(error)) {
      throw error;
    }

    return readStoredAdminSystemSettings();
  }
}

export async function getReportingTermSettings() {
  try {
    const settings = await apiRequest<AdminSystemSettings>('/functions/v1/server/reporting-term');
    const normalized = normalizeAdminSystemSettings(settings);
    writeStoredAdminSystemSettings(normalized);
    return normalized;
  } catch {
    return readStoredAdminSystemSettings();
  }
}

export async function getAcademicYearSetting() {
  try {
    const rows = await restRequest<Array<{ key?: string; value?: string | null }>>(
      'system_settings',
      `select=key,value&key=eq.${encodeURIComponent(CURRENT_ACADEMIC_YEAR_SETTING_KEY)}&limit=1`,
    );
    return buildAcademicYearSetting(rows?.[0]?.value || null);
  } catch (error) {
    if (!isMissingSystemSettingsError(error)) {
      throw error;
    }

    return buildAcademicYearSetting();
  }
}

export async function getActiveAcademicYearSettings() {
  const setting = await getAcademicYearSetting();
  return {
    academicYear: setting.academicYear,
  };
}

export async function getSessionPolicy() {
  try {
    const policy = await apiRequest<{ sessionTimeoutMinutes?: number | null }>('/functions/v1/server/session-policy');
    const normalized = normalizeAdminSystemSettings({
      sessionTimeoutMinutes: Number(policy?.sessionTimeoutMinutes),
    });
    return {
      sessionTimeoutMinutes: normalized.sessionTimeoutMinutes,
    };
  } catch {
    const fallback = readStoredAdminSystemSettings();
    return {
      sessionTimeoutMinutes: fallback.sessionTimeoutMinutes,
    };
  }
}

export async function updateAcademicYearSetting(input: string) {
  const academicYear = normalizeAcademicYear(input);
  const payload = {
    value: formatAcademicYearSettingValue(academicYear),
  };

  try {
    const rows = await restRequest<Array<{ key?: string; value?: string | null }>>(
      'system_settings',
      `key=eq.${encodeURIComponent(CURRENT_ACADEMIC_YEAR_SETTING_KEY)}&select=key,value`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      },
    );
    return buildAcademicYearSetting(rows?.[0]?.value || payload.value);
  } catch (error) {
    if (!isMissingSystemSettingsError(error)) {
      throw error;
    }

    return buildAcademicYearSetting(payload.value);
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
    if (!isMissingRouteError(error) && !isMissingKvStoreError(error)) {
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

type SuperAdminCreateAdministratorInput = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export async function getSuperAdminAdministrators() {
  const data = await apiRequest<{
    administrators: SuperAdminAdministrator[];
    archivedAdministrators?: SuperAdminArchivedAdministrator[];
  }>(
    '/functions/v1/server/super-admin/administrators',
  );

  if (Array.isArray(data.archivedAdministrators)) {
    return {
      administrators: data.administrators || [],
      archivedAdministrators: data.archivedAdministrators,
    };
  }

  try {
    const archived = await apiRequest<{ users: any[] }>('/functions/v1/server/archived-accounts');

    return {
      administrators: data.administrators || [],
      archivedAdministrators: (archived.users || []).filter((user) => user?.roleKey === 'admin'),
    };
  } catch {
    return {
      administrators: data.administrators || [],
      archivedAdministrators: [],
    };
  }
}

export async function createSuperAdminAdministrator(input: SuperAdminCreateAdministratorInput) {
  const passwordResult = getPasswordStrengthResult(input.password, {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
  });
  if (!passwordResult.isStrongEnough) {
    throw new Error(getPasswordPolicyMessage(passwordResult));
  }

  return apiRequest<{ success: boolean; userId?: string }>(
    '/functions/v1/server/super-admin/administrators',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );
}

export async function archiveSuperAdminAdministrator(input: { userId: string; reason?: string }) {
  try {
    return await apiRequest<{ success: boolean }>(
      '/functions/v1/server/admin/archive-account',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const shouldFallback = message.includes('forbidden') || message.includes('not found') || message.includes('404');
    if (!shouldFallback) throw error;

    return apiRequest<{ success: boolean }>(
      `/functions/v1/server/super-admin/administrators/${encodeURIComponent(input.userId)}/archive`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: input.reason }),
      },
    );
  }
}

export async function restoreSuperAdminAdministrator(archiveId: string) {
  try {
    return await apiRequest<{ success: boolean }>(
      `/functions/v1/server/admin/restore-account/${encodeURIComponent(archiveId)}`,
      {
        method: 'POST',
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const shouldFallback = message.includes('forbidden') || message.includes('not found') || message.includes('404');
    if (!shouldFallback) throw error;

    return apiRequest<{ success: boolean }>(
      `/functions/v1/server/super-admin/administrators/${encodeURIComponent(archiveId)}/restore`,
      {
        method: 'POST',
      },
    );
  }
}
