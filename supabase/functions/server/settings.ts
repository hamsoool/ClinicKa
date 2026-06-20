// @ts-nocheck
import { supabase } from "./context.ts";
import { getOcrCount } from "./redis.ts";

const ADMIN_SYSTEM_SETTINGS_STORE_KEY = "admin.system-settings";
export const CURRENT_ACADEMIC_YEAR_SETTING_KEY = "current_academic_year";
const ADMIN_SYSTEM_SETTINGS_SEMESTERS = [
  "First Semester",
  "Second Semester",
  "Summer",
];
const ADMIN_SYSTEM_SETTINGS_TIMEOUT_OPTIONS = [15, 30, 45, 60, 120];
const ADMIN_SYSTEM_SETTINGS_ARCHIVE_OPTIONS = [0, 12, 24, 36];
const ADMIN_SYSTEM_SETTINGS_OCR_PROVIDERS = ["azure", "ocr-space"];
export const DEFAULT_OCR_PROVIDER = "ocr-space";
export type OcrProvider = "azure" | "ocr-space";

export function resolveOcrProvider(value: unknown): OcrProvider {
  return ADMIN_SYSTEM_SETTINGS_OCR_PROVIDERS.includes(value)
    ? (value as OcrProvider)
    : (DEFAULT_OCR_PROVIDER as OcrProvider);
}
const STUDENT_NOTIFICATION_STATE_KEY_PREFIX = "student.notification-state";
const MAX_STUDENT_NOTIFICATION_ITEMS = 20;

export function getCurrentAcademicYear() {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function normalizeAcademicYearSettingValue(value: unknown, fallback = getCurrentAcademicYear()) {
  const match = String(value || "").trim().match(/^(?:sy\s*)?(\d{4})\s*-\s*(\d{4})$/i);
  if (!match) return fallback;

  const startYear = Number.parseInt(match[1], 10);
  const endYear = Number.parseInt(match[2], 10);
  return Number.isFinite(startYear) && endYear - startYear === 1
    ? `${startYear}-${endYear}`
    : fallback;
}

function formatAcademicYearSettingValue(value: unknown) {
  return `SY ${normalizeAcademicYearSettingValue(value)}`;
}

export function getDefaultAdminSystemSettings() {
  return {
    academicYear: getCurrentAcademicYear(),
    semester: "Second Semester",
    acceptingSubmissions: true,
    requireTwoFactorAuth: true,
    sessionTimeoutMinutes: 30,
    auditLogging: true,
    approvalEmailNotifications: true,
    pendingReviewReminders: true,
    autoArchiveAfterMonths: 12,
    ocrProvider: DEFAULT_OCR_PROVIDER,
  };
}

export function normalizeAdminSystemSettings(input: any = {}) {
  const defaults = getDefaultAdminSystemSettings();
  const academicYearValue = String(input?.academicYear ?? defaults.academicYear).trim();
  const parsedTimeout = Number(input?.sessionTimeoutMinutes);
  const parsedAutoArchive = Number(input?.autoArchiveAfterMonths);
  const academicYear = normalizeAcademicYearSettingValue(academicYearValue, defaults.academicYear);

  return {
    academicYear,
    semester: ADMIN_SYSTEM_SETTINGS_SEMESTERS.includes(input?.semester)
      ? input.semester
      : defaults.semester,
    acceptingSubmissions:
      typeof input?.acceptingSubmissions === "boolean"
        ? input.acceptingSubmissions
        : defaults.acceptingSubmissions,
    requireTwoFactorAuth:
      typeof input?.requireTwoFactorAuth === "boolean"
        ? input.requireTwoFactorAuth
        : defaults.requireTwoFactorAuth,
    sessionTimeoutMinutes: ADMIN_SYSTEM_SETTINGS_TIMEOUT_OPTIONS.includes(parsedTimeout)
      ? parsedTimeout
      : defaults.sessionTimeoutMinutes,
    auditLogging:
      typeof input?.auditLogging === "boolean"
        ? input.auditLogging
        : defaults.auditLogging,
    approvalEmailNotifications:
      typeof input?.approvalEmailNotifications === "boolean"
        ? input.approvalEmailNotifications
        : defaults.approvalEmailNotifications,
    pendingReviewReminders:
      typeof input?.pendingReviewReminders === "boolean"
        ? input.pendingReviewReminders
        : defaults.pendingReviewReminders,
    autoArchiveAfterMonths:
      ADMIN_SYSTEM_SETTINGS_ARCHIVE_OPTIONS.includes(parsedAutoArchive)
        ? parsedAutoArchive
        : defaults.autoArchiveAfterMonths,
    ocrProvider: resolveOcrProvider(input?.ocrProvider),
  };
}

export function isMissingKvStoreError(error: any) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("kv_store_2a5e1a6b") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

export function isMissingSystemSettingsError(error: any) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("system_settings") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

async function getStoredAcademicYearValue() {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", CURRENT_ACADEMIC_YEAR_SETTING_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingSystemSettingsError(error)) {
      return null;
    }
    throw new Error(error.message);
  }

  return data?.value ? normalizeAcademicYearSettingValue(data.value, "") : null;
}

export async function getAdminSystemSettings() {
  let settings = getDefaultAdminSystemSettings();
  const { data, error } = await supabase
    .from("kv_store_2a5e1a6b")
    .select("value")
    .eq("key", ADMIN_SYSTEM_SETTINGS_STORE_KEY)
    .maybeSingle();

  if (error) {
    if (!isMissingKvStoreError(error)) {
      throw new Error(error.message);
    }
  } else {
    settings = normalizeAdminSystemSettings(data?.value || {});
  }

  const storedAcademicYear = await getStoredAcademicYearValue();
  if (storedAcademicYear) {
    settings = normalizeAdminSystemSettings({
      ...settings,
      academicYear: storedAcademicYear,
    });
  }

  const ocrCallsCount = await getOcrCount();

  return {
    ...settings,
    ocrCallsCount,
  };
}

export async function getSafeAdminSystemSettings() {
  try {
    return await getAdminSystemSettings();
  } catch {
    return {
      ...getDefaultAdminSystemSettings(),
      ocrCallsCount: 0,
    };
  }
}

export async function saveAdminSystemSettings(input: any) {
  const settings = normalizeAdminSystemSettings(input);

  const { error: kvError } = await supabase
    .from("kv_store_2a5e1a6b")
    .upsert({
      key: ADMIN_SYSTEM_SETTINGS_STORE_KEY,
      value: settings,
    });

  if (kvError && !isMissingKvStoreError(kvError)) {
    throw new Error(kvError.message);
  }

  const { error: systemSettingsError } = await supabase
    .from("system_settings")
    .upsert({
      key: CURRENT_ACADEMIC_YEAR_SETTING_KEY,
      value: formatAcademicYearSettingValue(settings.academicYear),
    });

  if (systemSettingsError && !isMissingSystemSettingsError(systemSettingsError)) {
    throw new Error(systemSettingsError.message);
  }

  return settings;
}

export function getStudentNotificationStateKey(requester: any, studentId: string) {
  return `${STUDENT_NOTIFICATION_STATE_KEY_PREFIX}:${requester.profile.id}:${studentId}`;
}

export function normalizeStudentNotificationState(input: any = {}) {
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const items = rawItems
    .filter(
      (item: any) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.submissionId === "string",
    )
    .slice(0, MAX_STUDENT_NOTIFICATION_ITEMS)
    .map((item: any) => ({
      ...item,
      read: Boolean(item.read),
    }));

  const snapshotEntries =
    input?.snapshot &&
    typeof input.snapshot === "object" &&
    !Array.isArray(input.snapshot)
      ? Object.entries(input.snapshot).filter(
          ([key, value]) => Boolean(key) && typeof value === "string",
        )
      : [];

  return {
    items,
    snapshot: Object.fromEntries(snapshotEntries),
  };
}

