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
  purpose?: 'enrolment' | 'ojt' | 'rle';
  controlNo?: string;
  issuedDate?: string;
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
  status: SubmissionStatus;
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
  labTestLocation?: 'jlgh' | 'other' | '';
  otherClinicName?: string;
};
