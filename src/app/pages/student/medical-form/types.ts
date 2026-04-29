import type { MockSubmission } from '../../../lib/mock-data';
import type { MEDICAL_CONDITIONS } from './constants';

export type MedicalConditionKey = (typeof MEDICAL_CONDITIONS)[number]['key'];

export type MedicalHistoryState = Record<MedicalConditionKey, boolean>;

export type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
  address: string;
};

export type MedicalFormData = {
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  department: string;
  course: string;
  yearLevel: string;
  age: string;
  sex: string;
  birthday: string;
  civilStatus: string;
  contactNumber: string;
  address: string;
  medicalHistory: MedicalHistoryState;
  allergyDetails: string;
  hadOperation: 'yes' | 'no';
  operationDetails: string;
  emergencyContact: EmergencyContact;
  dataPrivacyConsent: boolean;
  signatureFile: File | null;
  photoFile: File | null;
  bloodPressure: string;
  weight: string;
  height: string;
  bmi: string;
  xrayFile: File | null;
  cbcFile: File | null;
  urinalysisFile: File | null;
  year: string;
};

export type BmiCategory = {
  category: string;
  color: string;
};

export type SubmissionPreviewRecord = MockSubmission;
