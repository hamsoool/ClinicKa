import {
  getMockAnalytics,
  getMockStudentById,
  getMockStudentRecords,
  getMockSubmissionById,
  mockSubmissions,
  type MockSubmission,
} from './mock-data';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;
const publicAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const DEMO_SUBMISSIONS_KEY = 'gc_demo_submissions';
export const AUTH_STORAGE_KEY = 'gc_supabase_session';
const GC_DOMAIN = 'gordoncollege.edu.ph';
const previewStudent = getMockStudentById('202310417');
const STORAGE_BUCKET = 'medical-files';
const STORAGE_BUCKET_BY_FILE_TYPE: Record<string, string> = {
  photo: 'profile',
  signature: 'student_signature',
  xray: 'lab_chest_xray',
  cbc: 'lab_cbc',
  urinalysis: 'lab_urinalysis',
};

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
    first_name?: string | null;
    last_name?: string | null;
    middle_initial?: string | null;
    position?: string | null;
    phone?: string | null;
    is_active?: boolean | null;
  } | null;
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

function isGCDomainEmail(email?: string | null) {
  return normalizeEmail(email).endsWith(`@${GC_DOMAIN}`);
}

function resolveRoleFromEmail(email?: string | null): UserRole {
  const normalized = normalizeEmail(email);
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('staff')) return 'staff';
  return 'student';
}

function deriveStudentIdFromEmail(email?: string | null) {
  const localPart = normalizeEmail(email).split('@')[0] || '';
  return /^[0-9]{9}$/.test(localPart) ? localPart : null;
}

function cloneSubmission(record: MockSubmission): MockSubmission {
  return JSON.parse(JSON.stringify(record)) as MockSubmission;
}

function getDefaultDemoSubmissions() {
  return mockSubmissions.map(cloneSubmission);
}

function mergeSeedSubmissions(records: MockSubmission[]) {
  const byId = new Map<string, MockSubmission>();

  for (const record of getDefaultDemoSubmissions()) {
    byId.set(record.id, record);
  }

  for (const record of records) {
    byId.set(record.id, record);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

function getDemoSubmissions(): MockSubmission[] {
  if (typeof window === 'undefined') {
    return getDefaultDemoSubmissions();
  }

  const raw = window.localStorage.getItem(DEMO_SUBMISSIONS_KEY);
  if (!raw) {
    const initial = mergeSeedSubmissions([]);
    window.localStorage.setItem(DEMO_SUBMISSIONS_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const merged = mergeSeedSubmissions(JSON.parse(raw) as MockSubmission[]);
    window.localStorage.setItem(DEMO_SUBMISSIONS_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    const initial = mergeSeedSubmissions([]);
    window.localStorage.setItem(DEMO_SUBMISSIONS_KEY, JSON.stringify(initial));
    return initial;
  }
}

function setDemoSubmissions(records: MockSubmission[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_SUBMISSIONS_KEY, JSON.stringify(records));
}

function getStudentIdFallback() {
  return previewStudent?.student_id || '202310417';
}

function buildAnalytics(records: MockSubmission[]) {
  const uniqueStudents = new Set(records.map((sub) => sub.studentId)).size;
  const totalSubmissions = records.length;
  const pendingRecords = records.filter((sub) => sub.status === 'pending').length;
  const approvedRecords = records.filter((sub) => sub.status === 'approved').length;
  const returnedRecords = records.filter((sub) => sub.status === 'returned').length;

  return {
    totalStudents: uniqueStudents,
    totalSubmissions,
    pendingRecords,
    approvedRecords,
    returnedRecords,
  };
}

const demoStaffUsers = [
  {
    id: 'STF-001',
    name: 'Clinic Staff',
    role: 'Clinic Staff',
    status: 'Active',
    email: 'clinic.staff@gordoncollege.edu.ph',
  },
  {
    id: 'ADM-001',
    name: 'Clinic Admin',
    role: 'Administrator',
    status: 'Active',
    email: 'clinic.admin@gordoncollege.edu.ph',
  },
];

const demoUserAccounts = [
  {
    id: '202310417',
    name: 'Demo Student',
    role: 'Student',
    status: 'Active',
    lastActive: new Date().toISOString(),
  },
  {
    id: 'STF-001',
    name: 'Clinic Staff',
    role: 'Clinic Staff',
    status: 'Active',
    lastActive: new Date().toISOString(),
  },
  {
    id: 'ADM-001',
    name: 'Clinic Admin',
    role: 'Administrator',
    status: 'Active',
    lastActive: new Date().toISOString(),
  },
];

export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function setStoredSession(session: AuthSession | null) {
  if (typeof window === 'undefined') return;

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  setStoredSession(null);
}

function getAccessToken() {
  return getStoredSession()?.access_token || null;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error('Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  }

  const token = options.token ?? getAccessToken();
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

async function authRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error('Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  }

  const token = options.token ?? getAccessToken();
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
    throw new Error(payload.msg || payload.error_description || payload.error || `Request failed (${response.status})`);
  }

  return payload as T;
}

export function signInWithGoogle() {
  if (typeof window === 'undefined') return;
  if (!supabaseUrl) {
    throw new Error('Missing Supabase config. Set VITE_SUPABASE_URL in your .env file.');
  }

  const redirectTo = `${window.location.origin}/auth?mode=signin`;
  const url = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
    redirectTo,
  )}`;
  window.location.assign(url);
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
  if (DEMO_MODE) return false;

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
  if (DEMO_MODE) return;

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
  if (session?.user?.id) {
    return session.user;
  }
  const payload = await authRequest<{ id: string; email?: string }>('/auth/v1/user', { token });
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

  const trySign = async (targetPath: string) => {
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${targetBucket}/${targetPath}`,
      {
        method: 'POST',
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${token || getAccessToken() || publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return null;

    const rawSigned =
      payload?.signedURL || payload?.signedUrl || payload?.signed_url || null;
    if (!rawSigned) return null;
    if (/^https?:\/\//i.test(rawSigned)) return rawSigned as string;
    return `${supabaseUrl}/storage/v1${rawSigned}`;
  };

  try {
    const signedDirect = await trySign(path);
    if (signedDirect) return signedDirect;

    const encodedPath = path
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const signedEncoded = encodedPath && encodedPath !== path ? await trySign(encodedPath) : null;
    if (signedEncoded) return signedEncoded;

    return null;
  } catch {
    return null;
  }
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
    photoUrl: normalizeStorageFileUrl(files.photo?.url),
    signatureUrl: normalizeStorageFileUrl(files.signature?.url),
    xrayFileUrl: normalizeStorageFileUrl(xrayFileFromLab?.url || files.xray?.url || xrayFileByHint?.url || genericLabFile?.url),
    cbcFileUrl: normalizeStorageFileUrl(cbcFileFromLab?.url || files.cbc?.url || cbcFileByHint?.url || genericLabFile?.url),
    urinalysisFileUrl: normalizeStorageFileUrl(urinalysisFileFromLab?.url || files.urinalysis?.url || urinalysisFileByHint?.url || genericLabFile?.url),
    certificatePdfUrl: normalizeStorageFileUrl(files.certificate?.url || certificate?.pdf_url),
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

  const normalizedFiles = await Promise.all(
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
          // Always prefer fresh signed URL over stored URL because stored URL can be stale
          // after bucket migrations/renames.
          url: signedUrl || normalizeStorageFileUrl(file.url) || null,
        };
      }
      return { ...file, url: normalizeStorageFileUrl(file?.url) || null };
    }),
  );

  const filesBySubmissionCurrent = (normalizedFiles || []).reduce((acc, file) => {
    acc[file.submission_id] = acc[file.submission_id] || [];
    acc[file.submission_id].push(file);
    return acc;
  }, {} as Record<string, any[]>);

  const submissionsMissingFiles = submissionIds.filter((id) => !(filesBySubmissionCurrent[id]?.length));
  const fallbackBuckets = [...new Set([STORAGE_BUCKET, ...Object.values(STORAGE_BUCKET_BY_FILE_TYPE)])];
  const listedFallbackFiles = (
    await Promise.all(
      submissionsMissingFiles.flatMap((id) =>
        fallbackBuckets.map((bucketName) => listStorageFilesForSubmission(id, token, bucketName)),
      ),
    )
  ).flat();
  const allFiles = [...(normalizedFiles || []), ...listedFallbackFiles];

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
    files: filesBySubmission,
    filesById: byId(allFiles),
  };
}

async function getMappedSubmissions(query: string) {
  const rows = await restRequest<any[]>('submissions', query);
  const related = await loadRelatedData(rows || []);
  return (rows || []).map((row: any) => mapSubmission(row, related));
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error('Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
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

  const session: AuthSession = payload as AuthSession;
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

export async function signUpWithPassword(fullName: string, email: string, password: string) {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error('Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  }
  if (!isGCDomainEmail(email)) {
    throw new Error(`Please use your @${GC_DOMAIN} email address to register.`);
  }

  const emailRedirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth?mode=signin&verified=1`
      : undefined;

  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: publicAnonKey,
      Authorization: `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_redirect_to: emailRedirectTo,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName,
        },
      },
    }),
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
      (response.status >= 500
        ? 'Supabase returned a server error while creating the account. Check Auth logs and DB triggers.'
        : `Failed to sign up (${response.status})`);
    throw new Error(message);
  }

  const session: AuthSession | null =
    payload?.session || (payload?.access_token ? (payload as AuthSession) : null);
  const user = (payload?.user || null) as SupabaseAuthUser | null;
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
  if (DEMO_MODE) {
    return {
      profile: {
        id: 'preview-student',
        role: 'student' as UserRole,
        email: previewStudent?.email || '202310417@gordoncollege.edu.ph',
        student_id: previewStudent?.student_id || '202310417',
        first_name: previewStudent?.first_name || 'Demo',
        last_name: previewStudent?.last_name || 'Student',
        department: previewStudent?.department || 'CCS',
        course: previewStudent?.course || 'BS Computer Science',
      },
      student: {
        student_id: previewStudent?.student_id || '202310417',
        first_name: previewStudent?.first_name || 'Demo',
        last_name: previewStudent?.last_name || 'Student',
        middle_initial: previewStudent?.middle_initial || 'A',
        department: previewStudent?.department || 'CCS',
        course: previewStudent?.course || 'BS Computer Science',
        year_level: previewStudent?.year_level || 3,
        age: previewStudent?.age || 20,
        sex: previewStudent?.sex || 'male',
        birthday: previewStudent?.birthday || '2005-01-15',
        civil_status: previewStudent?.civil_status || 'Single',
        contact_number: previewStudent?.contact_number || '09123456789',
        address: previewStudent?.address || 'Olongapo City',
      },
      staff: null,
    } satisfies AuthMe;
  }
  const user = await getCurrentAuthUser(token);
  const profileRows = await restRequest<any[]>(
    'profiles',
    `id=eq.${user.id}&select=*`,
    {
      token,
      headers: { Prefer: 'count=exact' },
    },
  );
  const profile = profileRows[0];
  const resolvedProfile =
    profile ||
    (
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
            role: resolveRoleFromEmail(user.email),
            email: normalizeEmail(user.email) || null,
            student_id: deriveStudentIdFromEmail(user.email),
          }),
        },
      )
    )[0];

  if (!resolvedProfile) {
    throw new Error('Profile not found for authenticated user.');
  }

  const [studentRows, staffRows] = await Promise.all([
    resolvedProfile.student_id
      ? restRequest<any[]>('students', `student_id=eq.${encodeURIComponent(resolvedProfile.student_id)}&select=*`, { token })
      : Promise.resolve([]),
    restRequest<any[]>('staff_users', `profile_id=eq.${user.id}&select=*`, { token }),
  ]);

  return {
    profile: resolvedProfile,
    student: studentRows[0] || null,
    staff: staffRows[0] || null,
  } satisfies AuthMe;
}

export async function submitMedicalRecord(data: any) {
  if (DEMO_MODE) {
    const records = getDemoSubmissions();
    const recordId = `demo-${Date.now()}`;
    const now = new Date().toISOString();
    const newRecord: MockSubmission = {
      id: recordId,
      studentId: data.studentId || getStudentIdFallback(),
      firstName: data.firstName || 'Demo',
      lastName: data.lastName || 'Student',
      middleInitial: data.middleInitial || '',
      course: data.course || 'BS Computer Science',
      department: data.department || 'CCS',
      year: String(data.yearLevel || '1'),
      status: 'pending',
      submittedAt: now,
      updatedAt: now,
      age: data.age ? String(data.age) : '',
      sex: data.sex || '',
      birthday: data.birthday || '',
      civilStatus: data.civilStatus || '',
      contactNumber: data.contactNumber || '',
      address: data.address || '',
      emergencyContact: data.emergencyContact,
      medicalHistory: data.medicalHistory,
      allergyDetails: data.allergyDetails || '',
      hadOperation: data.hadOperation || 'no',
      operationDetails: data.operationDetails || '',
      bloodPressure: data.bloodPressure || '',
      weight: data.weight || '',
      height: data.height || '',
      bmi: data.bmi || '',
    };
    records.unshift(newRecord);
    setDemoSubmissions(records);
    return { success: true as const, recordId };
  }

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

  const insertedSubmission = await restRequest<any[]>(
    'submissions',
    'select=*',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        student_id: studentId,
        year_level: String(data.yearLevel || ''),
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
        blood_pressure: data.bloodPressure || null,
        weight: data.weight || null,
        height: data.height || null,
        bmi: data.bmi || null,
        data_privacy_consent: Boolean(data.dataPrivacyConsent),
      }),
    },
  );

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

export async function getStudentRecords(studentId?: string) {
  if (DEMO_MODE) {
    const records = getDemoSubmissions();
    const targetStudentId = studentId || getStudentIdFallback();
    return {
      records: records
        .filter((record) => record.studentId === targetStudentId)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
    };
  }

  const me = await getMe();
  const targetStudentId = studentId || me.profile.student_id;
  if (!targetStudentId) {
    return { records: [] };
  }
  const records = await getMappedSubmissions(
    `student_id=eq.${encodeURIComponent(targetStudentId)}&order=submitted_at.desc`,
  );
  return { records };
}

export async function getStudentProfilePhoto(studentId?: string) {
  if (DEMO_MODE) {
    return { photoUrl: null as string | null };
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
  if (DEMO_MODE) {
    return {
      submissions: getDemoSubmissions().sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      ),
    };
  }

  const submissions = await getMappedSubmissions('order=submitted_at.desc');
  return { submissions };
}

export async function getSubmission(id: string) {
  if (DEMO_MODE) {
    const submission = getDemoSubmissions().find((record) => record.id === id) || getMockSubmissionById(id);
    if (!submission) {
      throw new Error('Record not found');
    }
    return { submission: cloneSubmission(submission) };
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
  const staffMeasurements = review.staffMeasurements || {};
  const labResults = review.labResults || {};
  const clearanceInfo = review.clearanceInfo || {};
  const nextStatus = review.status;
  const now = new Date().toISOString();

  if (DEMO_MODE) {
    const records = getDemoSubmissions();
    const nextRecords = records.map((record) =>
      record.id === id
        ? {
            ...record,
            firstName: personalInfo.firstName || record.firstName,
            lastName: personalInfo.lastName || record.lastName,
            middleInitial: personalInfo.middleInitial || '',
            department: personalInfo.department || '',
            course: personalInfo.course || '',
            year: String(personalInfo.year || record.year || ''),
            age: personalInfo.age || '',
            sex: personalInfo.sex || '',
            birthday: personalInfo.birthday || '',
            civilStatus: personalInfo.civilStatus || '',
            contactNumber: personalInfo.contactNumber || '',
            address: personalInfo.address || '',
            allergyDetails: review.allergyDetails || '',
            hadOperation: review.hadOperation || 'no',
            operationDetails: review.operationDetails || '',
            bloodPressure: studentMeasurements.bloodPressure || '',
            weight: studentMeasurements.weight || '',
            height: studentMeasurements.height || '',
            bmi: studentMeasurements.bmi || '',
            emergencyContact: {
              name: emergencyContact.name || '',
              relationship: emergencyContact.relationship || '',
              phone: emergencyContact.phone || '',
              address: emergencyContact.address || '',
            },
            medicalHistory,
            staffMeasurements: {
              bloodPressure: staffMeasurements.bloodPressure || '',
              cardiacRate: staffMeasurements.cardiacRate || '',
              respiratoryRate: staffMeasurements.respiratoryRate || '',
              temperature: staffMeasurements.temperature || '',
              weight: staffMeasurements.weight || '',
              height: staffMeasurements.height || '',
              bmi: staffMeasurements.bmi || '',
              visualAcuity: staffMeasurements.visualAcuity || '',
              skin: staffMeasurements.skin || '',
              heent: staffMeasurements.heent || '',
              chestLungs: staffMeasurements.chestLungs || '',
              heart: staffMeasurements.heart || '',
              abdomen: staffMeasurements.abdomen || '',
              extremities: staffMeasurements.extremities || '',
              others: staffMeasurements.others || '',
              examinedBy: staffMeasurements.examinedBy || '',
            },
            labResults: {
              xrayDate: labResults.xrayDate || '',
              xrayResult: labResults.xrayResult || 'normal',
              xrayFindings: labResults.xrayFindings || '',
              cbcDate: labResults.cbcDate || '',
              hemoglobin: labResults.hemoglobin || '',
              hematocrit: labResults.hematocrit || '',
              wbc: labResults.wbc || '',
              plateletCount: labResults.plateletCount || '',
              bloodType: labResults.bloodType || '',
              glucose: labResults.glucose || '',
              protein: labResults.protein || '',
              urinalysisDate: labResults.urinalysisDate || '',
              urinalysisGlucose: labResults.urinalysisGlucose || '',
              urinalysisProtein: labResults.urinalysisProtein || '',
              others: labResults.others || '',
            },
            clearanceInfo: {
              findingsNormal: typeof clearanceInfo.findingsNormal === 'boolean' ? clearanceInfo.findingsNormal : true,
              diagnosis: clearanceInfo.diagnosis || '',
              remarks: clearanceInfo.remarks || '',
              purpose: clearanceInfo.purpose || 'enrolment',
              controlNo: clearanceInfo.controlNo || '',
              issuedDate: clearanceInfo.issuedDate || '',
            },
            staffNotes: review.staffNotes ?? record.staffNotes,
            status: (nextStatus || record.status) as MockSubmission['status'],
            updatedAt: now,
          }
        : record,
    );
    setDemoSubmissions(nextRecords);
    return { success: true as const };
  }

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
          blood_pressure: studentMeasurements.bloodPressure || null,
          weight: studentMeasurements.weight || null,
          height: studentMeasurements.height || null,
          bmi: studentMeasurements.bmi || null,
          staff_notes: review.staffNotes || null,
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
              year_level: personalInfo.year ? Number(personalInfo.year) : null,
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
          issued_date: clearanceInfo.issuedDate || null,
          issued_at: clearanceInfo.issuedDate || null,
          updated_at: now,
        }),
      },
    ),
  ]);

  return { success: true as const };
}

export async function updateSubmissionStatus(id: string, status: string, staffNotes?: string) {
  if (DEMO_MODE) {
    const records = getDemoSubmissions();
    const nextRecords = records.map((record) =>
      record.id === id
        ? {
            ...record,
            status: status as MockSubmission['status'],
            staffNotes: staffNotes || record.staffNotes,
            updatedAt: new Date().toISOString(),
          }
        : record,
    );
    setDemoSubmissions(nextRecords);
    return { success: true as const };
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
  return { success: true as const };
}

export async function updateMeasurements(id: string, measurements: any) {
  if (DEMO_MODE) {
    const records = getDemoSubmissions();
    const nextRecords = records.map((record) =>
      record.id === id
        ? {
            ...record,
            updatedAt: new Date().toISOString(),
            staffMeasurements: {
              bloodPressure: measurements.bloodPressure || '',
              cardiacRate: measurements.cardiacRate || '',
              respiratoryRate: measurements.respiratoryRate || '',
              temperature: measurements.temperature || '',
              weight: measurements.weight || '',
              height: measurements.height || '',
              bmi: measurements.bmi || '',
              visualAcuity: measurements.visualAcuity || '',
              skin: measurements.skin || '',
              heent: measurements.heent || '',
              chestLungs: measurements.chestLungs || '',
              heart: measurements.heart || '',
              abdomen: measurements.abdomen || '',
              extremities: measurements.extremities || '',
              others: measurements.others || '',
              examinedBy: measurements.examinedBy || '',
            },
            labResults: {
              xrayDate: measurements.xrayDate || '',
              xrayResult: measurements.xrayResult || 'normal',
              xrayFindings: measurements.xrayFindings || '',
              cbcDate: measurements.cbcDate || '',
              hemoglobin: measurements.hemoglobin || '',
              hematocrit: measurements.hematocrit || '',
              wbc: measurements.wbc || '',
              plateletCount: measurements.plateletCount || '',
              bloodType: measurements.bloodType || '',
              urinalysisDate: measurements.urinalysisDate || '',
              urinalysisGlucose: measurements.urinalysisGlucose || '',
              urinalysisProtein: measurements.urinalysisProtein || '',
              others: measurements.others || '',
            },
          }
        : record,
    );
    setDemoSubmissions(nextRecords);
    return { success: true as const };
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

  return { success: true as const };
}

export async function uploadFile(file: File, recordId: string, fileType: string) {
  if (DEMO_MODE) {
    return {
      success: true as const,
      url: URL.createObjectURL(file),
      fileName: `${recordId}/${fileType}_${file.name}`,
    };
  }

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

export async function getAnalytics() {
  if (DEMO_MODE) {
    return buildAnalytics(getDemoSubmissions());
  }

  const [students, submissionStatuses] = await Promise.all([
    restRequest<any[]>('students', 'select=student_id'),
    restRequest<any[]>('submissions', 'select=status'),
  ]);

  const pendingRecords = (submissionStatuses || []).filter((row) => row.status === 'pending').length;
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
  if (DEMO_MODE) {
    return { staff: demoStaffUsers };
  }

  const staff = await restRequest<any[]>('staff_users', 'select=*&order=last_name.asc');
  return {
    staff: (staff || []).map((member) => ({
      id: member.id,
      name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.name || 'Unnamed Staff',
      role: member.position || 'Clinic Staff',
      status: member.is_active === false ? 'Inactive' : 'Active',
      email: member.email || '',
    })),
  };
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
  if (DEMO_MODE) {
    return { success: true as const };
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
  staffCode?: string;
};

export async function createAdminStaff(input: AdminCreateStaffInput) {
  if (DEMO_MODE) {
    return { success: true as const };
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
  if (DEMO_MODE) {
    return { users: demoUserAccounts };
  }

  const [profiles, staffUsers] = await Promise.all([
    restRequest<any[]>('profiles', 'select=*&order=created_at.desc'),
    restRequest<any[]>('staff_users', 'select=*'),
  ]);

  const staffByProfileId = (staffUsers || []).reduce((acc, staff) => {
    if (staff.profile_id) {
      acc[staff.profile_id] = staff;
    }
    return acc;
  }, {} as Record<string, any>);

  return {
    users: (profiles || []).map((profile) => {
      const linkedStaff = staffByProfileId[profile.id];
      const name =
        [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
        [linkedStaff?.first_name, linkedStaff?.last_name].filter(Boolean).join(' ').trim() ||
        profile.email ||
        'Unnamed User';

      return {
        id: profile.student_id || linkedStaff?.id || profile.id,
        name,
        role:
          profile.role === 'admin'
            ? 'Administrator'
            : profile.role === 'staff'
              ? 'Clinic Staff'
              : 'Student',
        status: linkedStaff?.is_active === false ? 'Inactive' : 'Active',
        lastActive: profile.updated_at || profile.created_at,
      };
    }),
  };
}
