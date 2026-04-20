export type MedicalHistory = {
  allergy?: boolean;
  asthma?: boolean;
  chickenPox?: boolean;
  diabetes?: boolean;
  dysmenorrhea?: boolean;
  epilepsySeizure?: boolean;
  heartDisorder?: boolean;
  hepatitis?: boolean;
  hypertension?: boolean;
  measles?: boolean;
  mumps?: boolean;
  anxietyDisorder?: boolean;
  panicAttack?: boolean;
  pneumonia?: boolean;
  ptbPrimaryComplex?: boolean;
  typhoidFever?: boolean;
  covid19?: boolean;
  uti?: boolean;
};

export type PhysicalExamination = {
  bloodPressure?: string;
  cardiacRate?: string;
  respiratoryRate?: string;
  temperature?: string;
  weight?: string;
  height?: string;
  bmi?: string;
  visualAcuity?: string;
  skin?: string;
  heent?: string;
  chestLungs?: string;
  heart?: string;
  abdomen?: string;
  extremities?: string;
  others?: string;
  examinedBy?: string;
};

export type LabResults = {
  xrayDate?: string;
  xrayResult?: 'normal' | 'abnormal';
  xrayFindings?: string;
  cbcDate?: string;
  hemoglobin?: string;
  hematocrit?: string;
  wbc?: string;
  plateletCount?: string;
  bloodType?: string;
  urinalysisDate?: string;
  urinalysisGlucose?: string;
  urinalysisProtein?: string;
  others?: string;
};

export type ClearanceInfo = {
  findingsNormal?: boolean;
  diagnosis?: string;
  remarks?: string;
  purpose?: 'enrolment' | 'ojt' | 'rle';
  controlNo?: string;
  issuedDate?: string;
};

export type MockStudent = {
  id: string;
  student_id: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_initial?: string;
  department: string;
  course: string;
  year_level: number;
  age?: number;
  sex?: string;
  birthday?: string;
  civil_status?: string;
  contact_number?: string;
  address?: string;
};

export type MockSubmission = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  course: string;
  department?: string;
  year: string;
  status: 'pending' | 'approved' | 'returned';
  submittedAt: string;
  updatedAt?: string;
  staffNotes?: string;
  age?: string;
  sex?: string;
  birthday?: string;
  civilStatus?: string;
  contactNumber?: string;
  address?: string;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
    address?: string;
  };
  medicalHistory?: MedicalHistory;
  allergyDetails?: string;
  hadOperation?: 'yes' | 'no';
  operationDetails?: string;
  bloodPressure?: string;
  weight?: string;
  height?: string;
  bmi?: string;
  staffMeasurements?: PhysicalExamination;
  labResults?: LabResults;
  clearanceInfo?: ClearanceInfo;
};

export const mockStudents: MockStudent[] = [
  {
    id: 'student-001',
    student_id: '202310417',
    email: '202310417@gordoncollege.edu.ph',
    first_name: 'Demo',
    last_name: 'Student',
    middle_initial: 'A',
    department: 'CCS',
    course: 'BS Computer Science',
    year_level: 3,
    age: 20,
    sex: 'male',
    birthday: '2005-01-15',
    civil_status: 'Single',
    contact_number: '09123456789',
    address: 'Olongapo City',
  },
  {
    id: 'student-002',
    student_id: '202310421',
    email: '202310421@gordoncollege.edu.ph',
    first_name: 'Anna',
    last_name: 'Cruz',
    middle_initial: 'M',
    department: 'CCS',
    course: 'BS Computer Science',
    year_level: 2,
    age: 20,
    sex: 'female',
    birthday: '2005-08-12',
    civil_status: 'Single',
    contact_number: '09123456789',
    address: 'Olongapo City',
  },
  {
    id: 'student-003',
    student_id: '202233419',
    email: '202233419@gordoncollege.edu.ph',
    first_name: 'Jared',
    last_name: 'Lim',
    middle_initial: 'K',
    department: 'CHTM',
    course: 'BS Nursing',
    year_level: 3,
    age: 21,
    sex: 'male',
    birthday: '2004-02-20',
    civil_status: 'Single',
    contact_number: '09223344556',
    address: 'Subic, Zambales',
  },
  {
    id: 'student-004',
    student_id: '202188002',
    email: '202188002@gordoncollege.edu.ph',
    first_name: 'Mika',
    last_name: 'Reyes',
    middle_initial: 'L',
    department: 'CCS',
    course: 'BS Information Technology',
    year_level: 4,
    age: 22,
    sex: 'female',
    birthday: '2003-11-03',
    civil_status: 'Single',
    contact_number: '09112223334',
    address: 'Olongapo City',
  },
  {
    id: 'student-005',
    student_id: '202455210',
    email: '202455210@gordoncollege.edu.ph',
    first_name: 'Paolo',
    last_name: 'Santos',
    middle_initial: 'R',
    department: 'CBA',
    course: 'BS Business Administration',
    year_level: 1,
    age: 18,
    sex: 'male',
    birthday: '2007-06-18',
    civil_status: 'Single',
    contact_number: '09190001122',
    address: 'Olongapo City',
  },
  {
    id: 'student-006',
    student_id: '202377551',
    email: '202377551@gordoncollege.edu.ph',
    first_name: 'Bianca',
    last_name: 'Flores',
    middle_initial: 'S',
    department: 'CAS',
    course: 'BS Psychology',
    year_level: 2,
    age: 20,
    sex: 'female',
    birthday: '2005-04-27',
    civil_status: 'Single',
    contact_number: '09335557788',
    address: 'Subic, Zambales',
  },
];

export const mockSubmissions: MockSubmission[] = [
  {
    id: 'sub-demo-001',
    studentId: '202310417',
    firstName: 'Demo',
    lastName: 'Student',
    middleInitial: 'A',
    course: 'BS Computer Science',
    department: 'CCS',
    year: '2',
    status: 'approved',
    submittedAt: '2026-02-12T08:30:00Z',
    updatedAt: '2026-02-14T10:15:00Z',
    staffNotes: 'Cleared for enrolment. Maintain hydration and rest.',
    age: '20',
    sex: 'male',
    birthday: '2005-01-15',
    civilStatus: 'Single',
    contactNumber: '09123456789',
    address: 'Olongapo City',
    emergencyContact: {
      name: 'Maria Student',
      relationship: 'Mother',
      phone: '09981234567',
      address: 'Olongapo City',
    },
    medicalHistory: {
      allergy: false,
      asthma: false,
      chickenPox: true,
      diabetes: false,
      dysmenorrhea: false,
      epilepsySeizure: false,
      heartDisorder: false,
      hepatitis: false,
      hypertension: false,
      measles: false,
      mumps: false,
      anxietyDisorder: false,
      panicAttack: false,
      pneumonia: false,
      ptbPrimaryComplex: false,
      typhoidFever: false,
      covid19: false,
      uti: false,
    },
    hadOperation: 'no',
    bloodPressure: '118/78',
    weight: '63',
    height: '172',
    bmi: '21.30',
    staffMeasurements: {
      bloodPressure: '118/78',
      cardiacRate: '71',
      respiratoryRate: '18',
      temperature: '36.6',
      weight: '63',
      height: '172',
      bmi: '21.30',
      visualAcuity: '20/20',
      skin: 'Normal',
      heent: 'Normal',
      chestLungs: 'Clear',
      heart: 'Normal',
      abdomen: 'Soft, non-tender',
      extremities: 'Normal',
      examinedBy: 'Dr. Gerald S. Bernal',
    },
    labResults: {
      xrayDate: '2026-02-12',
      xrayResult: 'normal',
      xrayFindings: '',
      cbcDate: '2026-02-12',
      hemoglobin: '14.2',
      hematocrit: '42',
      wbc: '7100',
      plateletCount: '265000',
      bloodType: 'B+',
      urinalysisDate: '2026-02-12',
      urinalysisGlucose: 'Negative',
      urinalysisProtein: 'Negative',
    },
    clearanceInfo: {
      findingsNormal: true,
      diagnosis: '',
      remarks: '',
      purpose: 'enrolment',
      controlNo: 'MC-2026-100',
      issuedDate: '2026-02-14',
    },
  },
  {
    id: 'sub-demo-002',
    studentId: '202310417',
    firstName: 'Demo',
    lastName: 'Student',
    middleInitial: 'A',
    course: 'BS Computer Science',
    department: 'CCS',
    year: '3',
    status: 'pending',
    submittedAt: '2026-03-18T13:20:00Z',
    updatedAt: '2026-03-18T13:20:00Z',
    staffNotes: '',
    age: '20',
    sex: 'male',
    birthday: '2005-01-15',
    civilStatus: 'Single',
    contactNumber: '09123456789',
    address: 'Olongapo City',
    emergencyContact: {
      name: 'Maria Student',
      relationship: 'Mother',
      phone: '09981234567',
      address: 'Olongapo City',
    },
    medicalHistory: {
      allergy: true,
      asthma: false,
      chickenPox: true,
      diabetes: false,
      dysmenorrhea: false,
      epilepsySeizure: false,
      heartDisorder: false,
      hepatitis: false,
      hypertension: false,
      measles: false,
      mumps: false,
      anxietyDisorder: false,
      panicAttack: false,
      pneumonia: false,
      ptbPrimaryComplex: false,
      typhoidFever: false,
      covid19: false,
      uti: false,
    },
    allergyDetails: 'Dust allergy',
    hadOperation: 'no',
    bloodPressure: '120/80',
    weight: '64',
    height: '172',
    bmi: '21.63',
  },
  {
    id: 'sub-demo-003',
    studentId: '202310417',
    firstName: 'Demo',
    lastName: 'Student',
    middleInitial: 'A',
    course: 'BS Computer Science',
    department: 'CCS',
    year: '3',
    status: 'approved',
    submittedAt: '2026-03-22T09:15:00Z',
    updatedAt: '2026-03-24T08:45:00Z',
    staffNotes: 'Cleared after clinic evaluation. Fit for enrolment purposes.',
    age: '20',
    sex: 'male',
    birthday: '2005-01-15',
    civilStatus: 'Single',
    contactNumber: '09123456789',
    address: 'Olongapo City',
    emergencyContact: {
      name: 'Maria Student',
      relationship: 'Mother',
      phone: '09981234567',
      address: 'Olongapo City',
    },
    medicalHistory: {
      allergy: true,
      asthma: false,
      chickenPox: true,
      diabetes: false,
      dysmenorrhea: false,
      epilepsySeizure: false,
      heartDisorder: false,
      hepatitis: false,
      hypertension: false,
      measles: false,
      mumps: false,
      anxietyDisorder: false,
      panicAttack: false,
      pneumonia: false,
      ptbPrimaryComplex: false,
      typhoidFever: false,
      covid19: false,
      uti: false,
    },
    allergyDetails: 'Dust allergy',
    hadOperation: 'no',
    bloodPressure: '118/76',
    weight: '64',
    height: '172',
    bmi: '21.63',
    staffMeasurements: {
      bloodPressure: '118/76',
      cardiacRate: '70',
      respiratoryRate: '18',
      temperature: '36.5',
      weight: '64',
      height: '172',
      bmi: '21.63',
      visualAcuity: '20/20',
      skin: 'Normal',
      heent: 'Normal',
      chestLungs: 'Clear',
      heart: 'Normal',
      abdomen: 'Soft, non-tender',
      extremities: 'Normal',
      examinedBy: 'Dr. Gerald S. Bernal',
    },
    labResults: {
      xrayDate: '2026-03-22',
      xrayResult: 'normal',
      xrayFindings: '',
      cbcDate: '2026-03-22',
      hemoglobin: '14.4',
      hematocrit: '43',
      wbc: '7000',
      plateletCount: '270000',
      bloodType: 'B+',
      urinalysisDate: '2026-03-22',
      urinalysisGlucose: 'Negative',
      urinalysisProtein: 'Negative',
    },
    clearanceInfo: {
      findingsNormal: true,
      diagnosis: '',
      remarks: 'Fit',
      purpose: 'enrolment',
      controlNo: 'MC-2026-101',
      issuedDate: '2026-03-24',
    },
  },
  {
    id: 'sub-001',
    studentId: '2023-10421',
    firstName: 'Anna',
    lastName: 'Cruz',
    middleInitial: 'M',
    course: 'BS Computer Science',
    department: 'CCS',
    year: '2',
    status: 'approved',
    submittedAt: '2026-03-05T09:12:00Z',
    updatedAt: '2026-03-07T02:20:00Z',
    staffNotes: 'Cleared. No restrictions.',
    age: '20',
    sex: 'female',
    birthday: '2005-08-12',
    civilStatus: 'Single',
    contactNumber: '09123456789',
    address: 'Olongapo City',
    emergencyContact: {
      name: 'Maria Cruz',
      relationship: 'Mother',
      phone: '09991234567',
      address: 'Olongapo City',
    },
    medicalHistory: {
      allergy: true,
      asthma: false,
      chickenPox: false,
      diabetes: false,
      dysmenorrhea: false,
      epilepsySeizure: false,
      heartDisorder: false,
      hepatitis: false,
      hypertension: false,
      measles: false,
      mumps: false,
      anxietyDisorder: false,
      panicAttack: false,
      pneumonia: false,
      ptbPrimaryComplex: false,
      typhoidFever: false,
      covid19: true,
      uti: false,
    },
    allergyDetails: 'Seafood (shrimp)',
    hadOperation: 'no',
    bloodPressure: '118/76',
    weight: '54',
    height: '160',
    bmi: '21.09',
    staffMeasurements: {
      bloodPressure: '120/78',
      cardiacRate: '72',
      respiratoryRate: '18',
      temperature: '36.5',
      weight: '54',
      height: '160',
      bmi: '21.09',
      visualAcuity: '20/20',
      skin: 'Normal',
      heent: 'Normal',
      chestLungs: 'Clear breath sounds',
      heart: 'Normal rate, regular rhythm',
      abdomen: 'Soft, non-tender',
      extremities: 'No edema',
      examinedBy: 'Dr. Gerald S. Bernal',
    },
    labResults: {
      xrayDate: '2026-03-05',
      xrayResult: 'normal',
      xrayFindings: '',
      cbcDate: '2026-03-05',
      hemoglobin: '13.5',
      hematocrit: '40',
      wbc: '6800',
      plateletCount: '250000',
      bloodType: 'O+',
      urinalysisDate: '2026-03-05',
      urinalysisGlucose: 'Negative',
      urinalysisProtein: 'Negative',
    },
    clearanceInfo: {
      findingsNormal: true,
      diagnosis: '',
      remarks: '',
      purpose: 'enrolment',
      controlNo: 'MC-2026-001',
      issuedDate: '2026-03-07',
    },
  },
  {
    id: 'sub-002',
    studentId: '2022-33419',
    firstName: 'Jared',
    lastName: 'Lim',
    middleInitial: 'K',
    course: 'BS Nursing',
    year: '3',
    status: 'pending',
    submittedAt: '2026-03-08T13:40:00Z',
    age: '21',
    sex: 'male',
    birthday: '2004-02-20',
    civilStatus: 'Single',
    contactNumber: '09223344556',
    address: 'Subic, Zambales',
    emergencyContact: {
      name: 'Grace Lim',
      relationship: 'Mother',
      phone: '09998887766',
      address: 'Subic, Zambales',
    },
    medicalHistory: {
      allergy: false,
      asthma: true,
      diabetes: false,
      hypertension: false,
      heartDisorder: false,
      anxietyDisorder: false,
      pneumonia: false,
      covid19: false,
      uti: false,
    },
    hadOperation: 'no',
    bloodPressure: '122/80',
    weight: '67',
    height: '174',
    bmi: '22.1',
  },
  {
    id: 'sub-003',
    studentId: '2021-88002',
    firstName: 'Mika',
    lastName: 'Reyes',
    middleInitial: 'L',
    course: 'BS Information Technology',
    year: '4',
    status: 'returned',
    submittedAt: '2026-02-25T07:30:00Z',
    updatedAt: '2026-03-01T10:15:00Z',
    staffNotes: 'Please re-upload CBC; file was unreadable.',
    age: '22',
    sex: 'female',
    birthday: '2003-11-03',
    civilStatus: 'Single',
    contactNumber: '09112223334',
    address: 'Olongapo City',
    emergencyContact: {
      name: 'Ronald Reyes',
      relationship: 'Father',
      phone: '09114445556',
      address: 'Olongapo City',
    },
    medicalHistory: {
      allergy: false,
      asthma: false,
      diabetes: false,
      hypertension: true,
      heartDisorder: false,
      anxietyDisorder: true,
      pneumonia: false,
      covid19: true,
      uti: false,
    },
    hadOperation: 'yes',
    operationDetails: 'Appendectomy (2018)',
    bloodPressure: '132/86',
    weight: '62',
    height: '165',
    bmi: '22.8',
  },
  {
    id: 'sub-004',
    studentId: '2024-55210',
    firstName: 'Paolo',
    lastName: 'Santos',
    middleInitial: 'R',
    course: 'BS Business Administration',
    department: 'CBA',
    year: '1',
    status: 'approved',
    submittedAt: '2026-03-02T06:05:00Z',
    updatedAt: '2026-03-04T04:00:00Z',
    age: '18',
    sex: 'male',
    birthday: '2007-06-18',
    civilStatus: 'Single',
    contactNumber: '09190001122',
    address: 'Olongapo City',
    emergencyContact: {
      name: 'Catherine Santos',
      relationship: 'Mother',
      phone: '09190001133',
      address: 'Olongapo City',
    },
    medicalHistory: {
      allergy: false,
      asthma: false,
      chickenPox: false,
      diabetes: false,
      dysmenorrhea: false,
      epilepsySeizure: false,
      heartDisorder: false,
      hepatitis: false,
      hypertension: false,
      measles: false,
      mumps: false,
      anxietyDisorder: false,
      panicAttack: false,
      pneumonia: false,
      ptbPrimaryComplex: false,
      typhoidFever: false,
      covid19: false,
      uti: false,
    },
    hadOperation: 'no',
    bloodPressure: '116/74',
    weight: '58',
    height: '168',
    bmi: '20.5',
    staffMeasurements: {
      bloodPressure: '116/74',
      cardiacRate: '68',
      respiratoryRate: '16',
      temperature: '36.4',
      weight: '58',
      height: '168',
      bmi: '20.5',
      visualAcuity: '20/20',
      skin: 'Normal',
      heent: 'Normal',
      chestLungs: 'Clear',
      heart: 'Normal',
      abdomen: 'Normal',
      extremities: 'Normal',
      examinedBy: 'Dr. Gerald S. Bernal',
    },
    labResults: {
      xrayDate: '2026-03-02',
      xrayResult: 'normal',
      cbcDate: '2026-03-02',
      hemoglobin: '15.0',
      hematocrit: '44',
      wbc: '7200',
      plateletCount: '280000',
      bloodType: 'A+',
      urinalysisDate: '2026-03-02',
      urinalysisGlucose: 'Negative',
      urinalysisProtein: 'Negative',
    },
    clearanceInfo: {
      findingsNormal: true,
      purpose: 'enrolment',
      controlNo: 'MC-2026-002',
      issuedDate: '2026-03-04',
    },
  },
  {
    id: 'sub-005',
    studentId: '2023-77551',
    firstName: 'Bianca',
    lastName: 'Flores',
    middleInitial: 'S',
    course: 'BS Psychology',
    year: '2',
    status: 'pending',
    submittedAt: '2026-03-09T11:55:00Z',
    age: '20',
    sex: 'female',
    birthday: '2005-04-27',
    civilStatus: 'Single',
    contactNumber: '09335557788',
    address: 'Subic, Zambales',
    emergencyContact: {
      name: 'Antonio Flores',
      relationship: 'Father',
      phone: '09330001122',
      address: 'Subic, Zambales',
    },
    medicalHistory: {
      allergy: true,
      asthma: false,
      diabetes: false,
      hypertension: false,
      heartDisorder: false,
      anxietyDisorder: true,
      pneumonia: false,
      covid19: false,
      uti: true,
    },
    allergyDetails: 'Pollen',
    hadOperation: 'no',
    bloodPressure: '120/80',
    weight: '50',
    height: '158',
    bmi: '20.0',
  },
];

export function getMockSubmissions() {
  return mockSubmissions;
}

export function getMockStudents() {
  return mockStudents;
}

export function getMockStudentById(studentId: string) {
  return mockStudents.find((student) => student.student_id === studentId) || null;
}

export function getMockSubmissionById(id: string) {
  return mockSubmissions.find((sub) => sub.id === id) || null;
}

export function getMockStudentRecords(studentId: string) {
  return mockSubmissions
    .filter((sub) => sub.studentId === studentId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

export function getMockAnalytics() {
  const uniqueStudents = new Set(mockSubmissions.map((sub) => sub.studentId)).size;
  const totalSubmissions = mockSubmissions.length;
  const pendingRecords = mockSubmissions.filter((sub) => sub.status === 'pending').length;
  const approvedRecords = mockSubmissions.filter((sub) => sub.status === 'approved').length;
  const returnedRecords = mockSubmissions.filter((sub) => sub.status === 'returned').length;

  return {
    totalStudents: uniqueStudents,
    totalSubmissions,
    pendingRecords,
    approvedRecords,
    returnedRecords,
  };
}
