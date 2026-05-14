// @ts-nocheck
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono().basePath("/server");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '600',
};

app.use('*', logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.options('*', (c) => new Response(null, { status: 204, headers: corsHeaders }));

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
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
const ADMIN_SYSTEM_SETTINGS_STORE_KEY = 'admin.system-settings';
const ADMIN_SYSTEM_SETTINGS_SEMESTERS = ['First Semester', 'Second Semester', 'Summer'];
const ADMIN_SYSTEM_SETTINGS_TIMEOUT_OPTIONS = [15, 30, 45, 60, 120];
const ADMIN_SYSTEM_SETTINGS_ARCHIVE_OPTIONS = [0, 12, 24, 36];

type TimedValue<T> = {
  value: T;
  expiresAt: number;
};

let archivedTableStateCache: TimedValue<{ available: boolean; rows: any[] }> | null = null;
let archivedTableStatePromise: Promise<{ available: boolean; rows: any[] }> | null = null;
let archivedUserIdsCache: TimedValue<{ available: boolean; userIds: Set<string> }> | null = null;

type Requester = {
  user: any;
  profile: any;
  student: any;
  staff: any;
  archivedAccount?: any;
};

const isStaffRole = (role?: string) => role === 'staff' || role === 'admin';

const DOCTOR_POSITIONS = ['clinic doctor', 'doctor'];

function isDoctorPosition(position?: string | null) {
  if (!position) return false;
  return DOCTOR_POSITIONS.includes(position.trim().toLowerCase());
}

function isDoctorOrAdmin(requester: Requester) {
  if (requester.profile.role === 'admin') return true;
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

function normalizeEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase();
}

function resolveRoleFromEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('staff')) return 'staff';
  return 'student';
}

function deriveStudentIdFromEmail(email?: string | null) {
  const localPart = normalizeEmail(email).split('@')[0] || '';
  const match = localPart.match(/^(\d{9})/);
  return match?.[1] || null;
}

function roleLabel(role?: string, position?: string | null) {
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

function isMissingStorageBucketError(error: any) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('bucket') && message.includes('not found');
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function unauthorized(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function forbidden(message = 'Forbidden') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
  const resolvedRole = resolveRoleFromEmail(user.email);
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
      resolvedRole === 'student' &&
      (existingProfile.student_id !== derivedStudentId || existingProfile.email !== normalizedEmail)
    ) {
      const { data: updatedProfile, error: updatedProfileError } = await supabase
        .from('profiles')
        .update({
          email: normalizedEmail,
          student_id: derivedStudentId,
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

  const { data: createdProfile, error: createdProfileError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      role: resolvedRole,
      email: normalizedEmail,
      student_id: derivedStudentId,
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

async function authenticate(c: any): Promise<Requester | null> {
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return null;
  }

  const user = authData.user;

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

  return { user, profile, student, staff, archivedAccount: null };
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

  const [
    studentsRes,
    emergencyContactsRes,
    medicalHistoryRes,
    staffMeasurementsRes,
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

  const filesBySubmission = (filesRes.data || []).reduce((acc, file) => {
    acc[file.submission_id] = acc[file.submission_id] || [];
    acc[file.submission_id].push(file);
    return acc;
  }, {} as Record<string, any[]>);

  return {
    students: byKey(studentsRes.data, 'student_id'),
    emergencyContacts: byKey(emergencyContactsRes.data, 'submission_id'),
    medicalHistory: byKey(medicalHistoryRes.data, 'submission_id'),
    staffMeasurements: byKey(staffMeasurementsRes.data, 'submission_id'),
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

async function requireSubmissionAccess(requester: Requester, submissionId: string) {
  const { data: submission, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', submissionId)
    .maybeSingle();

  if (error || !submission) {
    return { response: new Response(JSON.stringify({ error: 'Record not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  if (!isStaffRole(requester.profile.role) && requester.profile.student_id !== submission.student_id) {
    return { response: forbidden() };
  }

  return { submission };
}

app.get("/health", (c) => c.json({ status: "ok" }));

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
    const department = String(data.department || '').trim() || null;
    const course = String(data.course || '').trim() || null;
    const birthday = String(data.birthday || '').trim() || null;
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
        department,
        course,
        birthday,
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
    return c.json({ error: 'Failed to update student profile', details: String(error) }, 500);
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

    return c.json({ success: true, recordId: submissionId });
  } catch (error) {
    console.log('Error submitting medical record:', error);
    return c.json({ error: 'Failed to submit record', details: String(error) }, 500);
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

    const records = await getMappedSubmissions(
      supabase.from('submissions').select(SUBMISSION_LIST_COLUMNS).eq('student_id', requester.profile.student_id),
    );

    return c.json({ records });
  } catch (error) {
    console.log('Error fetching student records:', error);
    return c.json({ error: 'Failed to fetch records', details: String(error) }, 500);
  }
});

app.get("/student-records/:studentId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const studentId = c.req.param('studentId');
    const targetStudentId = isStaffRole(requester.profile.role) ? studentId : requester.profile.student_id;

    const records = await getMappedSubmissions(
      supabase.from('submissions').select(SUBMISSION_LIST_COLUMNS).eq('student_id', targetStudentId),
    );

    return c.json({ records });
  } catch (error) {
    console.log('Error fetching student records:', error);
    return c.json({ error: 'Failed to fetch records', details: String(error) }, 500);
  }
});

app.get("/submissions", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const submissions = await getMappedSubmissions(supabase.from('submissions').select(SUBMISSION_LIST_COLUMNS));
    return c.json({ submissions });
  } catch (error) {
    console.log('Error fetching submissions:', error);
    return c.json({ error: 'Failed to fetch submissions', details: String(error) }, 500);
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
    return c.json({ error: 'Failed to fetch submission', details: String(error) }, 500);
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

    // Only doctors and admins can set statuses that finalize or change clearance
    const doctorOnlyStatuses = ['approved', 'returned', 'physical_exam_done'];
    if (doctorOnlyStatuses.includes(status) && !isDoctorOrAdmin(requester)) {
      return c.json({ error: 'Only Clinic Doctors can approve, return, or mark physical exam done.' }, 403);
    }

    const { error } = await supabase
      .from('submissions')
      .update({
        status,
        staff_notes: staffNotes || null,
        reviewed_by: requester.staff?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw new Error(error.message);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error updating submission status:', error);
    return c.json({ error: 'Failed to update status', details: String(error) }, 500);
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

    return c.json({ success: true });
  } catch (error) {
    console.log('Error updating measurements:', error);
    return c.json({ error: 'Failed to update measurements', details: String(error) }, 500);
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
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (signedUrlError) throw new Error(signedUrlError.message);

    const { data: insertedFile, error: fileInsertError } = await supabase
      .from('files')
      .insert({
        submission_id: recordId,
        type: fileType,
        file_name: file.name,
        mime_type: file.type,
        url: signedUrlData?.signedUrl,
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

    return c.json({
      success: true,
      url: signedUrlData?.signedUrl,
      fileName: storagePath,
    });
  } catch (error) {
    console.log('Error in file upload:', error);
    return c.json({ error: 'Failed to upload file', details: String(error) }, 500);
  }
});

app.get("/analytics", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const [
      { count: totalStudents, error: totalStudentsError },
      { count: totalSubmissions, error: totalSubmissionsError },
      { count: pendingRecords, error: pendingError },
      { count: approvedRecords, error: approvedError },
      { count: returnedRecords, error: returnedError },
    ] = await Promise.all([
      supabase.from('students').select('student_id', { count: 'exact', head: true }),
      supabase.from('submissions').select('id', { count: 'exact', head: true }),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'returned'),
    ]);

    if (totalStudentsError) throw new Error(totalStudentsError.message);
    if (totalSubmissionsError) throw new Error(totalSubmissionsError.message);
    if (pendingError) throw new Error(pendingError.message);
    if (approvedError) throw new Error(approvedError.message);
    if (returnedError) throw new Error(returnedError.message);

    return c.json({
      totalStudents: totalStudents || 0,
      pendingRecords: pendingRecords || 0,
      approvedRecords: approvedRecords || 0,
      returnedRecords: returnedRecords || 0,
      totalSubmissions: totalSubmissions || 0,
    });
  } catch (error) {
    console.log('Error fetching analytics:', error);
    return c.json({ error: 'Failed to fetch analytics', details: String(error) }, 500);
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
    return c.json({ error: 'Failed to fetch staff users', details: String(error) }, 500);
  }
});

app.get("/user-accounts", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

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
    return c.json({ error: 'Failed to fetch user accounts', details: String(error) }, 500);
  }
});

app.get("/admin/system-settings", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const { data, error } = await supabase
      .from('kv_store_2a5e1a6b')
      .select('value')
      .eq('key', ADMIN_SYSTEM_SETTINGS_STORE_KEY)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return c.json(normalizeAdminSystemSettings(data?.value || {}));
  } catch (error) {
    console.log('Error fetching admin system settings:', error);
    return c.json({ error: 'Failed to fetch admin system settings', details: String(error) }, 500);
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

    if (error) throw new Error(error.message);

    return c.json(settings);
  } catch (error) {
    console.log('Error saving admin system settings:', error);
    return c.json({ error: 'Failed to save admin system settings', details: String(error) }, 500);
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
    return c.json({ error: 'Failed to fetch archived accounts', details: String(error) }, 500);
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

    return c.json({ success: true });
  } catch (error) {
    console.log('Error archiving account:', error);
    return c.json({ error: 'Failed to archive account', details: String(error) }, 500);
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

    return c.json({ success: true });
  } catch (error) {
    console.log('Error restoring account:', error);
    return c.json({ error: 'Failed to restore account', details: String(error) }, 500);
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

    return c.json({ success: true });
  } catch (error) {
    console.log('Error permanently deleting archived account:', error);
    return c.json({ error: 'Failed to permanently delete archived account', details: String(error) }, 500);
  }
});

app.post("/admin/create-account", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const { email, password, role = 'student', firstName, lastName, studentId, department, course } = await c.req.json();
    if (!email || !password) return badRequest('email and password are required');
    if (!['student', 'staff', 'admin'].includes(role)) return badRequest('invalid role');

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

    return c.json({ success: true, userId });
  } catch (error) {
    console.log('Error creating account:', error);
    return c.json({ error: 'Failed to create account', details: String(error) }, 500);
  }
});

app.post("/admin/create-staff", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const { email, password, firstName, lastName, position = 'Clinic Staff' } = await c.req.json();
    if (!email || !password || !firstName || !lastName) return badRequest('email, password, firstName, and lastName are required');
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

    return c.json({ success: true, userId });
  } catch (error) {
    console.log('Error creating staff:', error);
    return c.json({ error: 'Failed to create staff', details: String(error) }, 500);
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
    return c.json({ error: 'Failed to issue certificate', details: String(error) }, 500);
  }
});

Deno.serve(app.fetch);
