// @ts-nocheck
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import nodemailer from "npm:nodemailer";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono().basePath("/server");

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const requestLoggingEnabled = Deno.env.get('ENABLE_REQUEST_LOGGING') === 'true';
const debugErrorsEnabled = Deno.env.get('DEBUG_ERRORS') === 'true';
const minPasswordLength = 12;
const configuredSignedUrlSeconds = Number(Deno.env.get('SIGNED_STORAGE_URL_EXPIRES_SECONDS') || '900');
  const signedStorageUrlExpiresSeconds =
  Number.isFinite(configuredSignedUrlSeconds) && configuredSignedUrlSeconds > 0
    ? Math.min(configuredSignedUrlSeconds, 60 * 60)
    : 900;
const allowVercelPreviewOrigins = Deno.env.get('ALLOW_VERCEL_PREVIEW_ORIGINS') === 'true';
const allowedCorsOrigins = new Set(
  [
    Deno.env.get('SITE_URL'),
    Deno.env.get('VITE_SITE_URL'),
    Deno.env.get('APP_ORIGIN'),
    ...(Deno.env.get('ALLOWED_ORIGINS') || '').split(','),
    'https://clinicka.vercel.app/',
    'https://clinic-ka.vercel.app/',
  ]
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean),
);

function normalizeOrigin(origin?: string | null) {
  const value = String(origin || '').trim().replace(/\/+$/, '');
  if (!value) return '';

  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function resolveCorsOrigin(origin?: string | null) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return '';
  if (allowedCorsOrigins.has(normalizedOrigin)) return normalizedOrigin;
  if (
    allowVercelPreviewOrigins &&
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalizedOrigin)
  ) {
    return normalizedOrigin;
  }
  return '';
}

function buildCorsHeaders(origin?: string | null) {
  const allowedOrigin = resolveCorsOrigin(origin);
  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}

function internalServerError(c: any, message: string, error: unknown) {
  const body = debugErrorsEnabled ? { error: message, details: String(error) } : { error: message };
  return c.json(body, 500);
}

function passwordLengthError() {
  return `password must be at least ${minPasswordLength} characters`;
}

if (requestLoggingEnabled) {
  app.use('*', logger(console.log));
}

app.use(
  "/*",
  cors({
    origin: (origin) => resolveCorsOrigin(origin) || null,
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.use("/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
});

app.options('*', (c) => new Response(null, {
  status: 204,
  headers: buildCorsHeaders(c.req.header('Origin')),
}));

const supabase = createClient(supabaseUrl, serviceRoleKey);
const bucketName = 'medical-files';
const storageBuckets = [
  bucketName,
  'profile',
  'student_signature',
  'lab_chest_xray',
  'lab_cbc',
  'lab_urinalysis',
];
const ARCHIVE_TABLE_STATE_TTL_MS = 60_000;
const ARCHIVED_USER_IDS_TTL_MS = 30_000;
const ANALYTICS_CACHE_TTL_MS = 30_000;
const SUBMISSIONS_CACHE_TTL_MS = 15_000;
const STUDENT_RECORDS_CACHE_TTL_MS = 20_000;
const STAFF_DASHBOARD_OVERVIEW_TTL_MS = 15_000;
const STAFF_SUBMISSION_SUMMARIES_TTL_MS = 20_000;
const STAFF_APPROVED_STUDENTS_TTL_MS = 30_000;
const STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS = 20;
const STAFF_SUBMISSION_SUMMARIES_DEFAULT_PAGE_SIZE = 25;
const STAFF_SUBMISSION_SUMMARIES_MAX_PAGE_SIZE = 100;
const STAFF_APPROVED_STUDENTS_DEFAULT_PAGE_SIZE = 20;
const STAFF_APPROVED_STUDENTS_MAX_PAGE_SIZE = 50;
const SUBMISSION_LIST_COLUMNS = [
  'id',
  'student_id',
  'first_name',
  'last_name',
  'middle_initial',
  'course',
  'department',
  'year_level',
  'status',
  'reviewed_by',
  'submitted_at',
  'updated_at',
  'staff_notes',
  'age',
  'sex',
  'birthday',
  'civil_status',
  'contact_number',
  'address',
  'allergy_details',
  'had_operation',
  'operation_details',
  'blood_pressure',
  'weight',
  'height',
  'bmi',
  'lab_test_location',
  'lab_test_clinic',
].join(',');
const SUBMISSION_SUMMARY_COLUMNS = [
  'id',
  'student_id',
  'first_name',
  'last_name',
  'middle_initial',
  'course',
  'department',
  'year_level',
  'status',
  'reviewed_by',
  'submitted_at',
  'updated_at',
].join(',');
const ADMIN_SYSTEM_SETTINGS_STORE_KEY = 'admin.system-settings';
const ADMIN_SYSTEM_SETTINGS_SEMESTERS = ['First Semester', 'Second Semester', 'Summer'];
const ADMIN_SYSTEM_SETTINGS_TIMEOUT_OPTIONS = [15, 30, 45, 60, 120];
const ADMIN_SYSTEM_SETTINGS_ARCHIVE_OPTIONS = [0, 12, 24, 36];
const STUDENT_NOTIFICATION_STATE_KEY_PREFIX = 'student.notification-state';
const MAX_STUDENT_NOTIFICATION_ITEMS = 20;

type TimedValue<T> = {
  value: T;
  expiresAt: number;
};

let archivedTableStateCache: TimedValue<{ available: boolean; rows: any[] }> | null = null;
let archivedTableStatePromise: Promise<{ available: boolean; rows: any[] }> | null = null;
let archivedUserIdsCache: TimedValue<{ available: boolean; userIds: Set<string> }> | null = null;
let analyticsReadCache: TimedValue<Record<string, number>> | null = null;
let analyticsReadPromise: Promise<Record<string, number>> | null = null;
let submissionsReadCache: TimedValue<any[]> | null = null;
let submissionsReadPromise: Promise<any[]> | null = null;
const studentRecordsReadCache = new Map<string, TimedValue<any[]>>();
const studentRecordsReadPromises = new Map<string, Promise<any[]>>();
let staffDashboardOverviewCache: TimedValue<any> | null = null;
let staffDashboardOverviewPromise: Promise<any> | null = null;
const staffSubmissionSummariesCache = new Map<string, TimedValue<any>>();
const staffSubmissionSummariesPromises = new Map<string, Promise<any>>();
const staffApprovedStudentsCache = new Map<string, TimedValue<any>>();
const staffApprovedStudentsPromises = new Map<string, Promise<any>>();

type Requester = {
  user: any;
  profile: any;
  student: any;
  staff: any;
  archivedAccount?: any;
};

const isAdminRole = (role?: string) => role === 'admin';
const isSuperAdminRole = (role?: string) => role === 'super_admin';
const isStaffRole = (role?: string) => role === 'staff' || isAdminRole(role);

const DOCTOR_POSITIONS = ['clinic doctor', 'doctor'];

function isDoctorPosition(position?: string | null) {
  if (!position) return false;
  return DOCTOR_POSITIONS.includes(position.trim().toLowerCase());
}

function isDoctorOrAdmin(requester: Requester) {
  if (isAdminRole(requester.profile.role)) return true;
  if (requester.profile.role === 'staff' && isDoctorPosition(requester.staff?.position)) return true;
  return false;
}

function getCurrentAcademicYear() {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function getDefaultAdminSystemSettings() {
  return {
    academicYear: getCurrentAcademicYear(),
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

function normalizeAdminSystemSettings(input: any = {}) {
  const defaults = getDefaultAdminSystemSettings();
  const academicYearValue = String(input?.academicYear ?? defaults.academicYear).trim();
  const parsedTimeout = Number(input?.sessionTimeoutMinutes);
  const parsedAutoArchive = Number(input?.autoArchiveAfterMonths);

  const academicYear =
    /^\d{4}-\d{4}$/.test(academicYearValue) &&
    Number(academicYearValue.slice(5, 9)) - Number(academicYearValue.slice(0, 4)) === 1
      ? academicYearValue
      : defaults.academicYear;

  return {
    academicYear,
    semester: ADMIN_SYSTEM_SETTINGS_SEMESTERS.includes(input?.semester)
      ? input.semester
      : defaults.semester,
    acceptingSubmissions:
      typeof input?.acceptingSubmissions === 'boolean'
        ? input.acceptingSubmissions
        : defaults.acceptingSubmissions,
    requireTwoFactorAuth:
      typeof input?.requireTwoFactorAuth === 'boolean'
        ? input.requireTwoFactorAuth
        : defaults.requireTwoFactorAuth,
    sessionTimeoutMinutes: ADMIN_SYSTEM_SETTINGS_TIMEOUT_OPTIONS.includes(parsedTimeout)
      ? parsedTimeout
      : defaults.sessionTimeoutMinutes,
    auditLogging:
      typeof input?.auditLogging === 'boolean' ? input.auditLogging : defaults.auditLogging,
    approvalEmailNotifications:
      typeof input?.approvalEmailNotifications === 'boolean'
        ? input.approvalEmailNotifications
        : defaults.approvalEmailNotifications,
    pendingReviewReminders:
      typeof input?.pendingReviewReminders === 'boolean'
        ? input.pendingReviewReminders
        : defaults.pendingReviewReminders,
    autoArchiveAfterMonths: ADMIN_SYSTEM_SETTINGS_ARCHIVE_OPTIONS.includes(parsedAutoArchive)
      ? parsedAutoArchive
      : defaults.autoArchiveAfterMonths,
  };
}

function isMissingKvStoreError(error: any) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('kv_store_2a5e1a6b') ||
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
}

function isMissingRelationError(error: any) {
  const message = String(error?.message || error?.details || error || '').toLowerCase();
  return (
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
}

async function getAdminSystemSettings() {
  const { data, error } = await supabase
    .from('kv_store_2a5e1a6b')
    .select('value')
    .eq('key', ADMIN_SYSTEM_SETTINGS_STORE_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingKvStoreError(error)) {
      return getDefaultAdminSystemSettings();
    }
    throw new Error(error.message);
  }

  return normalizeAdminSystemSettings(data?.value || {});
}

async function getSafeAdminSystemSettings() {
  try {
    return await getAdminSystemSettings();
  } catch {
    return getDefaultAdminSystemSettings();
  }
}

function getYearLevelLabel(yearLevel: unknown) {
  const value = Number(yearLevel);
  if (value === 1) return '1st Year';
  if (value === 2) return '2nd Year';
  if (value === 3) return '3rd Year';
  if (value === 4) return '4th Year';
  return 'your current year level';
}

function getRequesterStudentId(requester: Requester) {
  return String(requester.student?.student_id || requester.profile?.student_id || '').trim();
}

function getStudentNotificationStateKey(requester: Requester, studentId: string) {
  return `${STUDENT_NOTIFICATION_STATE_KEY_PREFIX}:${requester.profile.id}:${studentId}`;
}

function normalizeStudentNotificationState(input: any = {}) {
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const items = rawItems
    .filter((item: any) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.submissionId === 'string')
    .slice(0, MAX_STUDENT_NOTIFICATION_ITEMS)
    .map((item: any) => ({
      ...item,
      read: Boolean(item.read),
    }));

  const snapshotEntries = input?.snapshot && typeof input.snapshot === 'object' && !Array.isArray(input.snapshot)
    ? Object.entries(input.snapshot).filter(([key, value]) => Boolean(key) && typeof value === 'string')
    : [];

  return {
    items,
    snapshot: Object.fromEntries(snapshotEntries),
  };
}

function getValidCachedValue<T>(cached: TimedValue<T> | null | undefined) {
  if (!cached) return null;
  return cached.expiresAt > Date.now() ? cached.value : null;
}

function createTimedValue<T>(value: T, ttlMs: number): TimedValue<T> {
  return {
    value,
    expiresAt: Date.now() + ttlMs,
  };
}

function invalidateDashboardReadCaches() {
  analyticsReadCache = null;
  analyticsReadPromise = null;
  submissionsReadCache = null;
  submissionsReadPromise = null;
  studentRecordsReadCache.clear();
  studentRecordsReadPromises.clear();
  staffDashboardOverviewCache = null;
  staffDashboardOverviewPromise = null;
  staffSubmissionSummariesCache.clear();
  staffSubmissionSummariesPromises.clear();
  staffApprovedStudentsCache.clear();
  staffApprovedStudentsPromises.clear();
}

function getStatusEmailContent(status: string, studentName: string, yearLabel: string, staffNotes?: string | null) {
  if (status === 'returned') {
    return {
      subject: 'Action Required: Medical Record Returned for Correction',
      text:
        `Hi ${studentName},\n\n`
        + `Your medical record submission for ${yearLabel} has been returned by the clinic staff for correction.\n\n`
        + `Note from Clinic Staff:\n"${staffNotes || 'No specific notes provided.'}"\n\n`
        + 'Please log in to the student portal to update and resubmit your record.',
    };
  }

  if (status === 'approved') {
    return {
      subject: 'Medical Clearance Approved',
      text:
        `Hi ${studentName},\n\n`
        + `Good news! Your medical record submission for ${yearLabel} has been approved.\n\n`
        + 'You can now view and download your medical clearance certificate from your dashboard in the clinic portal.',
    };
  }

  if (status === 'physical_exam_done') {
    return {
      subject: 'Physical Examination Completed',
      text:
        `Hi ${studentName},\n\n`
        + `Your physical examination for ${yearLabel} has been marked as completed by the clinic staff.\n\n`
        + 'Your record is now in the final stage of review. We will notify you once your medical clearance is ready.',
    };
  }

  return null;
}

async function sendStatusNotificationEmail(submissionId: string, status: string, staffNotes?: string | null) {
  const settings = await getSafeAdminSystemSettings();
  if (!settings.approvalEmailNotifications) {
    return { success: true, skipped: true, reason: 'notifications_disabled' };
  }

  const smtpHost = String(Deno.env.get('SMTP_HOST') || '').trim();
  const smtpPort = Number(Deno.env.get('SMTP_PORT') || '0');
  const smtpUser = String(Deno.env.get('SMTP_USER') || '').trim();
  const smtpPass = String(Deno.env.get('SMTP_PASS') || '').trim();

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    throw new Error('Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.');
  }

  const { data: submission, error: submissionError } = await supabase
    .from('submissions')
    .select('student_id, year_level')
    .eq('id', submissionId)
    .maybeSingle();

  if (submissionError) throw new Error(submissionError.message);
  if (!submission?.student_id) throw new Error('Submission not found.');

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('profile_id, first_name, last_name')
    .eq('student_id', submission.student_id)
    .maybeSingle();

  if (studentError) throw new Error(studentError.message);
  if (!student?.profile_id) {
    return { success: true, skipped: true, reason: 'missing_student_profile' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', student.profile_id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  const recipientEmail = normalizeEmail(profile?.email);
  if (!recipientEmail) {
    return { success: true, skipped: true, reason: 'missing_recipient_email' };
  }

  const studentName =
    [student.first_name, student.last_name].filter(Boolean).join(' ').trim()
    || 'Student';
  const emailContent = getStatusEmailContent(status, studentName, getYearLevelLabel(submission.year_level), staffNotes);

  if (!emailContent) {
    return { success: true, skipped: true, reason: 'unsupported_status' };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"Gordon College Clinic" <${smtpUser}>`,
    to: recipientEmail,
    subject: emailContent.subject,
    text: emailContent.text,
    html:
      '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">'
      + '<h2 style="color: #006d3c;">Gordon College Clinic</h2>'
      + `<div style="line-height: 1.6; color: #333;">${emailContent.text.replace(/\n/g, '<br>')}</div>`
      + '<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">'
      + '<p style="font-size: 12px; color: #888;">This is an automated notification from the Gordon College Clinic System. Please do not reply to this email.</p>'
      + '</div>',
  });

  return { success: true };
}

function normalizeEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase();
}

const SUPER_ADMIN_EMAILS = new Set(
  String(Deno.env.get('SUPER_ADMIN_EMAILS') || '')
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean),
);

function isConfiguredSuperAdminEmail(email?: string | null) {
  return SUPER_ADMIN_EMAILS.has(normalizeEmail(email));
}

function withRuntimeRoleOverrides(profile: any, user: any) {
  if (!profile) return profile;
  if (!isConfiguredSuperAdminEmail(user?.email)) return profile;

  // Keep access unblocked for configured super admins even before the DB role constraint is migrated.
  return profile.role === 'super_admin' ? profile : { ...profile, role: 'super_admin' };
}

function normalizeNamePart(value?: string | null) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function deriveNamePartsFromUser(user: any) {
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

function formatStaffDisplayName(staff?: any) {
  const fullName = [normalizeNamePart(staff?.first_name), normalizeNamePart(staff?.last_name)]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (fullName) return fullName;

  return normalizeNamePart(staff?.name);
}

async function loadStaffUsersByIds(staffIds: string[]) {
  const uniqueStaffIds = [...new Set((staffIds || []).map((value) => String(value || '').trim()).filter(Boolean))];
  if (!uniqueStaffIds.length) {
    return {} as Record<string, any>;
  }

  const { data, error } = await supabase
    .from('staff_users')
    .select('id,first_name,last_name,middle_initial,position,name')
    .in('id', uniqueStaffIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).reduce((acc, staff) => {
    acc[staff.id] = staff;
    return acc;
  }, {} as Record<string, any>);
}

function isGCDomainEmail(email?: string | null) {
  return normalizeEmail(email).endsWith('@gordoncollege.edu.ph');
}

function isValidStudentProvisionEmail(email?: string | null) {
  return Boolean(isGCDomainEmail(email) && deriveStudentIdFromEmail(email));
}

function deriveStudentIdFromEmail(email?: string | null) {
  const localPart = normalizeEmail(email).split('@')[0] || '';
  const match = localPart.match(/^(\d{9})/);
  return match?.[1] || null;
}

function isGoogleAuthUser(user: any) {
  const providers = [
    user?.app_metadata?.provider,
    ...(Array.isArray(user?.identities) ? user.identities.map((identity: any) => identity?.provider) : []),
  ];
  return providers.some((provider) => String(provider || '').trim().toLowerCase() === 'google');
}

function isRejectedGoogleUser(user: any) {
  return isGoogleAuthUser(user) && !isGCDomainEmail(user?.email);
}

async function purgeRejectedGoogleUser(user: any) {
  const userId = String(user?.id || '').trim();
  if (!userId) return;

  const derivedStudentId = deriveStudentIdFromEmail(user?.email);

  await Promise.allSettled([
    supabase.from('staff_users').delete().eq('profile_id', userId),
    supabase.from('profiles').delete().eq('id', userId),
    derivedStudentId
      ? supabase.from('students').delete().or(`profile_id.eq.${userId},student_id.eq.${derivedStudentId}`)
      : supabase.from('students').delete().eq('profile_id', userId),
  ]);

  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    throw authDeleteError;
  }
}

function roleLabel(role?: string, position?: string | null) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'admin') return 'Administrator';
  if (role === 'staff') {
    if (isDoctorPosition(position)) return 'Clinic Doctor';
    return 'Clinic Staff';
  }
  return 'Student';
}

function inferStorageBucket(file: any) {
  const explicitBucket = String(file?.storage_bucket || '').trim();
  if (explicitBucket) return explicitBucket;

  const storagePath = String(file?.storage_path || '').replace(/^\/+/, '');
  const firstSegment = storagePath.split('/')[0]?.trim();
  if (firstSegment && storageBuckets.includes(firstSegment)) return firstSegment;

  const type = String(file?.type || '').toLowerCase();
  if (type === 'photo') return 'profile';
  if (type === 'signature') return 'student_signature';
  if (type === 'xray') return 'lab_chest_xray';
  if (type === 'cbc') return 'lab_cbc';
  if (type === 'urinalysis') return 'lab_urinalysis';

  return bucketName;
}

function normalizeStoragePath(storagePath?: string | null, targetBucket?: string | null) {
  const path = String(storagePath || '').replace(/^\/+/, '');
  const normalizedBucket = String(targetBucket || '').trim();
  if (!path) return '';
  if (normalizedBucket && path.startsWith(`${normalizedBucket}/`)) {
    return path.slice(normalizedBucket.length + 1);
  }
  return path;
}

async function createTemporaryFileUrl(file: any) {
  const resolvedBucket = inferStorageBucket(file);
  const storagePath = normalizeStoragePath(file?.storage_path, resolvedBucket);
  if (!resolvedBucket || !storagePath) {
    return String(file?.url || '').trim() || null;
  }

  const { data, error } = await supabase.storage
    .from(resolvedBucket)
    .createSignedUrl(storagePath, signedStorageUrlExpiresSeconds);

  if (error) return null;
  return data?.signedUrl || null;
}

async function normalizeFileRows(files: any[] | null | undefined) {
  return Promise.all(
    (files || []).map(async (file) => {
      const storageBucket = inferStorageBucket(file);
      return {
        ...file,
        storage_bucket: storageBucket,
        url: await createTemporaryFileUrl(file),
      };
    }),
  );
}

function isMissingStorageBucketError(error: any) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('bucket') && message.includes('not found');
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthorized(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function forbidden(message = 'Forbidden') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

function archivedAccountForbidden() {
  return forbidden('This account has been archived. Please contact an administrator for assistance.');
}

function requireActiveRequester(requester: Requester | null) {
  if (!requester) return unauthorized();
  if (requester.archivedAccount) return archivedAccountForbidden();
  return null;
}

function isMissingArchivedAccountsTableError(error: any) {
  const message = String(error?.message || error?.details || error || '');
  return message.includes("Could not find the table 'public.archived_accounts'");
}

async function getArchivedAccountsTableState() {
  const now = Date.now();
  if (archivedTableStateCache && archivedTableStateCache.expiresAt > now) {
    return archivedTableStateCache.value;
  }
  if (archivedTableStatePromise) {
    return archivedTableStatePromise;
  }

  archivedTableStatePromise = (async () => {
    const { data, error } = await supabase.from('archived_accounts').select('id').limit(1);

    let value: { available: boolean; rows: any[] };
    if (error) {
      if (isMissingArchivedAccountsTableError(error)) {
        value = { available: false, rows: [] };
      } else {
        throw new Error(error.message);
      }
    } else {
      value = { available: true, rows: data || [] };
    }

    archivedTableStateCache = {
      value,
      expiresAt: Date.now() + ARCHIVE_TABLE_STATE_TTL_MS,
    };
    return value;
  })();

  try {
    return await archivedTableStatePromise;
  } finally {
    archivedTableStatePromise = null;
  }
}

async function getArchivedUserIds() {
  const now = Date.now();
  if (archivedUserIdsCache && archivedUserIdsCache.expiresAt > now) {
    return {
      available: archivedUserIdsCache.value.available,
      userIds: new Set(archivedUserIdsCache.value.userIds),
    };
  }

  const state = await getArchivedAccountsTableState();
  if (!state.available) {
    const value = {
      available: false,
      userIds: new Set<string>(),
    };
    archivedUserIdsCache = {
      value,
      expiresAt: Date.now() + ARCHIVED_USER_IDS_TTL_MS,
    };
    return value;
  }

  const { data, error } = await supabase.from('archived_accounts').select('user_id');
  if (error) {
    if (isMissingArchivedAccountsTableError(error)) {
      const value = {
        available: false,
        userIds: new Set<string>(),
      };
      archivedUserIdsCache = {
        value,
        expiresAt: Date.now() + ARCHIVED_USER_IDS_TTL_MS,
      };
      return value;
    }

    throw new Error(error.message);
  }

  const value = {
    available: true,
    userIds: new Set((data || []).map((row) => row.user_id).filter(Boolean)),
  };
  archivedUserIdsCache = {
    value,
    expiresAt: Date.now() + ARCHIVED_USER_IDS_TTL_MS,
  };
  return {
    available: value.available,
    userIds: new Set(value.userIds),
  };
}

function archivedAccountsMigrationRequired() {
  return new Response(JSON.stringify({
    error: 'Archived accounts migration is not applied yet. Run supabase/archived_accounts_migration.sql first.',
  }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  });
}

function invalidateArchivedCaches() {
  archivedTableStateCache = null;
  archivedUserIdsCache = null;
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((bucket) => bucket.name === bucketName);

  if (!exists) {
    await supabase.storage.createBucket(bucketName, { public: false });
  }
}

async function ensureProfile(user: any) {
  const derivedStudentId = deriveStudentIdFromEmail(user.email);
  const normalizedEmail = normalizeEmail(user.email) || null;
  const canSelfProvisionStudent = isValidStudentProvisionEmail(user.email);
  const { firstName, lastName } = deriveNamePartsFromUser(user);
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  if (existingProfile) {
    if (
      existingProfile.role === 'student' &&
      canSelfProvisionStudent &&
      (
        existingProfile.student_id !== derivedStudentId
        || existingProfile.email !== normalizedEmail
        || (firstName && !existingProfile.first_name)
        || (lastName && !existingProfile.last_name)
      )
    ) {
      const { data: updatedProfile, error: updatedProfileError } = await supabase
        .from('profiles')
        .update({
          email: normalizedEmail,
          student_id: derivedStudentId,
          first_name: existingProfile.first_name || firstName,
          last_name: existingProfile.last_name || lastName,
        })
        .eq('id', user.id)
        .select('*')
        .single();

      if (updatedProfileError) {
        throw updatedProfileError;
      }

      return updatedProfile;
    }

    return existingProfile;
  }

  const roleForNewProfile =
    canSelfProvisionStudent ? 'student' : isConfiguredSuperAdminEmail(user?.email) ? 'admin' : null;

  if (!roleForNewProfile) {
    throw new Error('Profile not found for authenticated user.');
  }

  const { data: createdProfile, error: createdProfileError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      role: roleForNewProfile,
      email: normalizedEmail,
      student_id: canSelfProvisionStudent ? derivedStudentId : null,
      first_name: firstName,
      last_name: lastName,
    })
    .select('*')
    .single();

  if (createdProfileError) {
    throw createdProfileError;
  }

  return createdProfile;
}

async function deleteStoredFiles(files: any[]) {
  const filesByBucket = (files || []).reduce((acc, file) => {
    const resolvedBucket = inferStorageBucket(file);
    const storagePath = normalizeStoragePath(file?.storage_path, resolvedBucket);
    if (!resolvedBucket || !storagePath) return acc;
    acc[resolvedBucket] = acc[resolvedBucket] || [];
    acc[resolvedBucket].push(storagePath);
    return acc;
  }, {} as Record<string, string[]>);

  for (const [targetBucket, paths] of Object.entries(filesByBucket)) {
    if (!paths.length) continue;
    const uniquePaths = [...new Set(paths)];
    const { error } = await supabase.storage.from(targetBucket).remove(uniquePaths);
    if (error) {
      throw new Error(error.message);
    }
  }
}

async function listStoragePaths(bucket: string, prefix: string) {
  const cleanedPrefix = String(prefix || '').replace(/^\/+/, '');
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(cleanedPrefix, {
      limit: 1000,
      offset,
    });

    if (error) {
      if (isMissingStorageBucketError(error)) return [];
      throw new Error(error.message);
    }

    if (!data?.length) break;

    for (const item of data) {
      if (!item?.name) continue;
      if (!item?.id && !item?.metadata) continue;
      const fullPath = cleanedPrefix ? `${cleanedPrefix}${item.name}` : item.name;
      paths.push(fullPath);
    }

    if (data.length < 1000) break;
    offset += data.length;
  }

  return paths;
}

async function deleteStoragePrefix(bucket: string, prefix: string) {
  const paths = await listStoragePaths(bucket, prefix);
  if (!paths.length) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw new Error(error.message);
}

async function deleteStoragePrefixes(buckets: string[], prefixes: string[]) {
  for (const bucket of buckets) {
    for (const prefix of prefixes) {
      if (!prefix) continue;
      await deleteStoragePrefix(bucket, prefix);
    }
  }
}

async function setArchivedAuthState(userId: string) {
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  } as any);

  if (error) {
    throw new Error(error.message);
  }
}

async function clearArchivedAuthState(userId: string) {
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  } as any);

  if (error) {
    throw new Error(error.message);
  }
}

async function reassignAdministratorOwnedRows(userId: string, replacementUserId: string) {
  const { error } = await supabase
    .from('announcements')
    .update({ created_by: replacementUserId })
    .eq('created_by', userId);

  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }
}

async function authenticate(c: any): Promise<Requester | null> {
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return null;
  }

  const user = authData.user;

  if (isRejectedGoogleUser(user)) {
    try {
      await purgeRejectedGoogleUser(user);
    } catch (error) {
      console.log('Failed to purge rejected Google user during authentication:', error);
    }
    return null;
  }

  let archivedAccount = null;
  const { data, error: archivedError } = await supabase
    .from('archived_accounts')
    .select('id,user_id,role,email,display_name,account_identifier,archive_reason,archived_at,snapshot')
    .eq('user_id', user.id)
    .maybeSingle();

  if (archivedError) {
    if (!isMissingArchivedAccountsTableError(archivedError)) {
      return null;
    }
  } else {
    archivedAccount = data || null;
  }

  if (archivedAccount) {
    return {
      user,
      profile: null,
      student: null,
      staff: null,
      archivedAccount,
    };
  }

  let profile = null;
  try {
    profile = await ensureProfile(user);
  } catch {
    return null;
  }

  const [{ data: student }, { data: staff }] = await Promise.all([
    supabase
      .from('students')
      .select('student_id,profile_id,first_name,last_name,middle_initial,department,course,age,sex,birthday,civil_status,contact_number,address')
      .or(`profile_id.eq.${user.id},student_id.eq.${profile.student_id || '__none__'}`)
      .maybeSingle(),
    supabase
      .from('staff_users')
      .select('id,profile_id,email,first_name,last_name,middle_initial,position,phone,is_active')
      .or(`profile_id.eq.${user.id},email.eq.${user.email || '__none__'}`)
      .maybeSingle(),
  ]);

  return {
    user,
    profile: withRuntimeRoleOverrides(profile, user),
    student,
    staff,
    archivedAccount: null,
  };
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

function mapSubmission(row: any, related: Record<string, any>) {
  const student = related.students[row.student_id] || {};
  const emergencyContact = related.emergencyContacts[row.id];
  const medicalHistory = related.medicalHistory[row.id];
  const staffMeasurements = related.staffMeasurements[row.id];
  const reviewer = related.reviewers[row.reviewed_by] || null;
  const xray = related.xray[row.id];
  const cbc = related.cbc[row.id];
  const urinalysis = related.urinalysis[row.id];
  const certificate = related.certificates[row.id];
  const files = latestFilesByType(related.files[row.id] || []);

  return {
    id: row.id,
    studentId: row.student_id,
    firstName: row.first_name || student.first_name || '',
    lastName: row.last_name || student.last_name || '',
    middleInitial: row.middle_initial || student.middle_initial || '',
    course: row.course || student.course || '',
    department: row.department || student.department || '',
    year: String(row.year_level || student.year_level || ''),
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
    photoUrl: files.photo?.url,
    signatureUrl: files.signature?.url,
    xrayFileUrl: files.xray?.url,
    cbcFileUrl: files.cbc?.url,
    urinalysisFileUrl: files.urinalysis?.url,
    certificatePdfUrl: files.certificate?.url || certificate?.pdf_url,
    labTestLocation: row.lab_test_location || '',
    otherClinicName: row.lab_test_clinic || '',
  };
}

async function loadRelatedData(rows: any[]) {
  const submissionIds = rows.map((row) => row.id);
  const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];
  const reviewerIds = [...new Set(rows.map((row) => row.reviewed_by).filter(Boolean))];

  const [
    studentsRes,
    emergencyContactsRes,
    medicalHistoryRes,
    staffMeasurementsRes,
    reviewersRes,
    xrayRes,
    cbcRes,
    urinalysisRes,
    certificatesRes,
    filesRes,
  ] = await Promise.all([
    studentIds.length
      ? supabase
          .from('students')
          .select('student_id,profile_id,first_name,last_name,middle_initial,department,course,age,sex,birthday,civil_status,contact_number,address')
          .in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from('emergency_contacts')
          .select('submission_id,name,relationship,phone,address')
          .in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from('medical_history')
          .select('submission_id,allergy,asthma,chicken_pox,diabetes,dysmenorrhea,epilepsy_seizure,heart_disorder,hepatitis,hypertension,measles,mumps,anxiety_disorder,panic_attack,pneumonia,ptb_primary_complex,typhoid_fever,covid19,uti')
          .in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from('staff_measurements')
          .select('submission_id,blood_pressure,cardiac_rate,respiratory_rate,temperature,weight,height,bmi,visual_acuity,skin,heent,chest_lungs,heart,abdomen,extremities,others,examined_by')
          .in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    reviewerIds.length
      ? supabase
          .from('staff_users')
          .select('id,first_name,last_name,middle_initial,position,name')
          .in('id', reviewerIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from('lab_chest_xray')
          .select('submission_id,xray_date,xray_result,xray_findings,file_id')
          .in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from('lab_cbc')
          .select('submission_id,cbc_date,hemoglobin,hematocrit,wbc,platelet_count,blood_type,glucose,protein,file_id')
          .in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from('lab_urinalysis')
          .select('submission_id,urinalysis_date,glucose,protein,file_id')
          .in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from('certificates')
          .select('submission_id,findings_normal,diagnosis,remarks,purpose,control_no,issued_date,issued_at,pdf_url')
          .in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from('files')
          .select('id,submission_id,type,file_name,mime_type,url,storage_bucket,storage_path,uploaded_at,uploaded_by')
          .in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const byKey = (rowsData: any[] | null | undefined, key: string) =>
    (rowsData || []).reduce((acc, item) => {
      acc[item[key]] = item;
      return acc;
    }, {} as Record<string, any>);

  const normalizedFiles = await normalizeFileRows(filesRes.data);
  const filesBySubmission = normalizedFiles.reduce((acc, file) => {
    acc[file.submission_id] = acc[file.submission_id] || [];
    acc[file.submission_id].push(file);
    return acc;
  }, {} as Record<string, any[]>);

  return {
    students: byKey(studentsRes.data, 'student_id'),
    emergencyContacts: byKey(emergencyContactsRes.data, 'submission_id'),
    medicalHistory: byKey(medicalHistoryRes.data, 'submission_id'),
    staffMeasurements: byKey(staffMeasurementsRes.data, 'submission_id'),
    reviewers: byKey(reviewersRes.data, 'id'),
    xray: byKey(xrayRes.data, 'submission_id'),
    cbc: byKey(cbcRes.data, 'submission_id'),
    urinalysis: byKey(urinalysisRes.data, 'submission_id'),
    certificates: byKey(certificatesRes.data, 'submission_id'),
    files: filesBySubmission,
  };
}

async function getMappedSubmissions(queryBuilder: any) {
  const { data, error } = await queryBuilder.order('submitted_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data || [];
  const related = await loadRelatedData(rows);
  return rows.map((row: any) => mapSubmission(row, related));
}

const ACTIONABLE_SUBMISSION_STATUSES = ['pending', 'in_review', 'returned', 'resubmitted'];

function mapSubmissionSummary(row: any, reviewers: Record<string, any> = {}) {
  const reviewer = reviewers[row.reviewed_by] || null;
  return {
    id: row.id,
    studentId: row.student_id || '',
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    middleInitial: row.middle_initial || '',
    course: row.course || '',
    department: row.department || '',
    year: String(row.year_level || ''),
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    reviewedByStaffId: row.reviewed_by || undefined,
    reviewedByName: formatStaffDisplayName(reviewer) || undefined,
    reviewedByPosition: normalizeNamePart(reviewer?.position) || undefined,
  };
}

async function mapSubmissionSummaries(rows: any[], reviewerDirectory?: Record<string, any>) {
  const resolvedReviewerDirectory =
    reviewerDirectory
      || await loadStaffUsersByIds((rows || []).map((row) => row.reviewed_by).filter(Boolean));

  return (rows || []).map((row) => mapSubmissionSummary(row, resolvedReviewerDirectory));
}

function normalizeIlikeValue(value: string) {
  return String(value || '').trim().replace(/[%_,]/g, ' ');
}

function normalizePositiveInteger(value: unknown, fallback: number, maxValue: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), maxValue);
}

function normalizePage(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

function normalizeSortOrder(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function normalizeSubmissionStatusFilter(value: unknown) {
  const normalized = String(value || 'action_needed').trim().toLowerCase();
  if (normalized === 'all' || normalized === 'action_needed') return normalized;
  return ACTIONABLE_SUBMISSION_STATUSES.includes(normalized) || normalized === 'approved' || normalized === 'physical_exam_done'
    ? normalized
    : 'action_needed';
}

function normalizeYearFilter(value: unknown) {
  const normalized = String(value || '').trim();
  return ['1', '2', '3', '4'].includes(normalized) ? normalized : '';
}

function normalizeDateFilter(value: unknown) {
  const normalized = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function buildSubmissionSummaryCacheKey(input: Record<string, unknown>) {
  return JSON.stringify(input);
}

function applySubmissionSummaryFilters(queryBuilder: any, options: any = {}) {
  let query = queryBuilder;
  const statusFilter = normalizeSubmissionStatusFilter(options.statusFilter);
  const searchQuery = normalizeIlikeValue(options.searchQuery || '');
  const departmentFilter = String(options.departmentFilter || '').trim();
  const yearFilter = normalizeYearFilter(options.yearFilter);

  if (statusFilter === 'action_needed') {
    query = query.in('status', ACTIONABLE_SUBMISSION_STATUSES);
  } else if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  if (searchQuery) {
    query = query.or(
      `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,student_id.ilike.%${searchQuery}%`,
    );
  }

  if (departmentFilter && departmentFilter !== 'all') {
    query = query.or(
      `department.eq.${departmentFilter},course.ilike.%${normalizeIlikeValue(departmentFilter)}%`,
    );
  }

  if (yearFilter) {
    query = query.eq('year_level', Number(yearFilter));
  }

  return query;
}

function applyApprovedStudentFilters(queryBuilder: any, options: any = {}) {
  let query = queryBuilder.eq('status', 'approved');
  const searchQuery = normalizeIlikeValue(options.searchQuery || '');
  const departmentFilter = String(options.departmentFilter || '').trim();
  const yearFilter = normalizeYearFilter(options.yearFilter);
  const courseFilter = String(options.courseFilter || '').trim();
  const fromDate = normalizeDateFilter(options.fromDate);
  const toDate = normalizeDateFilter(options.toDate);

  if (searchQuery) {
    query = query.or(
      `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,student_id.ilike.%${searchQuery}%,course.ilike.%${searchQuery}%`,
    );
  }

  if (departmentFilter && departmentFilter !== 'all') {
    query = query.or(
      `department.eq.${departmentFilter},course.ilike.%${normalizeIlikeValue(departmentFilter)}%`,
    );
  }

  if (yearFilter) {
    query = query.eq('year_level', Number(yearFilter));
  }

  if (courseFilter && courseFilter !== 'all') {
    query = query.eq('course', courseFilter);
  }

  if (fromDate) {
    query = query.gte('updated_at', `${fromDate}T00:00:00.000Z`);
  }

  if (toDate) {
    query = query.lte('updated_at', `${toDate}T23:59:59.999Z`);
  }

  return query;
}

async function loadStaffDashboardOverview() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [
    { count: totalSubmissions, error: totalSubmissionsError },
    { count: approvedRecords, error: approvedError },
    { count: pendingRecords, error: pendingError },
    { count: inReviewRecords, error: inReviewError },
    { count: returnedRecords, error: returnedError },
    { count: resubmittedRecords, error: resubmittedError },
    { count: submittedToday, error: todayError },
    { count: submittedYesterday, error: yesterdayError },
    { data: pendingQueueRows, error: pendingQueueError },
    { data: inReviewQueueRows, error: inReviewQueueError },
    { data: returnedQueueRows, error: returnedQueueError },
    { data: resubmittedQueueRows, error: resubmittedQueueError },
  ] = await Promise.all([
    supabase.from('submissions').select('id', { count: 'exact', head: true }),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'in_review'),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'returned'),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'resubmitted'),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).gte('submitted_at', today.toISOString()),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).gte('submitted_at', yesterday.toISOString()).lt('submitted_at', today.toISOString()),
    supabase.from('submissions').select(SUBMISSION_SUMMARY_COLUMNS).eq('status', 'pending').order('submitted_at', { ascending: false }).limit(STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS),
    supabase.from('submissions').select(SUBMISSION_SUMMARY_COLUMNS).eq('status', 'in_review').order('submitted_at', { ascending: false }).limit(STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS),
    supabase.from('submissions').select(SUBMISSION_SUMMARY_COLUMNS).eq('status', 'returned').order('submitted_at', { ascending: false }).limit(STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS),
    supabase.from('submissions').select(SUBMISSION_SUMMARY_COLUMNS).eq('status', 'resubmitted').order('submitted_at', { ascending: false }).limit(STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS),
  ]);

  if (totalSubmissionsError) throw new Error(totalSubmissionsError.message);
  if (approvedError) throw new Error(approvedError.message);
  if (pendingError) throw new Error(pendingError.message);
  if (inReviewError) throw new Error(inReviewError.message);
  if (returnedError) throw new Error(returnedError.message);
  if (resubmittedError) throw new Error(resubmittedError.message);
  if (todayError) throw new Error(todayError.message);
  if (yesterdayError) throw new Error(yesterdayError.message);
  if (pendingQueueError) throw new Error(pendingQueueError.message);
  if (inReviewQueueError) throw new Error(inReviewQueueError.message);
  if (returnedQueueError) throw new Error(returnedQueueError.message);
  if (resubmittedQueueError) throw new Error(resubmittedQueueError.message);
  const reviewerDirectory = await loadStaffUsersByIds([
    ...(pendingQueueRows || []).map((row: any) => row.reviewed_by),
    ...(inReviewQueueRows || []).map((row: any) => row.reviewed_by),
    ...(returnedQueueRows || []).map((row: any) => row.reviewed_by),
    ...(resubmittedQueueRows || []).map((row: any) => row.reviewed_by),
  ]);

  const [
    pendingQueueItems,
    inReviewQueueItems,
    returnedQueueItems,
    resubmittedQueueItems,
  ] = await Promise.all([
    mapSubmissionSummaries(pendingQueueRows || [], reviewerDirectory),
    mapSubmissionSummaries(inReviewQueueRows || [], reviewerDirectory),
    mapSubmissionSummaries(returnedQueueRows || [], reviewerDirectory),
    mapSubmissionSummaries(resubmittedQueueRows || [], reviewerDirectory),
  ]);

  return {
    totalSubmissions: totalSubmissions || 0,
    approvedRecords: approvedRecords || 0,
    pendingRecords: pendingRecords || 0,
    inReviewRecords: inReviewRecords || 0,
    returnedRecords: returnedRecords || 0,
    resubmittedRecords: resubmittedRecords || 0,
    actionableRecords: (pendingRecords || 0) + (inReviewRecords || 0) + (returnedRecords || 0) + (resubmittedRecords || 0),
    submittedToday: submittedToday || 0,
    submittedYesterday: submittedYesterday || 0,
    pendingQueueItems,
    inReviewQueueItems,
    returnedQueueItems,
    resubmittedQueueItems,
  };
}

async function getCachedStaffDashboardOverview() {
  const cached = getValidCachedValue(staffDashboardOverviewCache);
  if (cached) return cached;
  if (staffDashboardOverviewPromise) return staffDashboardOverviewPromise;

  staffDashboardOverviewPromise = (async () => {
    const overview = await loadStaffDashboardOverview();
    staffDashboardOverviewCache = createTimedValue(overview, STAFF_DASHBOARD_OVERVIEW_TTL_MS);
    return overview;
  })().finally(() => {
    staffDashboardOverviewPromise = null;
  });

  return staffDashboardOverviewPromise;
}

async function loadStaffSubmissionSummaries(options: any = {}) {
  const page = normalizePage(options.page);
  const pageSize = normalizePositiveInteger(
    options.pageSize,
    STAFF_SUBMISSION_SUMMARIES_DEFAULT_PAGE_SIZE,
    STAFF_SUBMISSION_SUMMARIES_MAX_PAGE_SIZE,
  );
  const sortOrder = normalizeSortOrder(options.sortOrder);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('submissions').select(SUBMISSION_SUMMARY_COLUMNS, { count: 'exact' });
  query = applySubmissionSummaryFilters(query, options);
  query = query.order('submitted_at', { ascending: sortOrder === 'asc' }).range(from, to);

  const [{ data, error, count }, overview] = await Promise.all([
    query,
    getCachedStaffDashboardOverview(),
  ]);

  if (error) throw new Error(error.message);
  const items = await mapSubmissionSummaries(data || []);

  return {
    items,
    total: count || 0,
    page,
    pageSize,
    counts: {
      pending: overview.pendingRecords,
      inReview: overview.inReviewRecords,
      returned: overview.returnedRecords,
      resubmitted: overview.resubmittedRecords,
      actionNeeded: overview.actionableRecords,
    },
  };
}

async function getCachedStaffSubmissionSummaries(options: any = {}) {
  const normalized = {
    searchQuery: String(options.searchQuery || '').trim(),
    statusFilter: normalizeSubmissionStatusFilter(options.statusFilter),
    departmentFilter: String(options.departmentFilter || '').trim(),
    yearFilter: normalizeYearFilter(options.yearFilter),
    sortOrder: normalizeSortOrder(options.sortOrder),
    page: normalizePage(options.page),
    pageSize: normalizePositiveInteger(
      options.pageSize,
      STAFF_SUBMISSION_SUMMARIES_DEFAULT_PAGE_SIZE,
      STAFF_SUBMISSION_SUMMARIES_MAX_PAGE_SIZE,
    ),
  };
  const cacheKey = buildSubmissionSummaryCacheKey(normalized);
  const cached = getValidCachedValue(staffSubmissionSummariesCache.get(cacheKey));
  if (cached) return cached;

  const inFlight = staffSubmissionSummariesPromises.get(cacheKey);
  if (inFlight) return inFlight;

  const nextPromise = (async () => {
    const result = await loadStaffSubmissionSummaries(normalized);
    staffSubmissionSummariesCache.set(cacheKey, createTimedValue(result, STAFF_SUBMISSION_SUMMARIES_TTL_MS));
    return result;
  })().finally(() => {
    staffSubmissionSummariesPromises.delete(cacheKey);
  });

  staffSubmissionSummariesPromises.set(cacheKey, nextPromise);
  return nextPromise;
}

async function loadActiveStudentsByIds(studentIds: string[]) {
  const uniqueStudentIds = [
    ...new Set((studentIds || []).map((value) => String(value || '').trim()).filter(Boolean)),
  ];
  if (!uniqueStudentIds.length) {
    return {} as Record<string, any>;
  }

  const [{ data, error }, archivedUsers] = await Promise.all([
    supabase
      .from('students')
      .select('student_id,profile_id,first_name,last_name,middle_initial,department,course')
      .in('student_id', uniqueStudentIds),
    getArchivedUserIds().catch(() => ({ available: false, userIds: new Set<string>() })),
  ]);

  if (error) throw new Error(error.message);

  return (data || []).reduce((acc, student) => {
    const studentId = String(student?.student_id || '').trim();
    const profileId = String(student?.profile_id || '').trim();
    const isArchived =
      archivedUsers.available && profileId
        ? archivedUsers.userIds.has(profileId)
        : false;
    if (!studentId || !profileId || isArchived) {
      return acc;
    }
    acc[studentId] = student;
    return acc;
  }, {} as Record<string, any>);
}

async function loadApprovedStudents(options: any = {}) {
  const page = normalizePage(options.page);
  const pageSize = normalizePositiveInteger(
    options.pageSize,
    STAFF_APPROVED_STUDENTS_DEFAULT_PAGE_SIZE,
    STAFF_APPROVED_STUDENTS_MAX_PAGE_SIZE,
  );

  let query = supabase.from('submissions').select(SUBMISSION_SUMMARY_COLUMNS);
  query = applyApprovedStudentFilters(query, options);
  query = query.order('updated_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const activeStudentsById = await loadActiveStudentsByIds(
    (data || []).map((row: any) => row.student_id),
  );

  const groups = new Map<string, any>();

  for (const row of data || []) {
    const summary = mapSubmissionSummary(row);
    const activeStudent = activeStudentsById[summary.studentId];
    if (!summary.studentId || !activeStudent) continue;

    const existing = groups.get(summary.studentId);
    const currentTimestamp = new Date(summary.updatedAt || summary.submittedAt || 0).getTime();
    const resolvedFirstName = summary.firstName || activeStudent.first_name || '';
    const resolvedLastName = summary.lastName || activeStudent.last_name || '';
    const resolvedMiddleInitial = summary.middleInitial || activeStudent.middle_initial || '';
    const resolvedCourse = summary.course || activeStudent.course || '';
    const resolvedDepartment = summary.department || activeStudent.department || '';

    if (!existing) {
      groups.set(summary.studentId, {
        studentId: summary.studentId,
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        middleInitial: resolvedMiddleInitial,
        course: resolvedCourse,
        department: resolvedDepartment,
        latestSubmittedAt: summary.submittedAt,
        latestUpdatedAt: summary.updatedAt,
        approvedCount: 1,
        records: [
          {
            id: summary.id,
            year: summary.year,
            submittedAt: summary.submittedAt,
            updatedAt: summary.updatedAt,
          },
        ],
      });
      continue;
    }

    existing.approvedCount += 1;
    existing.records.push({
      id: summary.id,
      year: summary.year,
      submittedAt: summary.submittedAt,
      updatedAt: summary.updatedAt,
    });

    const existingTimestamp = new Date(existing.latestUpdatedAt || existing.latestSubmittedAt || 0).getTime();
    if (currentTimestamp >= existingTimestamp) {
      existing.firstName = resolvedFirstName;
      existing.lastName = resolvedLastName;
      existing.middleInitial = resolvedMiddleInitial;
      existing.course = resolvedCourse;
      existing.department = resolvedDepartment;
      existing.latestSubmittedAt = summary.submittedAt;
      existing.latestUpdatedAt = summary.updatedAt;
    }
  }

  const students = Array.from(groups.values())
    .map((student) => ({
      ...student,
      records: student.records.sort((a: any, b: any) => {
        const yearDifference = Number.parseInt(a.year || '0', 10) - Number.parseInt(b.year || '0', 10);
        if (yearDifference !== 0) return yearDifference;
        return new Date((b.updatedAt || b.submittedAt || 0)).getTime() - new Date((a.updatedAt || a.submittedAt || 0)).getTime();
      }),
    }))
    .sort((a, b) => new Date(b.latestUpdatedAt || b.latestSubmittedAt || 0).getTime() - new Date(a.latestUpdatedAt || a.latestSubmittedAt || 0).getTime());

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

async function getCachedApprovedStudents(options: any = {}) {
  const normalized = {
    searchQuery: String(options.searchQuery || '').trim(),
    departmentFilter: String(options.departmentFilter || '').trim(),
    yearFilter: normalizeYearFilter(options.yearFilter),
    courseFilter: String(options.courseFilter || '').trim(),
    fromDate: normalizeDateFilter(options.fromDate),
    toDate: normalizeDateFilter(options.toDate),
    page: normalizePage(options.page),
    pageSize: normalizePositiveInteger(
      options.pageSize,
      STAFF_APPROVED_STUDENTS_DEFAULT_PAGE_SIZE,
      STAFF_APPROVED_STUDENTS_MAX_PAGE_SIZE,
    ),
  };
  const cacheKey = buildSubmissionSummaryCacheKey(normalized);
  const cached = getValidCachedValue(staffApprovedStudentsCache.get(cacheKey));
  if (cached) return cached;

  const inFlight = staffApprovedStudentsPromises.get(cacheKey);
  if (inFlight) return inFlight;

  const nextPromise = (async () => {
    const result = await loadApprovedStudents(normalized);
    staffApprovedStudentsCache.set(cacheKey, createTimedValue(result, STAFF_APPROVED_STUDENTS_TTL_MS));
    return result;
  })().finally(() => {
    staffApprovedStudentsPromises.delete(cacheKey);
  });

  staffApprovedStudentsPromises.set(cacheKey, nextPromise);
  return nextPromise;
}

async function loadAnalyticsSummary() {
  const [
    { count: totalStudents, error: totalStudentsError },
    { count: totalSubmissions, error: totalSubmissionsError },
    { count: pendingRecords, error: pendingError },
    { count: approvedRecords, error: approvedError },
    { count: returnedRecords, error: returnedError },
  ] = await Promise.all([
    supabase.from('students').select('student_id', { count: 'exact', head: true }),
    supabase.from('submissions').select('id', { count: 'exact', head: true }),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_review']),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'returned'),
  ]);

  if (totalStudentsError) throw new Error(totalStudentsError.message);
  if (totalSubmissionsError) throw new Error(totalSubmissionsError.message);
  if (pendingError) throw new Error(pendingError.message);
  if (approvedError) throw new Error(approvedError.message);
  if (returnedError) throw new Error(returnedError.message);

  return {
    totalStudents: totalStudents || 0,
    pendingRecords: pendingRecords || 0,
    approvedRecords: approvedRecords || 0,
    returnedRecords: returnedRecords || 0,
    totalSubmissions: totalSubmissions || 0,
  };
}

async function getCachedAnalyticsSummary() {
  const cached = getValidCachedValue(analyticsReadCache);
  if (cached) return cached;
  if (analyticsReadPromise) return analyticsReadPromise;

  analyticsReadPromise = (async () => {
    const analytics = await loadAnalyticsSummary();
    analyticsReadCache = createTimedValue(analytics, ANALYTICS_CACHE_TTL_MS);
    return analytics;
  })().finally(() => {
    analyticsReadPromise = null;
  });

  return analyticsReadPromise;
}

async function getCachedSubmissionsList() {
  const cached = getValidCachedValue(submissionsReadCache);
  if (cached) return cached;
  if (submissionsReadPromise) return submissionsReadPromise;

  submissionsReadPromise = (async () => {
    const submissions = await getMappedSubmissions(
      supabase.from('submissions').select(SUBMISSION_LIST_COLUMNS),
    );
    submissionsReadCache = createTimedValue(submissions, SUBMISSIONS_CACHE_TTL_MS);
    return submissions;
  })().finally(() => {
    submissionsReadPromise = null;
  });

  return submissionsReadPromise;
}

async function getCachedStudentRecords(studentId: string) {
  const cacheKey = String(studentId || '').trim();
  const cached = getValidCachedValue(studentRecordsReadCache.get(cacheKey));
  if (cached) return cached;

  const inFlight = studentRecordsReadPromises.get(cacheKey);
  if (inFlight) return inFlight;

  const nextPromise = (async () => {
    const records = await getMappedSubmissions(
      supabase.from('submissions').select(SUBMISSION_LIST_COLUMNS).eq('student_id', cacheKey),
    );
    studentRecordsReadCache.set(cacheKey, createTimedValue(records, STUDENT_RECORDS_CACHE_TTL_MS));
    return records;
  })().finally(() => {
    studentRecordsReadPromises.delete(cacheKey);
  });

  studentRecordsReadPromises.set(cacheKey, nextPromise);
  return nextPromise;
}

async function requireSubmissionAccess(requester: Requester, submissionId: string) {
  const { data: submission, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', submissionId)
    .maybeSingle();

  if (error || !submission) {
    return { response: new Response(JSON.stringify({ error: 'Record not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }) };
  }

  if (!isStaffRole(requester.profile.role) && requester.profile.student_id !== submission.student_id) {
    return { response: forbidden() };
  }

  return { submission };
}

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/auth/reject-google-account", async (c) => {
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return unauthorized();

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return unauthorized();
  }

  const user = authData.user;
  if (!isRejectedGoogleUser(user)) {
    return c.json({ success: true, deleted: false });
  }

  try {
    await purgeRejectedGoogleUser(user);
    return c.json({ success: true, deleted: true });
  } catch (error) {
    console.log('Failed to purge rejected Google user:', error);
    return internalServerError(c, 'Failed to reject unauthorized Google account', error);
  }
});

app.get("/me", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  return c.json({
    profile: requester.profile,
    student: requester.student,
    staff: requester.staff,
  });
});

app.put("/student-profile", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const data = await c.req.json();
    const studentId = requester.profile.student_id || requester.student?.student_id || data.studentId;

    if (!studentId) {
      return badRequest('Student ID is required');
    }

    const firstName = String(data.firstName || '').trim() || null;
    const lastName = String(data.lastName || '').trim() || null;
    const middleInitial = String(data.middleInitial || '').trim() || null;
    const department = String(data.department || '').trim() || null;
    const course = String(data.course || '').trim() || null;
    const age = data.age ? Number(data.age) : null;
    const sex = String(data.sex || '').trim() || null;
    const birthday = String(data.birthday || '').trim() || null;
    const civilStatus = String(data.civilStatus || '').trim() || null;
    const contactNumber = String(data.contactNumber || '').trim() || null;
    const address = String(data.address || '').trim() || null;

    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        department,
        course,
        student_id: studentId,
      })
      .eq('id', requester.profile.id)
      .select('*')
      .single();

    if (profileError || !updatedProfile) {
      throw new Error(profileError?.message || 'Failed to update profile');
    }

    const { data: updatedStudent, error: studentError } = await supabase
      .from('students')
      .upsert({
        student_id: studentId,
        profile_id: requester.profile.id,
        first_name: firstName,
        last_name: lastName,
        middle_initial: middleInitial,
        department,
        course,
        age: Number.isFinite(age) ? age : null,
        sex,
        birthday,
        civil_status: civilStatus,
        contact_number: contactNumber,
        address,
      }, {
        onConflict: 'student_id',
      })
      .select('*')
      .single();

    if (studentError || !updatedStudent) {
      throw new Error(studentError?.message || 'Failed to update student record');
    }

    return c.json({
      success: true,
      profile: updatedProfile,
      student: updatedStudent,
    });
  } catch (error) {
    console.log('Error updating student profile:', error);
    return internalServerError(c, 'Failed to update student profile', error);
  }
});

app.post("/submit-record", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const data = await c.req.json();
    const studentId = requester.profile.student_id || data.studentId;

    if (!studentId) {
      return badRequest('Student ID is required');
    }

    const studentPayload = {
      student_id: studentId,
      profile_id: requester.profile.id,
      first_name: data.firstName,
      last_name: data.lastName,
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

    const { error: studentError } = await supabase.from('students').upsert(studentPayload, {
      onConflict: 'student_id',
    });

    if (studentError) throw new Error(studentError.message);

    const { data: insertedSubmission, error: submissionError } = await supabase
      .from('submissions')
      .insert({
        student_id: studentId,
        year_level: Number(data.yearLevel),
        status: 'pending',
        first_name: data.firstName,
        last_name: data.lastName,
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
      })
      .select('*')
      .single();

    if (submissionError || !insertedSubmission) {
      throw new Error(submissionError?.message || 'Failed to create submission');
    }

    const submissionId = insertedSubmission.id;

    await Promise.all([
      supabase.from('emergency_contacts').upsert({
        submission_id: submissionId,
        name: data.emergencyContact?.name || null,
        relationship: data.emergencyContact?.relationship || null,
        phone: data.emergencyContact?.phone || null,
        address: data.emergencyContact?.address || null,
      }),
      supabase.from('medical_history').upsert({
        submission_id: submissionId,
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
    ]);

    invalidateDashboardReadCaches();
    return c.json({ success: true, recordId: submissionId });
  } catch (error) {
    console.log('Error submitting medical record:', error);
    return internalServerError(c, 'Failed to submit record', error);
  }
});

app.get("/student-records", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    if (!requester.profile.student_id && !isStaffRole(requester.profile.role)) {
      return badRequest('Student ID not found in profile');
    }

    const records = await getCachedStudentRecords(requester.profile.student_id);

    return c.json({ records });
  } catch (error) {
    console.log('Error fetching student records:', error);
    return internalServerError(c, 'Failed to fetch records', error);
  }
});

app.get("/student-records/:studentId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const studentId = c.req.param('studentId');
    const targetStudentId = isStaffRole(requester.profile.role) ? studentId : requester.profile.student_id;

    const records = await getCachedStudentRecords(targetStudentId);

    return c.json({ records });
  } catch (error) {
    console.log('Error fetching student records:', error);
    return internalServerError(c, 'Failed to fetch records', error);
  }
});

app.get("/submissions", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const submissions = await getCachedSubmissionsList();
    return c.json({ submissions });
  } catch (error) {
    console.log('Error fetching submissions:', error);
    return internalServerError(c, 'Failed to fetch submissions', error);
  }
});

app.get("/staff/dashboard-overview", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    return c.json(await getCachedStaffDashboardOverview());
  } catch (error) {
    console.log('Error fetching staff dashboard overview:', error);
    return internalServerError(c, 'Failed to fetch staff dashboard overview', error);
  }
});

app.get("/staff/submission-summaries", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const searchQuery = String(c.req.query('search') || '').trim();
    const statusFilter = String(c.req.query('status') || 'action_needed').trim();
    const departmentFilter = String(c.req.query('department') || '').trim();
    const yearFilter = String(c.req.query('year') || '').trim();
    const sortOrder = String(c.req.query('sort') || 'desc').trim();
    const page = c.req.query('page');
    const pageSize = c.req.query('pageSize');

    return c.json(
      await getCachedStaffSubmissionSummaries({
        searchQuery,
        statusFilter,
        departmentFilter,
        yearFilter,
        sortOrder,
        page,
        pageSize,
      }),
    );
  } catch (error) {
    console.log('Error fetching staff submission summaries:', error);
    return internalServerError(c, 'Failed to fetch staff submission summaries', error);
  }
});

app.get("/staff/approved-students", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const searchQuery = String(c.req.query('search') || '').trim();
    const departmentFilter = String(c.req.query('department') || '').trim();
    const yearFilter = String(c.req.query('year') || '').trim();
    const courseFilter = String(c.req.query('course') || '').trim();
    const fromDate = String(c.req.query('fromDate') || '').trim();
    const toDate = String(c.req.query('toDate') || '').trim();
    const page = c.req.query('page');
    const pageSize = c.req.query('pageSize');

    return c.json(
      await getCachedApprovedStudents({
        searchQuery,
        departmentFilter,
        yearFilter,
        courseFilter,
        fromDate,
        toDate,
        page,
        pageSize,
      }),
    );
  } catch (error) {
    console.log('Error fetching approved student summaries:', error);
    return internalServerError(c, 'Failed to fetch approved student summaries', error);
  }
});

app.get("/submission/:id", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const id = c.req.param('id');
    const access = await requireSubmissionAccess(requester, id);
    if (access.response) return access.response;

    const [submission] = await getMappedSubmissions(
      supabase.from('submissions').select(SUBMISSION_LIST_COLUMNS).eq('id', id),
    );

    return c.json({ submission });
  } catch (error) {
    console.log('Error fetching submission:', error);
    return internalServerError(c, 'Failed to fetch submission', error);
  }
});

app.put("/submission/:id/status", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const id = c.req.param('id');
    const { status, staffNotes } = await c.req.json();
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const now = new Date().toISOString();

    // Only doctors and admins can set statuses that finalize or change clearance
    const doctorOnlyStatuses = ['approved', 'returned', 'physical_exam_done'];
    if (doctorOnlyStatuses.includes(normalizedStatus) && !isDoctorOrAdmin(requester)) {
      return c.json({ error: 'Only Clinic Doctors can approve, return, or mark physical exam done.' }, 403);
    }

    if (normalizedStatus === 'in_review') {
      const reviewerId = String(requester.staff?.id || '').trim();
      if (!reviewerId) {
        return badRequest('Staff account is not linked to this user.');
      }

      const { data: claimedRows, error: claimError } = await supabase
        .from('submissions')
        .update({
          status: normalizedStatus,
          staff_notes: staffNotes || null,
          reviewed_by: reviewerId,
          updated_at: now,
        })
        .eq('id', id)
        .in('status', ['pending', 'resubmitted'])
        .select('id');

      if (claimError) throw new Error(claimError.message);

      if ((claimedRows || []).length === 0) {
        const { data: currentSubmission, error: currentSubmissionError } = await supabase
          .from('submissions')
          .select('id,status,reviewed_by')
          .eq('id', id)
          .maybeSingle();

        if (currentSubmissionError) throw new Error(currentSubmissionError.message);
        if (!currentSubmission) {
          return c.json({ error: 'Submission not found.' }, 404);
        }

        if (currentSubmission.status === 'in_review' && currentSubmission.reviewed_by === reviewerId) {
          const { error: ownUpdateError } = await supabase
            .from('submissions')
            .update({
              staff_notes: staffNotes || null,
              updated_at: now,
            })
            .eq('id', id)
            .eq('reviewed_by', reviewerId);

          if (ownUpdateError) throw new Error(ownUpdateError.message);

          invalidateDashboardReadCaches();
          return c.json({ success: true });
        }

        if (currentSubmission.status === 'in_review' && currentSubmission.reviewed_by) {
          const reviewerDirectory = await loadStaffUsersByIds([currentSubmission.reviewed_by]);
          const reviewerName =
            formatStaffDisplayName(reviewerDirectory[currentSubmission.reviewed_by])
            || 'another clinic staff member';

          return c.json(
            {
              error: 'Submission already being reviewed.',
              details: `This submission is already being reviewed by ${reviewerName}.`,
              reviewedBy: currentSubmission.reviewed_by,
              reviewerName,
            },
            409,
          );
        }

        return c.json(
          {
            error: 'Submission is no longer available to claim.',
            details: 'This submission changed status. Refresh the review queue and try again.',
          },
          409,
        );
      }

      invalidateDashboardReadCaches();
      return c.json({ success: true });
    }

    const { error } = await supabase
      .from('submissions')
      .update({
        status: normalizedStatus,
        staff_notes: staffNotes || null,
        reviewed_by: requester.staff?.id || null,
        updated_at: now,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);

    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error updating submission status:', error);
    return internalServerError(c, 'Failed to update status', error);
  }
});

app.post("/notifications/status-email", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const { submissionId, status, staffNotes } = await c.req.json();
    if (!submissionId || !status) {
      return badRequest('submissionId and status are required');
    }

    const doctorOnlyStatuses = ['approved', 'returned', 'physical_exam_done'];
    if (doctorOnlyStatuses.includes(status) && !isDoctorOrAdmin(requester)) {
      return c.json({ error: 'Only Clinic Doctors can send notifications for this status.' }, 403);
    }

    const result = await sendStatusNotificationEmail(submissionId, status, staffNotes || null);
    return c.json(result);
  } catch (error) {
    console.log('Error sending status email notification:', error);
    return internalServerError(c, 'Failed to send status email notification', error);
  }
});

app.get("/student-notifications/state", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const requestedStudentId = String(c.req.query('studentId') || '').trim();
    const requesterStudentId = getRequesterStudentId(requester);
    const studentId = requestedStudentId || requesterStudentId;
    if (!studentId) return badRequest('studentId is required');
    if (studentId !== requesterStudentId) return forbidden();

    const { data, error } = await supabase
      .from('kv_store_2a5e1a6b')
      .select('value')
      .eq('key', getStudentNotificationStateKey(requester, studentId))
      .maybeSingle();

    if (error) {
      if (isMissingKvStoreError(error)) {
        return c.json({
          state: normalizeStudentNotificationState({}),
        });
      }
      throw new Error(error.message);
    }

    return c.json({
      state: normalizeStudentNotificationState(data?.value || {}),
    });
  } catch (error) {
    console.log('Error fetching student notification state:', error);
    return internalServerError(c, 'Failed to fetch notification state', error);
  }
});

app.put("/student-notifications/state", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const payload = await c.req.json();
    const requestedStudentId = String(payload?.studentId || '').trim();
    const requesterStudentId = getRequesterStudentId(requester);
    const studentId = requestedStudentId || requesterStudentId;
    if (!studentId) return badRequest('studentId is required');
    if (studentId !== requesterStudentId) return forbidden();

    const state = normalizeStudentNotificationState(payload?.state || {});
    const { error } = await supabase
      .from('kv_store_2a5e1a6b')
      .upsert({
        key: getStudentNotificationStateKey(requester, studentId),
        value: state,
      });

    if (error) {
      if (isMissingKvStoreError(error)) {
        return c.json({ success: true, persisted: false });
      }
      throw new Error(error.message);
    }

    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error saving student notification state:', error);
    return internalServerError(c, 'Failed to save notification state', error);
  }
});

app.put("/submission/:id/measurements", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const id = c.req.param('id');
    const measurements = await c.req.json();

    await Promise.all([
      supabase.from('staff_measurements').upsert({
        submission_id: id,
        blood_pressure: measurements.bloodPressure || null,
        cardiac_rate: measurements.cardiacRate || null,
        respiratory_rate: measurements.respiratoryRate || null,
        temperature: measurements.temperature || null,
        weight: measurements.weight || null,
        height: measurements.height || null,
        bmi: measurements.bmi || null,
        updated_by: requester.staff?.id || null,
        updated_at: new Date().toISOString(),
      }),
      supabase.from('lab_chest_xray').upsert({
        submission_id: id,
        xray_date: measurements.xrayDate || null,
        xray_result: measurements.xrayResult || null,
        xray_findings: measurements.xrayFindings || null,
      }),
      supabase.from('lab_cbc').upsert({
        submission_id: id,
        hemoglobin: measurements.hemoglobin || null,
        hematocrit: measurements.hematocrit || null,
        wbc: measurements.wbc || null,
        platelet_count: measurements.plateletCount || null,
        blood_type: measurements.bloodType || null,
        glucose: measurements.glucose || null,
        protein: measurements.protein || null,
      }),
      supabase.from('lab_urinalysis').upsert({
        submission_id: id,
        glucose: measurements.urinalysisGlucose || null,
        protein: measurements.urinalysisProtein || null,
      }),
      supabase.from('submissions').update({
        updated_at: new Date().toISOString(),
      }).eq('id', id),
    ]);

    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error updating measurements:', error);
    return internalServerError(c, 'Failed to update measurements', error);
  }
});

app.post("/upload-file", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    await ensureBucket();

    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const recordId = formData.get('recordId') as string;
    const fileType = formData.get('fileType') as string;

    if (!file || !recordId || !fileType) {
      return badRequest('file, recordId, and fileType are required');
    }

    const access = await requireSubmissionAccess(requester, recordId);
    if (access.response) return access.response;

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${recordId}/${fileType}_${Date.now()}_${safeFileName}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storagePath, signedStorageUrlExpiresSeconds);

    if (signedUrlError) throw new Error(signedUrlError.message);

    const { data: insertedFile, error: fileInsertError } = await supabase
      .from('files')
      .insert({
        submission_id: recordId,
        type: fileType,
        file_name: file.name,
        mime_type: file.type,
        url: null,
        storage_bucket: bucketName,
        storage_path: storagePath,
        uploaded_by: requester.profile.id,
      })
      .select('*')
      .single();

    if (fileInsertError || !insertedFile) {
      throw new Error(fileInsertError?.message || 'Failed to save file metadata');
    }

    if (fileType === 'xray') {
      await supabase.from('lab_chest_xray').upsert({ submission_id: recordId, file_id: insertedFile.id });
    }
    if (fileType === 'cbc') {
      await supabase.from('lab_cbc').upsert({ submission_id: recordId, file_id: insertedFile.id });
    }
    if (fileType === 'urinalysis') {
      await supabase.from('lab_urinalysis').upsert({ submission_id: recordId, file_id: insertedFile.id });
    }

    invalidateDashboardReadCaches();
    return c.json({
      success: true,
      url: signedUrlData?.signedUrl,
      fileName: storagePath,
    });
  } catch (error) {
    console.log('Error in file upload:', error);
    return internalServerError(c, 'Failed to upload file', error);
  }
});

app.get("/analytics", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const analytics = await getCachedAnalyticsSummary();
    return c.json(analytics);
  } catch (error) {
    console.log('Error fetching analytics:', error);
    return internalServerError(c, 'Failed to fetch analytics', error);
  }
});

app.get("/staff-users", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const [{ data: staff, error }, archivedState] = await Promise.all([
      supabase
        .from('staff_users')
        .select('id,profile_id,first_name,last_name,name,position,is_active,email')
        .order('last_name', { ascending: true }),
      getArchivedUserIds(),
    ]);

    if (error) throw new Error(error.message);
    const archivedUserIds = archivedState.userIds;

    return c.json({
      staff: (staff || [])
        .filter((member) => !member.profile_id || !archivedUserIds.has(member.profile_id))
        .map((member) => ({
          id: member.id,
          userId: member.profile_id || member.id,
          name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.name || 'Unnamed Staff',
          role: isDoctorPosition(member.position) ? 'Clinic Doctor' : (member.position || 'Clinic Staff'),
          position: member.position || 'Clinic Staff',
          status: member.is_active ? 'Active' : 'Inactive',
          email: member.email || '',
        })),
    });
  } catch (error) {
    console.log('Error fetching staff users:', error);
    return internalServerError(c, 'Failed to fetch staff users', error);
  }
});

app.get("/user-accounts", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role)) return forbidden();

  try {
    const [
      { data: profiles, error: profilesError },
      { data: staffUsers, error: staffError },
      archivedState,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,student_id,first_name,last_name,email,role,created_at,updated_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('staff_users')
        .select('profile_id,first_name,last_name,email,is_active,position'),
      getArchivedUserIds(),
    ]);

    if (profilesError) throw new Error(profilesError.message);
    if (staffError) throw new Error(staffError.message);

    const staffByProfileId = (staffUsers || []).reduce((acc, staff) => {
      if (staff.profile_id) acc[staff.profile_id] = staff;
      return acc;
    }, {} as Record<string, any>);
    const archivedUserIds = archivedState.userIds;

    return c.json({
      users: (profiles || [])
        .filter((profile) => !archivedUserIds.has(profile.id))
        .map((profile) => {
          const linkedStaff = staffByProfileId[profile.id];
          const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
            || [linkedStaff?.first_name, linkedStaff?.last_name].filter(Boolean).join(' ').trim()
            || profile.email
            || 'Unnamed User';

          return {
            userId: profile.id,
            id: profile.student_id || profile.id,
            name,
            email: profile.email || linkedStaff?.email || '',
            role: roleLabel(profile.role, linkedStaff?.position),
            roleKey: profile.role,
            position: linkedStaff?.position || null,
            status: linkedStaff?.is_active === false ? 'Inactive' : 'Active',
            lastActive: profile.updated_at || profile.created_at,
            canArchive: profile.role === 'student' || profile.role === 'staff',
          };
        }),
    });
  } catch (error) {
    console.log('Error fetching user accounts:', error);
    return internalServerError(c, 'Failed to fetch user accounts', error);
  }
});

app.get("/super-admin/administrators", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');

  try {
    const [{ data: profiles, error }, archivedState] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,first_name,last_name,email,role,created_at,updated_at')
        .eq('role', 'admin')
        .order('created_at', { ascending: false }),
      getArchivedUserIds(),
    ]);

    if (error) throw new Error(error.message);
    const archivedUserIds = archivedState.userIds;

    return c.json({
      administrators: (profiles || [])
        .filter((profile) => !archivedUserIds.has(profile.id))
        .map((profile) => {
          const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
            || profile.email
            || 'Unnamed Administrator';

          return {
            userId: profile.id,
            id: profile.id,
            name,
            email: profile.email || '',
            role: 'Administrator',
            roleKey: 'admin',
            status: 'Active',
            createdAt: profile.created_at,
            lastActive: profile.updated_at || profile.created_at,
          };
        }),
    });
  } catch (error) {
    console.log('Error fetching administrators:', error);
    return internalServerError(c, 'Failed to fetch administrators', error);
  }
});

app.post("/super-admin/administrators", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');

  try {
    const { email, password, firstName, lastName } = await c.req.json();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) return badRequest('email and password are required');
    if (String(password).trim().length < minPasswordLength) return badRequest(passwordLengthError());

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || null,
        last_name: lastName || null,
      },
    });
    if (createError || !created?.user) throw new Error(createError?.message || 'Failed to create administrator');

    const userId = created.user.id;

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      role: 'admin',
      email: normalizedEmail,
      first_name: firstName || null,
      last_name: lastName || null,
      student_id: null,
      department: null,
      course: null,
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId).catch(() => null);
      throw new Error(profileError.message);
    }

    invalidateDashboardReadCaches();
    return c.json({ success: true, userId });
  } catch (error) {
    console.log('Error creating administrator:', error);
    return internalServerError(c, 'Failed to create administrator', error);
  }
});

app.delete("/super-admin/administrators/:userId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');

  try {
    const userId = c.req.param('userId');
    if (!userId) return badRequest('userId is required');
    if (userId === requester.profile.id) return badRequest('You cannot remove your own super administrator account.');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,role,email,first_name,last_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) return badRequest('Administrator account not found.');
    if (!isAdminRole(profile.role)) {
      return badRequest('Only administrator accounts can be removed here.');
    }

    await reassignAdministratorOwnedRows(userId, requester.profile.id);

    const { error: staffDeleteError } = await supabase.from('staff_users').delete().eq('profile_id', userId);
    if (staffDeleteError) throw new Error(staffDeleteError.message);

    const { error: profileDeleteError } = await supabase.from('profiles').delete().eq('id', userId);
    if (profileDeleteError) throw new Error(profileDeleteError.message);

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) throw new Error(authDeleteError.message);

    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error removing administrator:', error);
    return internalServerError(c, 'Failed to remove administrator', error);
  }
});

app.get("/admin/system-settings", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    return c.json(await getAdminSystemSettings());
  } catch (error) {
    console.log('Error fetching admin system settings:', error);
    return internalServerError(c, 'Failed to fetch admin system settings', error);
  }
});

app.put("/admin/system-settings", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const payload = await c.req.json();
    const settings = normalizeAdminSystemSettings(payload);

    const { error } = await supabase
      .from('kv_store_2a5e1a6b')
      .upsert({
        key: ADMIN_SYSTEM_SETTINGS_STORE_KEY,
        value: settings,
      });

    if (error) {
      if (isMissingKvStoreError(error)) {
        return c.json(settings);
      }
      throw new Error(error.message);
    }

    return c.json(settings);
  } catch (error) {
    console.log('Error saving admin system settings:', error);
    return internalServerError(c, 'Failed to save admin system settings', error);
  }
});

app.get("/archived-accounts", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) {
      return c.json({ users: [] });
    }

    const { data: archivedAccounts, error } = await supabase
      .from('archived_accounts')
      .select('id,user_id,account_identifier,display_name,email,role,archived_at,archive_reason')
      .order('archived_at', { ascending: false });

    if (error) throw new Error(error.message);

    return c.json({
      users: (archivedAccounts || []).map((account) => ({
        archiveId: account.id,
        userId: account.user_id,
        id: account.account_identifier || account.user_id,
        name: account.display_name || account.email || 'Archived Account',
        email: account.email || '',
        role: roleLabel(account.role),
        roleKey: account.role,
        status: 'Archived',
        archivedAt: account.archived_at,
        archivedReason: account.archive_reason || '',
      })),
    });
  } catch (error) {
    console.log('Error fetching archived accounts:', error);
    return internalServerError(c, 'Failed to fetch archived accounts', error);
  }
});

app.post("/admin/archive-account", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) return archivedAccountsMigrationRequired();

    const { userId, reason } = await c.req.json();
    if (!userId) return badRequest('userId is required');
    if (userId === requester.profile.id) return badRequest('You cannot archive your own administrator account.');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) return badRequest('User account not found.');
    if (!['student', 'staff'].includes(profile.role)) {
      return badRequest('Only student and clinic staff accounts can be archived.');
    }

    const [{ data: linkedStaff }, { data: linkedStudent }, { data: submissions, error: submissionsError }] = await Promise.all([
      supabase.from('staff_users').select('*').eq('profile_id', userId).maybeSingle(),
      profile.student_id
        ? supabase.from('students').select('*').eq('student_id', profile.student_id).maybeSingle()
        : Promise.resolve({ data: null }),
      profile.student_id
        ? supabase.from('submissions').select('id,submitted_at').eq('student_id', profile.student_id)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    if (submissionsError) throw new Error(submissionsError.message);

    const displayName =
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
      || [linkedStaff?.first_name, linkedStaff?.last_name].filter(Boolean).join(' ').trim()
      || profile.email
      || 'Unnamed User';

    const archivePayload = {
      user_id: userId,
      role: profile.role,
      email: profile.email || linkedStaff?.email || null,
      display_name: displayName,
      account_identifier: profile.student_id || linkedStaff?.id || profile.id,
      archived_by: requester.profile.id,
      archive_reason: reason?.trim() || null,
      snapshot: {
        profile: {
          role: profile.role,
          first_name: profile.first_name || null,
          last_name: profile.last_name || null,
          department: profile.department || null,
          course: profile.course || null,
          student_id: profile.student_id || null,
        },
        student: linkedStudent
          ? {
              student_id: linkedStudent.student_id,
              department: linkedStudent.department || null,
              course: linkedStudent.course || null,
              year_level: linkedStudent.year_level || null,
            }
          : null,
        staff: linkedStaff
          ? {
              position: linkedStaff.position || null,
              is_active: linkedStaff.is_active ?? null,
            }
          : null,
        submissions: {
          count: submissions?.length || 0,
          last_submitted_at: (submissions || [])
            .map((entry) => entry.submitted_at)
            .filter(Boolean)
            .sort()
            .slice(-1)[0] || null,
        },
      },
      archived_at: new Date().toISOString(),
    };

    const { error: archiveError } = await supabase
      .from('archived_accounts')
      .upsert(archivePayload, { onConflict: 'user_id' });

    if (archiveError) throw new Error(archiveError.message);

    if (linkedStaff?.profile_id) {
      const { error: staffUpdateError } = await supabase
        .from('staff_users')
        .update({ is_active: false })
        .eq('profile_id', linkedStaff.profile_id);

      if (staffUpdateError) throw new Error(staffUpdateError.message);
    }

    await setArchivedAuthState(userId);
    invalidateArchivedCaches();
    invalidateDashboardReadCaches();

    return c.json({ success: true });
  } catch (error) {
    console.log('Error archiving account:', error);
    return internalServerError(c, 'Failed to archive account', error);
  }
});

app.post("/admin/restore-account/:archiveId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) return archivedAccountsMigrationRequired();

    const archiveId = c.req.param('archiveId');
    if (!archiveId) return badRequest('archiveId is required');

    const { data: archivedAccount, error: archiveLookupError } = await supabase
      .from('archived_accounts')
      .select('*')
      .eq('id', archiveId)
      .maybeSingle();

    if (archiveLookupError) throw new Error(archiveLookupError.message);
    if (!archivedAccount) return badRequest('Archived account not found.');

    const userId = archivedAccount.user_id;

    const { error: archiveDeleteError } = await supabase.from('archived_accounts').delete().eq('id', archiveId);
    if (archiveDeleteError) throw new Error(archiveDeleteError.message);

    if (archivedAccount.role === 'staff') {
      const { error: staffUpdateError } = await supabase
        .from('staff_users')
        .update({ is_active: true })
        .eq('profile_id', userId);

      if (staffUpdateError) throw new Error(staffUpdateError.message);
    }

    await clearArchivedAuthState(userId);
    invalidateArchivedCaches();
    invalidateDashboardReadCaches();

    return c.json({ success: true });
  } catch (error) {
    console.log('Error restoring account:', error);
    return internalServerError(c, 'Failed to restore account', error);
  }
});

app.delete("/admin/archive-account/:archiveId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) return archivedAccountsMigrationRequired();

    const archiveId = c.req.param('archiveId');
    if (!archiveId) return badRequest('archiveId is required');

    const { data: archivedAccount, error: archiveLookupError } = await supabase
      .from('archived_accounts')
      .select('*')
      .eq('id', archiveId)
      .maybeSingle();

    if (archiveLookupError) throw new Error(archiveLookupError.message);
    if (!archivedAccount) return badRequest('Archived account not found.');

    const userId = archivedAccount.user_id;
    const role = archivedAccount.role;

    const [{ data: profile }, { data: linkedStaff }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('staff_users').select('*').eq('profile_id', userId).maybeSingle(),
    ]);

    if (role === 'student') {
      const studentId =
        profile?.student_id
        || archivedAccount.snapshot?.student?.student_id
        || archivedAccount.snapshot?.profile?.student_id
        || null;

      if (studentId) {
        const { data: profileAssetFiles, error: profileAssetError } = await supabase
          .from('files')
          .select('*')
          .eq('uploaded_by', userId)
          .is('submission_id', null);

        if (profileAssetError) throw new Error(profileAssetError.message);
        await deleteStoredFiles(profileAssetFiles || []);
        await deleteStoragePrefixes(['profile', 'student_signature'], [`profiles/${studentId}/`]);

        const { data: submissions, error: submissionsError } = await supabase
          .from('submissions')
          .select('id')
          .eq('student_id', studentId);

        if (submissionsError) throw new Error(submissionsError.message);

        const submissionIds = (submissions || []).map((entry) => entry.id).filter(Boolean);

        if (submissionIds.length) {
          const { data: files, error: filesLookupError } = await supabase
            .from('files')
            .select('*')
            .in('submission_id', submissionIds);

          if (filesLookupError) throw new Error(filesLookupError.message);

          await deleteStoredFiles(files || []);
          await deleteStoragePrefixes(
            storageBuckets,
            submissionIds.map((id) => `${id}/`),
          );

          const deletionTables = [
            'emergency_contacts',
            'medical_history',
            'staff_measurements',
            'lab_chest_xray',
            'lab_cbc',
            'lab_urinalysis',
            'certificates',
            'files',
          ];

          for (const tableName of deletionTables) {
            const { error } = await supabase.from(tableName).delete().in('submission_id', submissionIds);
            if (error) throw new Error(error.message);
          }
        }

        const { error: profileAssetDeleteError } = await supabase
          .from('files')
          .delete()
          .eq('uploaded_by', userId)
          .is('submission_id', null);

        if (profileAssetDeleteError) throw new Error(profileAssetDeleteError.message);

        const { error: submissionDeleteError } = await supabase
          .from('submissions')
          .delete()
          .eq('student_id', studentId);

        if (submissionDeleteError) throw new Error(submissionDeleteError.message);

        const studentDeleteBuilder = supabase.from('students').delete().eq('student_id', studentId);
        const { error: studentDeleteError } = await studentDeleteBuilder;
        if (studentDeleteError) throw new Error(studentDeleteError.message);
      }
    }

    if (role === 'staff' || linkedStaff?.id) {
      const staffId = linkedStaff?.id || null;

      if (staffId) {
        const updates = [
          supabase.from('submissions').update({ reviewed_by: null }).eq('reviewed_by', staffId),
          supabase.from('staff_measurements').update({ updated_by: null }).eq('updated_by', staffId),
          supabase.from('certificates').update({ issued_by: null }).eq('issued_by', staffId),
        ];

        for (const updatePromise of updates) {
          const { error } = await updatePromise;
          if (error) throw new Error(error.message);
        }
      }

      const { error: staffDeleteError } = await supabase.from('staff_users').delete().eq('profile_id', userId);
      if (staffDeleteError) throw new Error(staffDeleteError.message);
    }

    if (role === 'staff') {
      const { data: staffFiles, error: staffFilesError } = await supabase
        .from('files')
        .select('*')
        .eq('uploaded_by', userId)
        .is('submission_id', null);

      if (staffFilesError) throw new Error(staffFilesError.message);
      await deleteStoredFiles(staffFiles || []);

      const { error: staffFileDeleteError } = await supabase
        .from('files')
        .delete()
        .eq('uploaded_by', userId)
        .is('submission_id', null);

      if (staffFileDeleteError) throw new Error(staffFileDeleteError.message);
    }

    const { error: profileDeleteError } = await supabase.from('profiles').delete().eq('id', userId);
    if (profileDeleteError) throw new Error(profileDeleteError.message);

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) throw new Error(authDeleteError.message);

    const { error: archiveDeleteError } = await supabase.from('archived_accounts').delete().eq('id', archiveId);
    if (archiveDeleteError) throw new Error(archiveDeleteError.message);
    invalidateArchivedCaches();
    invalidateDashboardReadCaches();

    return c.json({ success: true });
  } catch (error) {
    console.log('Error permanently deleting archived account:', error);
    return internalServerError(c, 'Failed to permanently delete archived account', error);
  }
});

app.post("/admin/create-account", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role)) return forbidden();

  try {
    const { email, password, role = 'student', firstName, lastName, studentId, department, course } = await c.req.json();
    if (!email || !password) return badRequest('email and password are required');
    if (String(password).trim().length < minPasswordLength) return badRequest(passwordLengthError());
    if (!['student', 'staff'].includes(role)) {
      return badRequest('Only super administrators can create administrator accounts.');
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || null,
        last_name: lastName || null,
      },
    });
    if (createError || !created?.user) throw new Error(createError?.message || 'Failed to create user');

    const userId = created.user.id;

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      role,
      email: email.toLowerCase(),
      first_name: firstName || null,
      last_name: lastName || null,
      student_id: role === 'student' ? (studentId || null) : null,
      department: department || null,
      course: course || null,
      created_at: new Date().toISOString(),
    });
    if (profileError) throw new Error(profileError.message);

    if (role === 'student' && studentId) {
      const { error: studentError } = await supabase.from('students').upsert({
        student_id: studentId,
        profile_id: userId,
        first_name: firstName || null,
        last_name: lastName || null,
        department: department || null,
        course: course || null,
      }, { onConflict: 'student_id' });
      if (studentError) throw new Error(studentError.message);
    }

    invalidateDashboardReadCaches();
    return c.json({ success: true, userId });
  } catch (error) {
    console.log('Error creating account:', error);
    return internalServerError(c, 'Failed to create account', error);
  }
});

app.post("/admin/create-staff", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role)) return forbidden();

  try {
    const { email, password, firstName, lastName, position = 'Clinic Staff' } = await c.req.json();
    if (!email || !password || !firstName || !lastName) return badRequest('email, password, firstName, and lastName are required');
    if (String(password).trim().length < minPasswordLength) return badRequest(passwordLengthError());
    if (!['Clinic Staff', 'Clinic Doctor'].includes(position)) return badRequest('position must be either Clinic Staff or Clinic Doctor');

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });
    if (createError || !created?.user) throw new Error(createError?.message || 'Failed to create user');

    const userId = created.user.id;
    const normalizedEmail = email.toLowerCase();

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      role: 'staff',
      email: normalizedEmail,
      first_name: firstName,
      last_name: lastName,
      created_at: new Date().toISOString(),
    });
    if (profileError) throw new Error(profileError.message);

    const { error: staffError } = await supabase.from('staff_users').upsert({
      profile_id: userId,
      email: normalizedEmail,
      name: `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      position,
      is_active: true,
    }, { onConflict: 'profile_id' });
    if (staffError) throw new Error(staffError.message);

    invalidateDashboardReadCaches();
    return c.json({ success: true, userId });
  } catch (error) {
    console.log('Error creating staff:', error);
    return internalServerError(c, 'Failed to create staff', error);
  }
});

app.post("/issue-certificate", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();
  if (!isDoctorOrAdmin(requester)) {
    return c.json({ error: 'Only Clinic Doctors can issue certificates.' }, 403);
  }

  try {
    const { submissionId, findingsNormal, diagnosis, remarks, purpose, controlNo } = await c.req.json();

    if (!submissionId) return badRequest('submissionId is required');

    const { error } = await supabase.from('certificates').upsert({
      submission_id: submissionId,
      findings_normal: findingsNormal ?? true,
      diagnosis: diagnosis || null,
      remarks: remarks || null,
      purpose: purpose || null,
      control_no: controlNo || null,
      issued_by: requester.staff?.id || null,
      issued_at: new Date().toISOString(),
    }, { onConflict: 'submission_id' });

    if (error) throw new Error(error.message);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error issuing certificate:', error);
    return internalServerError(c, 'Failed to issue certificate', error);
  }
});

Deno.serve(app.fetch);
