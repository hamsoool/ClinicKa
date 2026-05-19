// @ts-nocheck
import { supabase } from "./context.ts";

const ADMIN_SYSTEM_SETTINGS_STORE_KEY = "admin.system-settings";
const ADMIN_SYSTEM_SETTINGS_SEMESTERS = [
  "First Semester",
  "Second Semester",
  "Summer",
];
const ADMIN_SYSTEM_SETTINGS_TIMEOUT_OPTIONS = [15, 30, 45, 60, 120];
const ADMIN_SYSTEM_SETTINGS_ARCHIVE_OPTIONS = [0, 12, 24, 36];
const STUDENT_NOTIFICATION_STATE_KEY_PREFIX = "student.notification-state";
const MAX_STUDENT_NOTIFICATION_ITEMS = 20;

export function getCurrentAcademicYear() {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
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
  };
}

export function normalizeAdminSystemSettings(input: any = {}) {
  const defaults = getDefaultAdminSystemSettings();
  const academicYearValue = String(input?.academicYear ?? defaults.academicYear).trim();
  const parsedTimeout = Number(input?.sessionTimeoutMinutes);
  const parsedAutoArchive = Number(input?.autoArchiveAfterMonths);

  const academicYear =
    /^\d{4}-\d{4}$/.test(academicYearValue) &&
      Number(academicYearValue.slice(5, 9)) -
          Number(academicYearValue.slice(0, 4)) ===
        1
      ? academicYearValue
      : defaults.academicYear;

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

export async function getAdminSystemSettings() {
  const { data, error } = await supabase
    .from("kv_store_2a5e1a6b")
    .select("value")
    .eq("key", ADMIN_SYSTEM_SETTINGS_STORE_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingKvStoreError(error)) {
      return getDefaultAdminSystemSettings();
    }
    throw new Error(error.message);
  }

  return normalizeAdminSystemSettings(data?.value || {});
}

export async function getSafeAdminSystemSettings() {
  try {
    return await getAdminSystemSettings();
  } catch {
    return getDefaultAdminSystemSettings();
  }
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

