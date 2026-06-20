export type OcrProvider = 'azure' | 'ocr-space';

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
  ocrProvider: OcrProvider;
  ocrCallsCount?: number;
};

const ADMIN_SYSTEM_SETTINGS_STORAGE_KEY = 'admin_system_settings_v1';
const ADMIN_SYSTEM_SETTINGS_SEMESTERS = new Set<AdminSystemSettings['semester']>([
  'First Semester',
  'Second Semester',
  'Summer',
]);
const ADMIN_SYSTEM_SETTINGS_TIMEOUT_OPTIONS = new Set([15, 30, 45, 60, 120]);
const ADMIN_SYSTEM_SETTINGS_ARCHIVE_OPTIONS = new Set([0, 12, 24, 36]);
const ADMIN_SYSTEM_SETTINGS_OCR_PROVIDERS = new Set<OcrProvider>(['azure', 'ocr-space']);
const DEFAULT_OCR_PROVIDER: OcrProvider = 'ocr-space';
const ADMIN_SYSTEM_SETTINGS_ACADEMIC_YEAR_PATTERN = /^(?:sy\s*)?(\d{4})\s*-\s*(\d{4})$/i;

export function isMissingKvStoreError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    message.includes('kv_store_2a5e1a6b') ||
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
}

export function isMissingRouteError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return message.includes('404') || message.includes('not found');
}

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
    ocrProvider: DEFAULT_OCR_PROVIDER,
    ocrCallsCount: 0,
  };
}

export function normalizeAdminSystemSettings(
  value?: Partial<AdminSystemSettings> | null,
): AdminSystemSettings {
  const defaults = createDefaultAdminSystemSettings();
  const academicYearValue = String(value?.academicYear ?? defaults.academicYear).trim();
  const parsedTimeout = Number(value?.sessionTimeoutMinutes);
  const parsedAutoArchive = Number(value?.autoArchiveAfterMonths);

  const academicYearMatch = academicYearValue.match(ADMIN_SYSTEM_SETTINGS_ACADEMIC_YEAR_PATTERN);
  const academicYear =
    academicYearMatch &&
    Number(academicYearMatch[2]) - Number(academicYearMatch[1]) === 1
      ? `${academicYearMatch[1]}-${academicYearMatch[2]}`
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
    ocrProvider: ADMIN_SYSTEM_SETTINGS_OCR_PROVIDERS.has(value?.ocrProvider as OcrProvider)
      ? (value?.ocrProvider as OcrProvider)
      : defaults.ocrProvider,
    ocrCallsCount: typeof value?.ocrCallsCount === 'number' ? value.ocrCallsCount : 0,
  };
}

export function readStoredAdminSystemSettings() {
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

export function writeStoredAdminSystemSettings(settings: AdminSystemSettings) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    ADMIN_SYSTEM_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeAdminSystemSettings(settings)),
  );
}
