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
const previewStudent = getMockStudentById('202310417');
const STORAGE_BUCKET = 'medical-files';

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
  identities?: Array<{ id?: string }>;
};

export type AuthMe = {
  profile: {
    id: string;
    role: UserRole;
    email?: string | null;
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
  };
}

async function loadRelatedData(rows: any[]) {
  const submissionIds = rows.map((row) => row.id);
  const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];
  const idList = submissionIds.map((id) => encodeURIComponent(id)).join(',');
  const studentIdList = studentIds.map((id) => encodeURIComponent(id)).join(',');

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

  const byKey = (rowsData: any[] | null | undefined, key: string) =>
    (rowsData || []).reduce((acc, item) => {
      acc[item[key]] = item;
      return acc;
    }, {} as Record<string, any>);

  const filesBySubmission = (files || []).reduce((acc, file) => {
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
  return session;
}

export async function signUpWithPassword(fullName: string, email: string, password: string) {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error('Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  }

  const emailRedirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?mode=signin&verified=1`
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
  if (!profile) {
    throw new Error('Profile not found for authenticated user.');
  }

  const [studentRows, staffRows] = await Promise.all([
    profile.student_id
      ? restRequest<any[]>('students', `student_id=eq.${encodeURIComponent(profile.student_id)}&select=*`, { token })
      : Promise.resolve([]),
    restRequest<any[]>('staff_users', `profile_id=eq.${user.id}&select=*`, { token }),
  ]);

  return {
    profile,
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

  const token = getAccessToken();
  if (!token || !supabaseUrl || !publicAnonKey) {
    throw new Error('You must be signed in to upload files.');
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${recordId}/${fileType}_${Date.now()}_${safeFileName}`;
  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        apikey: publicAnonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: file,
    },
  );

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload file (${uploadResponse.status})`);
  }

  const signedResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${STORAGE_BUCKET}/${storagePath}`,
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
  const fileUrl = signedPayload?.signedURL ? `${supabaseUrl}/storage/v1${signedPayload.signedURL}` : null;

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
        storage_bucket: STORAGE_BUCKET,
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
