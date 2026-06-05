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
  examinedBySignatureUrl?: string;
  updatedAt?: string;
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
  glucose?: string;
  protein?: string;
  urinalysisDate?: string;
  urinalysisGlucose?: string;
  urinalysisProtein?: string;
  others?: string;
};

export type ClearanceInfo = {
  findingsNormal?: boolean;
  diagnosis?: string;
  remarks?: string;
  purpose?: string;
  controlNo?: string;
  issuedDate?: string;
  licenseNo?: string;
  signatoryName?: string;
};

export type StudentProfileRecord = {
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

export type SubmissionStatus =
  | 'pending'
  | 'in_review'
  | 'physical_exam_done'
  | 'approved'
  | 'returned'
  | 'resubmitted';

export type SubmissionRecord = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  course: string;
  department?: string;
  year: string;
  studentYearLevel?: string;
  academicYear?: string;
  status: SubmissionStatus;
  submittedAt: string;
  updatedAt?: string;
  reviewedByStaffId?: string;
  reviewedByName?: string;
  reviewedByPosition?: string;
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
  photoUrl?: string;
  signatureUrl?: string;
  xrayFileUrl?: string;
  cbcFileUrl?: string;
  urinalysisFileUrl?: string;
  labTestLocation?: 'jlgh' | 'other' | '';
  otherClinicName?: string;
  cbcTestClinic?: string;
  urinalysisTestClinic?: string;
  xrayTestClinic?: string;
};

export type SubmissionSummaryRecord = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  course: string;
  department?: string;
  year: string;
  studentYearLevel?: string;
  academicYear?: string;
  status: SubmissionStatus;
  submittedAt: string;
  updatedAt?: string;
  reviewedByStaffId?: string;
  reviewedByName?: string;
  reviewedByPosition?: string;
};

export type ApprovedStudentRecordSummary = {
  id: string;
  year: string;
  submittedAt: string;
  updatedAt?: string;
};

export type ApprovedStudentSummary = {
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  course: string;
  department?: string;
  latestSubmittedAt?: string;
  latestUpdatedAt?: string;
  approvedCount: number;
  records: ApprovedStudentRecordSummary[];
};

export type DepartmentBreakdownItem = {
  department: string;
  count: number;
};

export type StaffDashboardOverview = {
  totalSubmissions: number;
  approvedRecords: number;
  pendingRecords: number;
  inReviewRecords: number;
  returnedRecords: number;
  resubmittedRecords: number;
  actionableRecords: number;
  submittedToday: number;
  submittedYesterday: number;
  submittedThisWeek: number;
  submittedThisMonth: number;
  submittedThisAcademicYear: number;
  academicYearLabel: string;
  pendingQueueItems: SubmissionSummaryRecord[];
  inReviewQueueItems: SubmissionSummaryRecord[];
  returnedQueueItems: SubmissionSummaryRecord[];
  resubmittedQueueItems: SubmissionSummaryRecord[];
  departmentBreakdown: DepartmentBreakdownItem[];
};
