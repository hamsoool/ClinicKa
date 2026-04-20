import {
  getMockAnalytics,
  getMockStudentById,
  getMockStudentRecords,
  getMockSubmissionById,
  mockSubmissions,
  type MockSubmission,
} from './mock-data';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://fraalckdwluxelxqrelo.supabase.co';
const publicAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImZyYWFsY2tkd2x1eGVseHFyZWxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ5MDAsImV4cCI6MjA4ODg0MDkwMH0._Ev79XKDt5VWEnrTtCu1oIxPcY-fMd8TsH8ZDrwsuKM';

const API_BASE = `${supabaseUrl}/functions/v1/server`;
const DEMO_MODE = true;
const DEMO_SUBMISSIONS_KEY = 'gc_demo_submissions';
export const AUTH_STORAGE_KEY = 'gc_supabase_session';
const previewStudent = getMockStudentById('202310417');

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
  const token = options.token ?? getAccessToken();
  const headers: Record<string, string> = {
    apikey: publicAnonKey,
    Authorization: `Bearer ${token || publicAnonKey}`,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const error = await response.json();
      message = error.details || error.error || message;
    } catch {
      // Keep fallback message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function signInWithPassword(email: string, password: string) {
  if (DEMO_MODE) {
    const role: UserRole = email.includes('admin') ? 'admin' : email.includes('staff') ? 'staff' : 'student';
    const session: AuthSession = {
      access_token: `preview-${role}`,
      token_type: 'bearer',
      user: {
        id: `preview-${role}`,
        email,
      },
    };
    setStoredSession(session);
    return session;
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

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.msg || payload.error_description || 'Failed to sign in');
  }

  const session: AuthSession = payload;
  setStoredSession(session);
  return session;
}

export async function signOut() {
  if (DEMO_MODE) {
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

  return apiRequest<AuthMe>('/me', { token });
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

  return apiRequest<{ success: true; recordId: string }>('/submit-record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
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

  const suffix = studentId ? `/${encodeURIComponent(studentId)}` : '';
  return apiRequest<{ records: MockSubmission[] }>(`/student-records${suffix}`);
}

export async function getSubmissions() {
  if (DEMO_MODE) {
    return {
      submissions: getDemoSubmissions().sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      ),
    };
  }

  return apiRequest<{ submissions: MockSubmission[] }>('/submissions');
}

export async function getSubmission(id: string) {
  if (DEMO_MODE) {
    const submission = getDemoSubmissions().find((record) => record.id === id) || getMockSubmissionById(id);
    if (!submission) {
      throw new Error('Record not found');
    }
    return { submission: cloneSubmission(submission) };
  }

  return apiRequest<{ submission: MockSubmission }>(`/submission/${id}`);
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

  return apiRequest<{ success: true }>(`/submission/${id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, staffNotes }),
  });
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

  return apiRequest<{ success: true }>(`/submission/${id}/measurements`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(measurements),
  });
}

export async function uploadFile(file: File, recordId: string, fileType: string) {
  if (DEMO_MODE) {
    return {
      success: true as const,
      url: URL.createObjectURL(file),
      fileName: `${recordId}/${fileType}_${file.name}`,
    };
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('recordId', recordId);
  formData.append('fileType', fileType);

  return apiRequest<{ success: true; url?: string; fileName?: string }>('/upload-file', {
    method: 'POST',
    body: formData,
  });
}

export async function getAnalytics() {
  if (DEMO_MODE) {
    return buildAnalytics(getDemoSubmissions());
  }

  return apiRequest<{
    totalStudents: number;
    pendingRecords: number;
    approvedRecords: number;
    returnedRecords: number;
    totalSubmissions: number;
  }>('/analytics');
}

export async function getStaffUsers() {
  if (DEMO_MODE) {
    return { staff: demoStaffUsers };
  }

  return apiRequest<{ staff: any[] }>('/staff-users');
}

export async function getUserAccounts() {
  if (DEMO_MODE) {
    return { users: demoUserAccounts };
  }

  return apiRequest<{ users: any[] }>('/user-accounts');
}
