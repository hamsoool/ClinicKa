import type { SubmissionRecord } from '../../../lib/record-types';
import type { MEDICAL_CONDITIONS } from './constants';

export type MedicalConditionKey = (typeof MEDICAL_CONDITIONS)[number]['key'];

export type MedicalHistoryState = Record<MedicalConditionKey, boolean>;

export type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
  address: string;
};

export type LabUploadKind = 'cbc' | 'urinalysis' | 'xray';

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
  otherMedicalHistory: string;
  allergyDetails: string;
  hadOperation: 'yes' | 'no';
  operationDetails: string;
  emergencyContact: EmergencyContact;
  dataPrivacyConsent: boolean;
  weight: string;
  height: string;
  bmi: string;
  xrayFile?: File | null;
  cbcFile?: File | null;
  urinalysisFile?: File | null;
  existingXrayFileUrl?: string;
  existingCbcFileUrl?: string;
  existingUrinalysisFileUrl?: string;
  labTestLocation?: '' | 'jlgh' | 'other';
  otherClinicName?: string;
  cbcTestSite: string;
  cbcTestSiteOther: string;
  urinalysisTestSite: string;
  urinalysisTestSiteOther: string;
  xrayTestSite: string;
  xrayTestSiteOther: string;
  physicalCopyAgreement: boolean;
  submissionConfirmed: boolean;
  year: string;
};

export type BmiCategory = {
  category: string;
  color: string;
};

export type SubmissionPreviewRecord = SubmissionRecord;
