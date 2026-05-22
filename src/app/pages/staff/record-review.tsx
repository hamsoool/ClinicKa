import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  ImageUp,
  Save,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import PortalPageIntro from '../../components/portal-page-intro';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';

import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { saveSubmissionReview, updateSubmissionStatus, uploadFile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { MedicalHistory, SubmissionRecord } from '../../lib/record-types';
import { SubmittedFilePreview } from './record-review/submitted-file-preview';
import {
  invalidateStaffWorkflowQueries,
  useStaffSubmissionDetailQuery,
} from './staff-workflow-query';
import {
  EMERGENCY_CONTACT_RELATIONSHIPS,
  formatPhilippinePhoneInput,
  getProgramOptionsForSelect,
  isValidPhilippinePhoneNumber,
  normalizeProgramForDepartment,
  resolveDepartmentValue,
} from '../student/medical-form/constants';

type SubmissionDetails = SubmissionRecord & {
  photoUrl?: string;
  xrayFileUrl?: string;
  cbcFileUrl?: string;
  urinalysisFileUrl?: string;
  signatureUrl?: string;
  labTestLocation?: 'jlgh' | 'other' | '';
  otherClinicName?: string;
};

type ReviewStatus = SubmissionRecord['status'];
type LabUploadType = 'xray' | 'cbc' | 'urinalysis';

type RecordForm = {
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  department: string;
  course: string;
  year: string;
  age: string;
  sex: string;
  birthday: string;
  civilStatus: string;
  contactNumber: string;
  address: string;
  allergyDetails: string;
  hadOperation: 'yes' | 'no';
  operationDetails: string;
  weight: string;
  height: string;
  bmi: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
    address: string;
  };
  medicalHistory: MedicalHistory;
};

type AssessmentForm = {
  bloodPressure: string;
  cardiacRate: string;
  respiratoryRate: string;
  temperature: string;
  weight: string;
  height: string;
  bmi: string;
  visualAcuity: string;
  skin: string;
  heent: string;
  chestLungs: string;
  heart: string;
  abdomen: string;
  extremities: string;
  others: string;
  examinedBy: string;
  xrayDate: string;
  xrayResult: 'normal' | 'abnormal';
  xrayFindings: string;
  cbcDate: string;
  hemoglobin: string;
  hematocrit: string;
  wbc: string;
  plateletCount: string;
  bloodType: string;
  glucose: string;
  protein: string;
  urinalysisDate: string;
  urinalysisGlucose: string;
  urinalysisProtein: string;
};

type ClearanceForm = {
  findingsNormal: boolean;
  diagnosis: string;
  remarks: string;
  purpose: ClearancePurpose[];
  controlNo: string;
  issuedDate: string;
  licenseNo: string;
};

type ClearancePurpose = 'enrolment' | 'ojt' | 'rle';

const CLEARANCE_PURPOSE_OPTIONS: Array<{ value: ClearancePurpose; label: string }> = [
  { value: 'enrolment', label: 'Enrollment' },
  { value: 'ojt', label: 'OJT' },
  { value: 'rle', label: 'RLE' },
];
const DEFAULT_LICENSE_NO = '008455';
const CLEARANCE_LICENSE_OPTIONS = [
  { value: DEFAULT_LICENSE_NO, label: `Current License No. ${DEFAULT_LICENSE_NO}` },
  { value: 'manual', label: 'Manual license no.' },
] as const;
const CLEARANCE_DOCTORS = ['GERALD S. BERNAL, MD', 'ARMANDO TAMAYO, MD'] as const;

const MEDICAL_HISTORY_FIELDS: Array<{ key: keyof MedicalHistory; label: string }> = [
  { key: 'allergy', label: 'Allergy' },
  { key: 'asthma', label: 'Asthma' },
  { key: 'chickenPox', label: 'Chicken Pox' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'dysmenorrhea', label: 'Dysmenorrhea' },
  { key: 'epilepsySeizure', label: 'Epilepsy / Seizure' },
  { key: 'heartDisorder', label: 'Heart Disorder' },
  { key: 'hepatitis', label: 'Hepatitis' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'measles', label: 'Measles' },
  { key: 'mumps', label: 'Mumps' },
  { key: 'anxietyDisorder', label: 'Anxiety Disorder' },
  { key: 'panicAttack', label: 'Panic Attack' },
  { key: 'pneumonia', label: 'Pneumonia' },
  { key: 'ptbPrimaryComplex', label: 'PTB Primary Complex' },
  { key: 'typhoidFever', label: 'Typhoid Fever' },
  { key: 'covid19', label: 'COVID-19' },
  { key: 'uti', label: 'UTI' },
];

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAS', 'CED'];
const YEAR_OPTIONS = ['1', '2', '3', '4'];
const LAB_IMAGE_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const URINALYSIS_DIPSTICK_OPTIONS = ['Negative', 'Trace', '1+', '2+', '3+', '4+'] as const;
const BLOOD_PRESSURE_PATTERN = /^\d{2,3}\/\d{2,3}$/;
const VISUAL_ACUITY_PATTERN = /^\d{1,2}\/\d{1,3}$/;
const REVIEW_STEPS = ['record', 'labs', 'assessment', 'decision'] as const;
const MAX_FIRST_NAME_LENGTH = 30;
const MAX_LAST_NAME_LENGTH = 20;
const MAX_MIDDLE_INITIAL_LENGTH = 1;
const MAX_AGE_LENGTH = 2;
const MAX_SEX_OTHER_LENGTH = 15;
const MAX_ADDRESS_LENGTH = 180;
const MAX_EMERGENCY_NAME_LENGTH = 40;
const MAX_ALLERGY_DETAILS_LENGTH = 100;
const MAX_OPERATION_HISTORY_LENGTH = 100;
const MAX_FINDINGS_LENGTH = 100;
const MAX_PHYSICAL_EXAM_FIELD_LENGTH = 100;
const MAX_PHYSICAL_EXAM_NOTES_LENGTH = 150;
const MAX_EXAMINED_BY_LENGTH = 40;
const MAX_CLINIC_NOTES_LENGTH = 100;
const MAX_CLEARANCE_DIAGNOSIS_LENGTH = 50;
const MAX_CLEARANCE_REMARKS_LENGTH = 50;
const SEX_BASE_OPTIONS = ['male', 'female'] as const;
const CIVIL_STATUS_OPTIONS = ['Single', 'Married'] as const;

type ReviewStep = (typeof REVIEW_STEPS)[number];

type LabUploadActionsProps = {
  title: string;
  isUploading: boolean;
  onChooseImage: () => void;
  onOpenCamera: () => void;
};

function LabUploadActions({
  title,
  isUploading,
  onChooseImage,
  onOpenCamera,
}: LabUploadActionsProps) {
  return (
    <div className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-on-surface">Add or replace {title} image</p>
          <p className="text-xs text-on-surface-variant">
            Images only, up to 2MB. Camera opens on supported mobile devices.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button type="button" variant="outline" onClick={onChooseImage} disabled={isUploading} className="w-full sm:w-auto">
            <ImageUp className="mr-2 h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload Image'}
          </Button>
          <Button type="button" variant="outline" onClick={onOpenCamera} disabled={isUploading} className="w-full sm:w-auto">
            <Camera className="mr-2 h-4 w-4" />
            Use Camera
          </Button>
        </div>
      </div>
    </div>
  );
}

function createEmptyMedicalHistory(): MedicalHistory {
  return MEDICAL_HISTORY_FIELDS.reduce((acc, item) => {
    acc[item.key] = false;
    return acc;
  }, {} as MedicalHistory);
}

function calculateBmi(weight: string, height: string) {
  const weightValue = Number(weight);
  const heightValue = Number(height);

  if (!weightValue || !heightValue) return '';

  const meters = heightValue / 100;
  if (!meters) return '';

  return (weightValue / (meters * meters)).toFixed(2);
}

function sanitizeNumericInput(value: string, maxDecimalPlaces = 2) {
  const sanitized = value.replace(/[^\d.]/g, '');
  const [integerPart = '', ...decimalParts] = sanitized.split('.');
  const decimalPart = decimalParts.join('').slice(0, maxDecimalPlaces);

  if (!sanitized.includes('.')) return integerPart;
  return `${integerPart}.${decimalPart}`;
}

function sanitizeFractionLikeInput(value: string, maxLeftDigits: number, maxRightDigits: number) {
  const sanitized = value.replace(/[^\d/]/g, '');
  const [left = '', ...rightParts] = sanitized.split('/');
  const normalizedLeft = left.slice(0, maxLeftDigits);
  const right = rightParts.join('');
  const normalizedRight = right.slice(0, maxRightDigits);

  if (!sanitized.includes('/')) return normalizedLeft;
  return `${normalizedLeft}/${normalizedRight}`;
}

function isValidBloodPressure(value: string) {
  const trimmedValue = value.trim();
  return !trimmedValue || BLOOD_PRESSURE_PATTERN.test(trimmedValue);
}

function isValidVisualAcuity(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return true;
  if (VISUAL_ACUITY_PATTERN.test(trimmedValue)) return true;
  return /^(OD|OS)\s\d{1,2}\/\d{1,3}$/i.test(trimmedValue);
}

function normalizeDateInputValue(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // Accept full ISO values by truncating to date part first.
  const candidate = raw.includes('T') ? raw.slice(0, 10) : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return '';

  const [year, month, day] = candidate.split('-').map((part) => Number(part));
  if (!year || !month || !day) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  const isSameDate =
    date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;

  return isSameDate ? candidate : '';
}

function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeNumericWithLimits(value: string, maxIntegerDigits: number, maxDecimalPlaces = 2) {
  const sanitized = String(value).replace(/[^\d.]/g, '');
  const [integerPartRaw = '', ...decimalParts] = sanitized.split('.');
  const integerPart = integerPartRaw.slice(0, maxIntegerDigits);
  const decimalPart = decimalParts.join('').slice(0, maxDecimalPlaces);

  if (!sanitized.includes('.')) return integerPart;
  return `${integerPart}.${decimalPart}`;
}

function trimTrailingDecimalZeros(value: string) {
  return value.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function normalizeCountToX10Power9(value: string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;
  if (numericValue <= 1000) return value;
  const converted = (numericValue / 1000).toFixed(2);
  return trimTrailingDecimalZeros(converted);
}

function normalizeCountToX10Power9Whole(value: string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;
  if (numericValue <= 1000) return sanitizeNumericWithLimits(value, 4, 0);
  return String(Math.round(numericValue / 1000));
}

function sanitizeLettersOnly(value: string, maxLength: number) {
  return String(value).replace(/[^A-Za-z\s]/g, '').slice(0, maxLength);
}

function sanitizeMiddleInitial(value: string) {
  return String(value).replace(/[^A-Za-z]/g, '').slice(0, MAX_MIDDLE_INITIAL_LENGTH);
}

function sanitizeSexOther(value: string) {
  return String(value).replace(/[^A-Za-z\s]/g, '').slice(0, MAX_SEX_OTHER_LENGTH);
}

function sanitizeAddress(value: string) {
  return String(value)
    .replace(/[<>`]/g, '')
    .replace(/--|\/\*|\*\//g, '')
    .slice(0, MAX_ADDRESS_LENGTH);
}

function sanitizeSafeText(value: string, maxLength: number) {
  return String(value)
    .replace(/[<>`]/g, '')
    .replace(/--|\/\*|\*\//g, '')
    .replace(/;/g, '')
    .slice(0, maxLength);
}

function sanitizeVisualAcuityText(value: string) {
  return String(value)
    .replace(/[^A-Za-z0-9/\s]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 20);
}

function sanitizeContactNumber(value: string) {
  return formatPhilippinePhoneInput(String(value));
}

function sanitizeEmergencyName(value: string) {
  return String(value).replace(/[^A-Za-z\s]/g, '').slice(0, MAX_EMERGENCY_NAME_LENGTH);
}

function normalizeSexValue(value: string) {
  const trimmed = String(value || '').trim();
  const lowered = trimmed.toLowerCase();
  if (!trimmed) return '';
  if ((SEX_BASE_OPTIONS as readonly string[]).includes(lowered)) return lowered;
  if (lowered === 'others') return 'others';
  return sanitizeSexOther(trimmed);
}

function getSexSelectValue(value: string) {
  const lowered = String(value || '').trim().toLowerCase();
  if ((SEX_BASE_OPTIONS as readonly string[]).includes(lowered)) return lowered;
  if (lowered === 'others') return 'others';
  if (lowered) return 'others';
  return 'unassigned';
}

function getSexOtherInputValue(value: string) {
  const lowered = String(value || '').trim().toLowerCase();
  if (!lowered || lowered === 'others' || (SEX_BASE_OPTIONS as readonly string[]).includes(lowered)) return '';
  return value;
}

function generateClearanceControlNo(submission?: SubmissionDetails | null) {
  const yearTag = String(submission?.year || '').trim() || 'Y';
  const studentTag = String(submission?.studentId || '').trim() || 'STUDENT';
  const currentYear = new Date().getFullYear();
  return `GC-${currentYear}-${yearTag}-${studentTag}`;
}

function normalizeClearancePurposes(value?: string | string[] | null): ClearancePurpose[] {
  const rawValues = Array.isArray(value)
    ? value
    : String(value || '')
      .split(',')
      .map((item) => item.trim());

  const normalized = rawValues
    .map((item) => (item.toLowerCase() === 'enrollment' ? 'enrolment' : item.toLowerCase()))
    .filter((item): item is ClearancePurpose =>
      CLEARANCE_PURPOSE_OPTIONS.some((option) => option.value === item),
    );

  return [...new Set(normalized)];
}

function serializeClearancePurposes(value: ClearancePurpose[]) {
  return value.join(',');
}

function sanitizeLicenseNo(value: string) {
  return String(value || '').replace(/\D/g, '').slice(0, 15);
}

function createRecordForm(submission?: SubmissionDetails | null): RecordForm {
  const department = resolveDepartmentValue(submission?.department || '');
  return {
    studentId: submission?.studentId || '',
    firstName: sanitizeLettersOnly(submission?.firstName || '', MAX_FIRST_NAME_LENGTH),
    lastName: sanitizeLettersOnly(submission?.lastName || '', MAX_LAST_NAME_LENGTH),
    middleInitial: sanitizeMiddleInitial(submission?.middleInitial || ''),
    department,
    course: normalizeProgramForDepartment(department, submission?.course || ''),
    year: submission?.year || '',
    age: String(submission?.age || '').replace(/\D/g, '').slice(0, MAX_AGE_LENGTH),
    sex: normalizeSexValue(submission?.sex || ''),
    birthday: normalizeDateInputValue(submission?.birthday),
    civilStatus: CIVIL_STATUS_OPTIONS.includes((submission?.civilStatus || '') as (typeof CIVIL_STATUS_OPTIONS)[number])
      ? String(submission?.civilStatus)
      : '',
    contactNumber: sanitizeContactNumber(submission?.contactNumber || ''),
    address: sanitizeAddress(submission?.address || ''),
    allergyDetails: submission?.allergyDetails || '',
    hadOperation: submission?.hadOperation || 'no',
    operationDetails: submission?.operationDetails || '',
    weight: submission?.weight || '',
    height: submission?.height || '',
    bmi: submission?.bmi || calculateBmi(submission?.weight || '', submission?.height || ''),
    emergencyContact: {
      name: sanitizeEmergencyName(submission?.emergencyContact?.name || ''),
      relationship: EMERGENCY_CONTACT_RELATIONSHIPS.includes((submission?.emergencyContact?.relationship || '') as any)
        ? String(submission?.emergencyContact?.relationship || '')
        : '',
      phone: sanitizeContactNumber(submission?.emergencyContact?.phone || ''),
      address: sanitizeAddress(submission?.emergencyContact?.address || ''),
    },
    medicalHistory: {
      ...createEmptyMedicalHistory(),
      ...(submission?.medicalHistory || {}),
    },
  };
}

function createAssessmentForm(submission?: SubmissionDetails | null): AssessmentForm {
  return {
    bloodPressure: submission?.staffMeasurements?.bloodPressure || submission?.bloodPressure || '',
    cardiacRate: submission?.staffMeasurements?.cardiacRate || '',
    respiratoryRate: submission?.staffMeasurements?.respiratoryRate || '',
    temperature: submission?.staffMeasurements?.temperature || '',
    weight: submission?.staffMeasurements?.weight || submission?.weight || '',
    height: submission?.staffMeasurements?.height || submission?.height || '',
    bmi:
      submission?.staffMeasurements?.bmi ||
      submission?.bmi ||
      calculateBmi(
        submission?.staffMeasurements?.weight || submission?.weight || '',
        submission?.staffMeasurements?.height || submission?.height || '',
      ),
    visualAcuity: submission?.staffMeasurements?.visualAcuity || '',
    skin: submission?.staffMeasurements?.skin || '',
    heent: submission?.staffMeasurements?.heent || '',
    chestLungs: submission?.staffMeasurements?.chestLungs || '',
    heart: submission?.staffMeasurements?.heart || '',
    abdomen: submission?.staffMeasurements?.abdomen || '',
    extremities: submission?.staffMeasurements?.extremities || '',
    others: submission?.staffMeasurements?.others || '',
    examinedBy: sanitizeSafeText(submission?.staffMeasurements?.examinedBy || '', MAX_EXAMINED_BY_LENGTH),
    xrayDate: normalizeDateInputValue(submission?.labResults?.xrayDate) || getTodayDateInputValue(),
    xrayResult: submission?.labResults?.xrayResult || 'normal',
    xrayFindings: submission?.labResults?.xrayFindings || '',
    cbcDate: normalizeDateInputValue(submission?.labResults?.cbcDate) || getTodayDateInputValue(),
    hemoglobin: submission?.labResults?.hemoglobin || '',
    hematocrit: submission?.labResults?.hematocrit || '',
    wbc: submission?.labResults?.wbc || '',
    plateletCount: submission?.labResults?.plateletCount || '',
    bloodType: submission?.labResults?.bloodType || '',
    glucose: submission?.labResults?.glucose || submission?.labResults?.urinalysisGlucose || '',
    protein: submission?.labResults?.protein || submission?.labResults?.urinalysisProtein || '',
    urinalysisDate: normalizeDateInputValue(submission?.labResults?.urinalysisDate) || getTodayDateInputValue(),
    urinalysisGlucose: submission?.labResults?.urinalysisGlucose || submission?.labResults?.glucose || '',
    urinalysisProtein: submission?.labResults?.urinalysisProtein || submission?.labResults?.protein || '',
  };
}

function createClearanceForm(submission?: SubmissionDetails | null): ClearanceForm {
  return {
    findingsNormal: submission?.clearanceInfo?.findingsNormal ?? true,
    diagnosis: sanitizeSafeText(submission?.clearanceInfo?.diagnosis || '', MAX_CLEARANCE_DIAGNOSIS_LENGTH),
    remarks: sanitizeSafeText(submission?.clearanceInfo?.remarks || '', MAX_CLEARANCE_REMARKS_LENGTH),
    purpose: normalizeClearancePurposes(submission?.clearanceInfo?.purpose),
    controlNo: submission?.clearanceInfo?.controlNo || generateClearanceControlNo(submission),
    issuedDate: normalizeDateInputValue(submission?.clearanceInfo?.issuedDate) || getTodayDateInputValue(),
    licenseNo: sanitizeLicenseNo(submission?.clearanceInfo?.licenseNo || DEFAULT_LICENSE_NO),
  };
}

function getStatusBadge(status: ReviewStatus) {
  switch (status) {
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending Review</Badge>;
    case 'in_review':
      return null;
    case 'physical_exam_done':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Physical Exam Done</Badge>;
    case 'approved':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
    case 'returned':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Returned</Badge>;
    case 'resubmitted':
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Resubmitted</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

function countVerifiedConditions(history: MedicalHistory) {
  return Object.values(history).filter(Boolean).length;
}

export default function StaffRecordReview() {
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const currentStaffId = String(me?.staff?.id || '').trim();
  const isDoctorWorkspace =
    ['clinic doctor', 'doctor'].includes(String(me?.staff?.position || '').trim().toLowerCase())
    || me?.profile.role === 'admin';
  const hasFullClinicReviewAccess =
    isDoctorWorkspace || me?.profile.role === 'staff';
  const canFinalizeClearance = hasFullClinicReviewAccess;
  const [submission, setSubmission] = useState<SubmissionDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [recordForm, setRecordForm] = useState<RecordForm>(() => createRecordForm());
  const [assessmentForm, setAssessmentForm] = useState<AssessmentForm>(() => createAssessmentForm());
  const [clearanceForm, setClearanceForm] = useState<ClearanceForm>(() => createClearanceForm());
  const [staffNotes, setStaffNotes] = useState('');
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('pending');
  const [activeReviewStep, setActiveReviewStep] = useState<ReviewStep>('record');
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [uploadingLabFile, setUploadingLabFile] = useState<Record<LabUploadType, boolean>>({
    xray: false,
    cbc: false,
    urinalysis: false,
  });
  const inReviewTransitionRef = useRef<string | null>(null);
  const xrayUploadInputRef = useRef<HTMLInputElement | null>(null);
  const cbcUploadInputRef = useRef<HTMLInputElement | null>(null);
  const urinalysisUploadInputRef = useRef<HTMLInputElement | null>(null);
  const xrayCameraInputRef = useRef<HTMLInputElement | null>(null);
  const cbcCameraInputRef = useRef<HTMLInputElement | null>(null);
  const urinalysisCameraInputRef = useRef<HTMLInputElement | null>(null);
  const defaultSignatoryName = [
    me?.staff?.first_name || me?.profile.first_name || '',
    me?.staff?.last_name || me?.profile.last_name || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  const {
    data: submissionData,
    isLoading: loading,
    isError,
  } = useStaffSubmissionDetailQuery(submissionId);

  useEffect(() => {
    const loadedSubmission = (submissionData || null) as SubmissionDetails | null;

    if (!loadedSubmission) {
      setSubmission(null);
      return;
    }

    setSubmission(loadedSubmission);
    setRecordForm(createRecordForm(loadedSubmission));
    const nextAssessmentForm = createAssessmentForm(loadedSubmission);
    if (!nextAssessmentForm.examinedBy && defaultSignatoryName) {
      nextAssessmentForm.examinedBy = defaultSignatoryName;
    }
    setAssessmentForm(nextAssessmentForm);
    setClearanceForm(createClearanceForm(loadedSubmission));
    setStaffNotes(loadedSubmission.staffNotes || '');
    setReviewStatus(loadedSubmission.status);
  }, [defaultSignatoryName, submissionData]);

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load submission');
    }
  }, [isError]);

  useEffect(() => {
    if (!defaultSignatoryName) return;
    setAssessmentForm((prev) => (prev.examinedBy ? prev : { ...prev, examinedBy: defaultSignatoryName }));
  }, [defaultSignatoryName]);

  useEffect(() => {
    if (!submissionId || !submission) return;

    const normalizedStatus = String(submission.status || '').toLowerCase();
    if (!['pending', 'resubmitted'].includes(normalizedStatus)) return;
    if (inReviewTransitionRef.current === submission.id) return;

    inReviewTransitionRef.current = submission.id;
    let isActive = true;

    void (async () => {
      try {
        await updateSubmissionStatus(submissionId, 'in_review', submission.staffNotes || '');
        if (!isActive) return;

        const now = new Date().toISOString();
        setSubmission((prev) => (prev && prev.id === submission.id ? { ...prev, status: 'in_review', updatedAt: now } : prev));
        setReviewStatus((prev) => (prev === 'pending' || prev === 'resubmitted' ? 'in_review' : prev));
        await invalidateStaffWorkflowQueries(queryClient, submissionId, submission.studentId);
      } catch (error) {
        console.warn('Failed to mark submission as in review:', error);
        await invalidateStaffWorkflowQueries(queryClient, submissionId, submission.studentId);
        const errorMessage = error instanceof Error ? error.message.trim() : '';
        toast.error(errorMessage || 'Could not update the record status. Please refresh and try again.');
        inReviewTransitionRef.current = null;
      }
    })();

    return () => {
      isActive = false;
    };
  }, [queryClient, submission, submissionId]);

  function updateRecordField<K extends keyof RecordForm>(field: K, value: RecordForm[K]) {
    setRecordForm((prev) => {
      const normalizedValue =
        field === 'birthday'
          ? (normalizeDateInputValue(String(value)) as RecordForm[K])
          : field === 'firstName'
          ? (sanitizeLettersOnly(String(value), MAX_FIRST_NAME_LENGTH) as RecordForm[K])
          : field === 'lastName'
          ? (sanitizeLettersOnly(String(value), MAX_LAST_NAME_LENGTH) as RecordForm[K])
          : field === 'middleInitial'
          ? (sanitizeMiddleInitial(String(value)) as RecordForm[K])
          : field === 'age'
          ? (String(value).replace(/\D/g, '').slice(0, MAX_AGE_LENGTH) as RecordForm[K])
          : field === 'sex'
          ? (normalizeSexValue(String(value)) as RecordForm[K])
          : field === 'civilStatus'
          ? ((CIVIL_STATUS_OPTIONS.includes(String(value) as (typeof CIVIL_STATUS_OPTIONS)[number]) ? value : '') as RecordForm[K])
          : field === 'contactNumber'
          ? (sanitizeContactNumber(String(value)) as RecordForm[K])
          : field === 'address'
          ? (sanitizeAddress(String(value)) as RecordForm[K])
          : field === 'allergyDetails'
          ? (String(value).slice(0, MAX_ALLERGY_DETAILS_LENGTH) as RecordForm[K])
          : field === 'operationDetails'
          ? (String(value).slice(0, MAX_OPERATION_HISTORY_LENGTH) as RecordForm[K])
          : value;
      const next = { ...prev, [field]: normalizedValue };

      if (field === 'department') {
        const nextDepartment = resolveDepartmentValue(String(normalizedValue));
        next.department = nextDepartment;
        next.course = normalizeProgramForDepartment(nextDepartment, '');
      }

      if (field === 'weight' || field === 'height') {
        next.bmi = calculateBmi(
          field === 'weight' ? String(value) : prev.weight,
          field === 'height' ? String(value) : prev.height,
        );
      }

      if (field === 'hadOperation' && value === 'no') {
        next.operationDetails = '';
      }

      return next;
    });
  }

  function updateEmergencyContact(field: keyof RecordForm['emergencyContact'], value: string) {
    const normalizedValue =
      field === 'name'
        ? sanitizeEmergencyName(value)
        : field === 'phone'
        ? sanitizeContactNumber(value)
        : field === 'address'
        ? sanitizeAddress(value)
        : field === 'relationship'
        ? (EMERGENCY_CONTACT_RELATIONSHIPS.includes(value as any) ? value : '')
        : value;

    setRecordForm((prev) => ({
      ...prev,
      emergencyContact: {
        ...prev.emergencyContact,
        [field]: normalizedValue,
      },
    }));
  }

  function toggleMedicalHistory(field: keyof MedicalHistory, checked: boolean) {
    setRecordForm((prev) => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        [field]: checked,
      },
      allergyDetails:
        field === 'allergy' && !checked
          ? ''
          : prev.allergyDetails,
    }));
  }

  function updateAssessmentField<K extends keyof AssessmentForm>(field: K, value: AssessmentForm[K]) {
    setAssessmentForm((prev) => {
      let normalizedValue = value;

      if (field === 'xrayDate' || field === 'cbcDate' || field === 'urinalysisDate') {
        normalizedValue = normalizeDateInputValue(String(value)) as AssessmentForm[K];
      } else if (field === 'xrayFindings') {
        normalizedValue = sanitizeSafeText(String(value), MAX_FINDINGS_LENGTH) as AssessmentForm[K];
      } else if (field === 'hemoglobin') {
        normalizedValue = sanitizeNumericWithLimits(String(value), 2, 1) as AssessmentForm[K];
      } else if (field === 'hematocrit') {
        normalizedValue = sanitizeNumericWithLimits(String(value), 3, 1) as AssessmentForm[K];
      } else if (field === 'wbc') {
        const safeValue = sanitizeNumericWithLimits(String(value), 6, 2);
        normalizedValue = normalizeCountToX10Power9(safeValue) as AssessmentForm[K];
      } else if (field === 'plateletCount') {
        const safeValue = sanitizeNumericWithLimits(String(value), 7, 0);
        normalizedValue = normalizeCountToX10Power9Whole(safeValue) as AssessmentForm[K];
      } else if (
        field === 'skin'
        || field === 'heent'
        || field === 'chestLungs'
        || field === 'heart'
        || field === 'abdomen'
        || field === 'extremities'
      ) {
        normalizedValue = sanitizeSafeText(String(value), MAX_PHYSICAL_EXAM_FIELD_LENGTH) as AssessmentForm[K];
      } else if (field === 'examinedBy') {
        normalizedValue = sanitizeSafeText(String(value), MAX_EXAMINED_BY_LENGTH) as AssessmentForm[K];
      } else if (field === 'others') {
        normalizedValue = sanitizeSafeText(String(value), MAX_PHYSICAL_EXAM_NOTES_LENGTH) as AssessmentForm[K];
      } else if (field === 'cardiacRate') {
        normalizedValue = sanitizeNumericWithLimits(String(value), 3, 0) as AssessmentForm[K];
      } else if (field === 'respiratoryRate') {
        normalizedValue = sanitizeNumericWithLimits(String(value), 3, 0) as AssessmentForm[K];
      } else if (field === 'temperature') {
        normalizedValue = sanitizeNumericWithLimits(String(value), 2, 1) as AssessmentForm[K];
      } else if (field === 'weight') {
        normalizedValue = sanitizeNumericWithLimits(String(value), 3, 1) as AssessmentForm[K];
      } else if (field === 'height') {
        normalizedValue = sanitizeNumericWithLimits(String(value), 3, 1) as AssessmentForm[K];
      } else if (field === 'bloodPressure') {
        normalizedValue = sanitizeFractionLikeInput(String(value), 3, 3) as AssessmentForm[K];
      } else if (field === 'visualAcuity') {
        normalizedValue = sanitizeVisualAcuityText(String(value)) as AssessmentForm[K];
      }

      const next = { ...prev, [field]: normalizedValue };

      if (field === 'weight' || field === 'height') {
        next.bmi = calculateBmi(
          field === 'weight' ? String(normalizedValue) : prev.weight,
          field === 'height' ? String(normalizedValue) : prev.height,
        );
      }

      if (field === 'urinalysisGlucose') {
        next.glucose = String(normalizedValue);
      }

      if (field === 'urinalysisProtein') {
        next.protein = String(normalizedValue);
      }

      return next;
    });
  }

  function updateClearanceField<K extends keyof ClearanceForm>(field: K, value: ClearanceForm[K]) {
    setClearanceForm((prev) => ({
      ...prev,
      [field]:
        field === 'issuedDate'
          ? normalizeDateInputValue(String(value))
          : field === 'diagnosis'
          ? sanitizeSafeText(String(value), MAX_CLEARANCE_DIAGNOSIS_LENGTH)
          : field === 'remarks'
          ? sanitizeSafeText(String(value), MAX_CLEARANCE_REMARKS_LENGTH)
          : field === 'purpose'
          ? normalizeClearancePurposes(value as ClearanceForm['purpose'])
          : field === 'licenseNo'
          ? sanitizeLicenseNo(String(value))
          : value,
    }));
  }

  function toggleClearancePurpose(purpose: ClearancePurpose, checked: boolean) {
    setClearanceForm((prev) => {
      const nextPurpose = checked
        ? [...new Set([...prev.purpose, purpose])]
        : prev.purpose.filter((item) => item !== purpose);

      return {
        ...prev,
        purpose: nextPurpose,
      };
    });
  }

  function validateLabImageFile(file: File, title: string) {
    if (!file.type.startsWith('image/')) {
      toast.error(`${title} must be uploaded as an image.`);
      return false;
    }

    if (file.size > LAB_IMAGE_MAX_SIZE_BYTES) {
      toast.error(`${title} image must be 2MB or smaller.`);
      return false;
    }

    return true;
  }

  function getLabUploadTitle(fileType: LabUploadType) {
    if (fileType === 'xray') return 'Chest X-Ray';
    if (fileType === 'cbc') return 'CBC';
    return 'Urinalysis';
  }

  function getLabImageInputRef(fileType: LabUploadType, source: 'library' | 'camera') {
    if (fileType === 'xray') {
      return source === 'camera' ? xrayCameraInputRef : xrayUploadInputRef;
    }
    if (fileType === 'cbc') {
      return source === 'camera' ? cbcCameraInputRef : cbcUploadInputRef;
    }
    return source === 'camera' ? urinalysisCameraInputRef : urinalysisUploadInputRef;
  }

  function openLabImagePicker(fileType: LabUploadType, source: 'library' | 'camera') {
    getLabImageInputRef(fileType, source).current?.click();
  }

  async function handleLabImageSelected(fileType: LabUploadType, file: File | null) {
    if (!submissionId || !submission || !file) return;

    const title = getLabUploadTitle(fileType);
    if (!validateLabImageFile(file, title)) return;

    setUploadingLabFile((prev) => ({ ...prev, [fileType]: true }));
    try {
      const result = await uploadFile(file, submissionId, fileType);
      const nextUrl = result.url || '';
      const now = new Date().toISOString();

      setSubmission((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          xrayFileUrl: fileType === 'xray' ? nextUrl || prev.xrayFileUrl : prev.xrayFileUrl,
          cbcFileUrl: fileType === 'cbc' ? nextUrl || prev.cbcFileUrl : prev.cbcFileUrl,
          urinalysisFileUrl: fileType === 'urinalysis' ? nextUrl || prev.urinalysisFileUrl : prev.urinalysisFileUrl,
          updatedAt: now,
        };
      });

      await invalidateStaffWorkflowQueries(queryClient, submissionId, submission.studentId);
      toast.success(`${title} image uploaded.`);
    } catch (error) {
      console.error(`Failed to upload ${fileType} image:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to upload ${title} image.`);
    } finally {
      setUploadingLabFile((prev) => ({ ...prev, [fileType]: false }));
    }
  }

  async function persistReview(nextStatus?: ReviewStatus, customNotes?: string) {
    if (!submissionId || !submission) return;
    if (!/^\d{2}$/.test(recordForm.age)) {
      toast.error('Age must be exactly 2 digits.');
      return;
    }
    if (recordForm.contactNumber && !isValidPhilippinePhoneNumber(recordForm.contactNumber)) {
      toast.error('Contact number must follow (+63) 9XXXXXXXXX.');
      return;
    }
    if (recordForm.emergencyContact.phone && !isValidPhilippinePhoneNumber(recordForm.emergencyContact.phone)) {
      toast.error('Emergency contact phone must follow (+63) 9XXXXXXXXX.');
      return;
    }
    const targetStatus = nextStatus || reviewStatus;
    if (canFinalizeClearance && targetStatus === 'approved' && clearanceForm.purpose.length === 0) {
      toast.error('Select at least one clearance purpose.');
      return;
    }
    if (canFinalizeClearance && targetStatus === 'approved' && !clearanceForm.licenseNo.trim()) {
      toast.error('License number is required before clearing this record.');
      return;
    }

    setSaving(true);
    try {
      const statusToSave = targetStatus;
      const notesToSave = customNotes !== undefined ? customNotes : staffNotes;
      const preserveDoctorField = (
        field:
          | 'skin'
          | 'heent'
          | 'chestLungs'
          | 'heart'
          | 'abdomen'
          | 'extremities'
          | 'others'
          | 'examinedBy',
        incoming: string,
      ) => {
        if (hasFullClinicReviewAccess) return incoming;
        const trimmedIncoming = String(incoming || '').trim();
        if (trimmedIncoming) return incoming;
        return (submission.staffMeasurements as any)?.[field] || '';
      };

      const staffMeasurementsPayload = {
        bloodPressure: assessmentForm.bloodPressure,
        cardiacRate: assessmentForm.cardiacRate,
        respiratoryRate: assessmentForm.respiratoryRate,
        temperature: assessmentForm.temperature,
        weight: assessmentForm.weight,
        height: assessmentForm.height,
        bmi: assessmentForm.bmi,
        visualAcuity: assessmentForm.visualAcuity,
        skin: preserveDoctorField('skin', assessmentForm.skin),
        heent: preserveDoctorField('heent', assessmentForm.heent),
        chestLungs: preserveDoctorField('chestLungs', assessmentForm.chestLungs),
        heart: preserveDoctorField('heart', assessmentForm.heart),
        abdomen: preserveDoctorField('abdomen', assessmentForm.abdomen),
        extremities: preserveDoctorField('extremities', assessmentForm.extremities),
        others: preserveDoctorField('others', assessmentForm.others),
        examinedBy: preserveDoctorField('examinedBy', assessmentForm.examinedBy),
        staff_notes: notesToSave,
      };

      await saveSubmissionReview(submissionId, {
        personalInfo: {
          studentId: recordForm.studentId,
          firstName: recordForm.firstName,
          lastName: recordForm.lastName,
          middleInitial: recordForm.middleInitial,
          department: recordForm.department,
          course: recordForm.course,
          year: recordForm.year,
          age: recordForm.age,
          sex: recordForm.sex,
          birthday: recordForm.birthday,
          civilStatus: recordForm.civilStatus,
          contactNumber: recordForm.contactNumber,
          address: recordForm.address,
        },
        emergencyContact: recordForm.emergencyContact,
        medicalHistory: recordForm.medicalHistory,
        allergyDetails: recordForm.allergyDetails,
        hadOperation: recordForm.hadOperation,
        operationDetails: recordForm.operationDetails,
        studentMeasurements: {
          weight: recordForm.weight,
          height: recordForm.height,
          bmi: recordForm.bmi,
        },
        staffMeasurements: staffMeasurementsPayload,
        labResults: {
          xrayDate: assessmentForm.xrayDate,
          xrayResult: assessmentForm.xrayResult,
          xrayFindings: assessmentForm.xrayFindings,
          cbcDate: assessmentForm.cbcDate,
          hemoglobin: assessmentForm.hemoglobin,
          hematocrit: assessmentForm.hematocrit,
          wbc: assessmentForm.wbc,
          plateletCount: assessmentForm.plateletCount,
          bloodType: assessmentForm.bloodType,
          glucose: assessmentForm.glucose,
          protein: assessmentForm.protein,
          urinalysisDate: assessmentForm.urinalysisDate,
          urinalysisGlucose: assessmentForm.urinalysisGlucose,
          urinalysisProtein: assessmentForm.urinalysisProtein,
        },
        clearanceInfo: {
          ...clearanceForm,
          purpose: serializeClearancePurposes(clearanceForm.purpose),
        },
        staffNotes: notesToSave,
        status: statusToSave,
      });

      const updatedSubmission: SubmissionDetails = {
        ...submission,
        firstName: recordForm.firstName,
        lastName: recordForm.lastName,
        middleInitial: recordForm.middleInitial,
        department: recordForm.department,
        course: recordForm.course,
        year: recordForm.year,
        age: recordForm.age,
        sex: recordForm.sex,
        birthday: recordForm.birthday,
        civilStatus: recordForm.civilStatus,
        contactNumber: recordForm.contactNumber,
        address: recordForm.address,
        allergyDetails: recordForm.allergyDetails,
        hadOperation: recordForm.hadOperation,
        operationDetails: recordForm.operationDetails,
        weight: recordForm.weight,
        height: recordForm.height,
        bmi: recordForm.bmi,
        emergencyContact: recordForm.emergencyContact,
        medicalHistory: recordForm.medicalHistory,
        staffMeasurements: staffMeasurementsPayload,
        labResults: {
          xrayDate: assessmentForm.xrayDate,
          xrayResult: assessmentForm.xrayResult,
          xrayFindings: assessmentForm.xrayFindings,
          cbcDate: assessmentForm.cbcDate,
          hemoglobin: assessmentForm.hemoglobin,
          hematocrit: assessmentForm.hematocrit,
          wbc: assessmentForm.wbc,
          plateletCount: assessmentForm.plateletCount,
          bloodType: assessmentForm.bloodType,
          glucose: assessmentForm.glucose,
          protein: assessmentForm.protein,
          urinalysisDate: assessmentForm.urinalysisDate,
          urinalysisGlucose: assessmentForm.urinalysisGlucose,
          urinalysisProtein: assessmentForm.urinalysisProtein,
        },
        clearanceInfo: {
          ...clearanceForm,
          purpose: serializeClearancePurposes(clearanceForm.purpose),
        },
        staffNotes: notesToSave,
        status: statusToSave,
        updatedAt: new Date().toISOString(),
      };

      setSubmission(updatedSubmission);
      setReviewStatus(statusToSave);
      await invalidateStaffWorkflowQueries(
        queryClient,
        submissionId,
        recordForm.studentId || submission.studentId,
      );
      toast.success(
        nextStatus === 'approved'
          ? 'Medical clearance approved and issued.'
          : nextStatus === 'returned'
            ? `Record returned for correction with note: "${notesToSave.substring(0, 30)}${notesToSave.length > 30 ? '...' : ''}"`
            : 'Review saved as draft.',
      );
    } catch (error) {
      console.error('Error saving review:', error);
      toast.error('Failed to save review changes');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading submission...</div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">Submission not found.</p>
        <Button onClick={() => navigate('/staff/submissions')} className="mt-4">
          Back to Submissions
        </Button>
      </div>
    );
  }

  const labUploadsCount = [submission.xrayFileUrl, submission.cbcFileUrl, submission.urinalysisFileUrl].filter(Boolean).length;
  const persistedStatus = submission.status;
  const hasUnsavedStatusChange = reviewStatus !== persistedStatus;
  const isArchiveEditMode = searchParams.get('archiveEdit') === '1';
  const isApprovedLocked = persistedStatus === 'approved' && !isArchiveEditMode;
  const isAssignedToAnotherReviewer =
    persistedStatus === 'in_review'
    && Boolean(submission.reviewedByStaffId)
    && submission.reviewedByStaffId !== currentStaffId;
  const physicalExamStatus = persistedStatus === 'approved' || persistedStatus === 'physical_exam_done'
    ? 'Completed'
    : 'Pending';
  const clearanceStatus = persistedStatus === 'approved'
    ? 'Approved'
    : persistedStatus === 'returned'
      ? 'Returned'
      : 'Pending';
  const currentReviewStepIndex = REVIEW_STEPS.indexOf(activeReviewStep);
  const previousReviewStep = currentReviewStepIndex > 0 ? REVIEW_STEPS[currentReviewStepIndex - 1] : null;
  const nextReviewStep =
    currentReviewStepIndex < REVIEW_STEPS.length - 1 ? REVIEW_STEPS[currentReviewStepIndex + 1] : null;
  const finalDecisionLabel = 'Clearance';
  const getReviewStepLabel = (step: ReviewStep) => {
    switch (step) {
      case 'record':
        return 'Student Record';
      case 'labs':
        return 'Lab Results';
      case 'assessment':
        return 'Assessment';
      case 'decision':
        return finalDecisionLabel;
      default:
        return step;
    }
  };

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <input
        ref={xrayUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          void handleLabImageSelected('xray', file);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={cbcUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          void handleLabImageSelected('cbc', file);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={urinalysisUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          void handleLabImageSelected('urinalysis', file);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={xrayCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          void handleLabImageSelected('xray', file);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={cbcCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          void handleLabImageSelected('cbc', file);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={urinalysisCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          void handleLabImageSelected('urinalysis', file);
          event.currentTarget.value = '';
        }}
      />
      <Button
        variant="ghost"
        onClick={() => navigate('/staff/submissions')}
        className="pl-0 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Submissions
      </Button>

      <PortalPageIntro
        title="Clinic Review"
        description={`Review, verify, and update the student medical record before finalizing the ${isDoctorWorkspace ? 'clinic decision' : 'clearance'}.`}
        actions={(
          <div className="rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
            <p className="font-medium text-foreground">Current recommendation</p>
            <p className="mt-1 text-muted-foreground">
              {reviewStatus === 'approved'
                ? 'Ready for clearance release'
                : reviewStatus === 'in_review'
                  ? 'Currently being reviewed by the clinic.'
                : reviewStatus === 'physical_exam_done'
                  ? 'Physical exam completed and ready for final clearance decision'
                : reviewStatus === 'returned'
                  ? 'Needs student correction'
                  : 'Still under clinical review'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className={physicalExamStatus === 'Completed' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'}>
                Physical Exam: {physicalExamStatus}
              </Badge>
              <Badge className={clearanceStatus === 'Approved' ? 'bg-green-100 text-green-800 hover:bg-green-100' : clearanceStatus === 'Returned' ? 'bg-red-100 text-red-800 hover:bg-red-100' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'}>
                Clearance: {clearanceStatus}
              </Badge>
              <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">
                Lab Source:{' '}
                {submission.labTestLocation === 'jlgh'
                  ? 'James L. Gordon Hospital'
                  : submission.labTestLocation === 'other'
                  ? submission.otherClinicName || 'External Clinic/Lab'
                  : 'Not specified'}
              </Badge>
            </div>
          </div>
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          {getStatusBadge(persistedStatus)}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {recordForm.firstName} {recordForm.lastName}
          </span>
          <span>{recordForm.studentId}</span>
          <span>{recordForm.course || 'Course not set'}</span>
        </div>
      </PortalPageIntro>

      {isAssignedToAnotherReviewer ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5">
            <p className="text-sm font-semibold text-amber-900">Another clinic staff member already claimed this review</p>
            <p className="mt-1 text-sm text-amber-800">
              This submission is already being handled in the clinic review queue. You can inspect it, but coordinate first before making edits.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-3 text-emerald-700">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Submitted</p>
                <p className="font-semibold">
                  {new Date(submission.submittedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-sky-100 p-3 text-sky-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reported conditions</p>
                <p className="font-semibold">{countVerifiedConditions(recordForm.medicalHistory)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-3 text-amber-700">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uploaded lab files</p>
                <p className="font-semibold">{labUploadsCount} of 3 received</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-rose-100 p-3 text-rose-700">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Examined by</p>
                <p className="font-semibold">{assessmentForm.examinedBy || 'Not yet recorded'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-foreground">Recommended workflow</p>
          <p className="mt-1 text-sm text-muted-foreground">
            1) Confirm student record, 2) verify labs, 3) complete assessment, 4) finalize the {isDoctorWorkspace ? 'clinic decision' : 'clearance'}.
          </p>
        </CardContent>
      </Card>

      <Tabs value={activeReviewStep} onValueChange={(value) => setActiveReviewStep(value as ReviewStep)} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 rounded-2xl border border-border/60 bg-muted/40 p-1.5 md:grid-cols-4">
          <TabsTrigger value="record" className="min-h-10 w-full rounded-xl px-3 py-2 text-xs font-semibold sm:text-sm">
            Student Record
          </TabsTrigger>
          <TabsTrigger value="labs" className="min-h-10 w-full rounded-xl px-3 py-2 text-xs font-semibold sm:text-sm">
            Lab Results
          </TabsTrigger>
          <TabsTrigger value="assessment" className="min-h-10 w-full rounded-xl px-3 py-2 text-xs font-semibold sm:text-sm">
            Assessment
          </TabsTrigger>
          <TabsTrigger value="decision" className="min-h-10 w-full rounded-xl px-3 py-2 text-xs font-semibold sm:text-sm">
            {finalDecisionLabel}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Editable Student Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border bg-muted/30 p-5">
                  {submission.photoUrl ? (
                    <img
                      src={submission.photoUrl}
                      alt="Student"
                      className="h-28 w-28 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-muted text-3xl font-semibold text-muted-foreground">
                      {recordForm.firstName?.[0]}
                      {recordForm.lastName?.[0]}
                    </div>
                  )}
                  <div className="text-center">
                    <p className="font-semibold">
                      {recordForm.firstName} {recordForm.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{recordForm.studentId}</p>
                  </div>
                </div>

                <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <Label htmlFor="studentId">Student ID</Label>
                    <Input id="studentId" value={recordForm.studentId} readOnly className="mt-2 bg-muted/40" />
                  </div>
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={recordForm.firstName}
                      onChange={(event) => updateRecordField('firstName', event.target.value)}
                      maxLength={MAX_FIRST_NAME_LENGTH}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={recordForm.lastName}
                      onChange={(event) => updateRecordField('lastName', event.target.value)}
                      maxLength={MAX_LAST_NAME_LENGTH}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="middleInitial">Middle Initial</Label>
                    <Input
                      id="middleInitial"
                      value={recordForm.middleInitial}
                      onChange={(event) => updateRecordField('middleInitial', event.target.value)}
                      maxLength={MAX_MIDDLE_INITIAL_LENGTH}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Select value={recordForm.department || 'unassigned'} onValueChange={(value) => updateRecordField('department', value === 'unassigned' ? '' : value)}>
                      <SelectTrigger id="department" className="mt-2">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Not set</SelectItem>
                        {DEPARTMENTS.map((department) => (
                          <SelectItem key={department} value={department}>
                            {department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="course">Course</Label>
                    <Select
                      value={recordForm.course || 'unassigned'}
                      onValueChange={(value) => updateRecordField('course', value === 'unassigned' ? '' : value)}
                      disabled={!recordForm.department}
                    >
                      <SelectTrigger id="course" className="mt-2">
                        <SelectValue placeholder={recordForm.department ? 'Select course' : 'Select department first'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Not set</SelectItem>
                        {getProgramOptionsForSelect(recordForm.department, recordForm.course).map((course) => (
                          <SelectItem key={course} value={course}>
                            {course}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="year">Year Level</Label>
                    <Select value={recordForm.year || 'unassigned'} onValueChange={(value) => updateRecordField('year', value === 'unassigned' ? '' : value)}>
                      <SelectTrigger id="year" className="mt-2">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Not set</SelectItem>
                        {YEAR_OPTIONS.map((year) => (
                          <SelectItem key={year} value={year}>
                            Year {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      value={recordForm.age}
                      onChange={(event) => updateRecordField('age', event.target.value)}
                      inputMode="numeric"
                      pattern="\d{2}"
                      maxLength={MAX_AGE_LENGTH}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sex">Sex</Label>
                    <Select
                      value={getSexSelectValue(recordForm.sex)}
                      onValueChange={(value) => {
                        if (value === 'unassigned') {
                          updateRecordField('sex', '');
                          return;
                        }
                        if (value === 'others') {
                          const existingOtherValue = getSexOtherInputValue(recordForm.sex);
                          updateRecordField('sex', existingOtherValue || 'others');
                          return;
                        }
                        updateRecordField('sex', value);
                      }}
                    >
                      <SelectTrigger id="sex" className="mt-2">
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Not set</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="others">Others, specify</SelectItem>
                      </SelectContent>
                    </Select>
                    {getSexSelectValue(recordForm.sex) === 'others' ? (
                      <Input
                        id="sexOthersSpecify"
                        value={getSexOtherInputValue(recordForm.sex)}
                        onChange={(event) => updateRecordField('sex', sanitizeSexOther(event.target.value))}
                        maxLength={MAX_SEX_OTHER_LENGTH}
                        placeholder="Specify (letters only)"
                        className="mt-2"
                      />
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="birthday">Birthday</Label>
                    <Input
                      id="birthday"
                      type="date"
                      value={recordForm.birthday}
                      onChange={(event) => updateRecordField('birthday', event.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="civilStatus">Civil Status</Label>
                    <Select value={recordForm.civilStatus || 'unassigned'} onValueChange={(value) => updateRecordField('civilStatus', value === 'unassigned' ? '' : value)}>
                      <SelectTrigger id="civilStatus" className="mt-2">
                        <SelectValue placeholder="Select civil status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Not set</SelectItem>
                        <SelectItem value="Single">Single</SelectItem>
                        <SelectItem value="Married">Married</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="contactNumber">Contact Number</Label>
                    <Input
                      id="contactNumber"
                      value={recordForm.contactNumber}
                      onChange={(event) => updateRecordField('contactNumber', event.target.value)}
                      inputMode="numeric"
                      placeholder="(+63) 9123456789"
                      className="mt-2"
                    />
                  </div>
                  <div className="md:col-span-2 xl:col-span-3">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={recordForm.address}
                      onChange={(event) => updateRecordField('address', event.target.value)}
                      maxLength={MAX_ADDRESS_LENGTH}
                      className="mt-2 h-24 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Medical History Verification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {MEDICAL_HISTORY_FIELDS.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(recordForm.medicalHistory[item.key])}
                        onChange={(e) => toggleMedicalHistory(item.key, e.target.checked)}
                        className="h-4 w-4 cursor-pointer appearance-auto accent-primary"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="allergyDetails">Allergy Details</Label>
                    <Textarea
                      id="allergyDetails"
                      value={recordForm.allergyDetails}
                      onChange={(event) => updateRecordField('allergyDetails', event.target.value)}
                      className="mt-2 h-24 resize-none overflow-y-auto break-words whitespace-pre-wrap"
                      maxLength={MAX_ALLERGY_DETAILS_LENGTH}
                      rows={3}
                      placeholder="Specify allergy type or trigger"
                      disabled={!recordForm.medicalHistory.allergy}
                    />
                  </div>
                  <div>
                    <Label>Operation History</Label>
                    <RadioGroup
                      value={recordForm.hadOperation}
                      onValueChange={(value) => updateRecordField('hadOperation', value as 'yes' | 'no')}
                      className="mt-3 grid grid-cols-2 gap-3"
                    >
                      <label className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                        <RadioGroupItem value="yes" id="operationYes" />
                        <span>Had operation</span>
                      </label>
                      <label className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                        <RadioGroupItem value="no" id="operationNo" />
                        <span>No operation</span>
                      </label>
                    </RadioGroup>
                    <Textarea
                      value={recordForm.operationDetails}
                      onChange={(event) => updateRecordField('operationDetails', event.target.value)}
                      className="mt-3 h-24 resize-none overflow-y-auto break-words whitespace-pre-wrap"
                      maxLength={MAX_OPERATION_HISTORY_LENGTH}
                      rows={3}
                      placeholder="Document operation details when applicable"
                      disabled={recordForm.hadOperation !== 'yes'}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div>
                    <Label htmlFor="emergencyName">Name</Label>
                    <Input
                      id="emergencyName"
                      value={recordForm.emergencyContact.name}
                      onChange={(event) => updateEmergencyContact('name', event.target.value)}
                      maxLength={MAX_EMERGENCY_NAME_LENGTH}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyRelationship">Relationship</Label>
                    <Select
                      value={recordForm.emergencyContact.relationship || 'unassigned'}
                      onValueChange={(value) => updateEmergencyContact('relationship', value === 'unassigned' ? '' : value)}
                    >
                      <SelectTrigger id="emergencyRelationship" className="mt-2">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Not set</SelectItem>
                        {EMERGENCY_CONTACT_RELATIONSHIPS.map((relationship) => (
                          <SelectItem key={relationship} value={relationship}>
                            {relationship}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone">Phone Number</Label>
                    <Input
                      id="emergencyPhone"
                      value={recordForm.emergencyContact.phone}
                      onChange={(event) => updateEmergencyContact('phone', event.target.value)}
                      inputMode="numeric"
                      placeholder="(+63) 9123456789"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyAddress">Address</Label>
                    <Textarea
                      id="emergencyAddress"
                      value={recordForm.emergencyContact.address}
                      onChange={(event) => updateEmergencyContact('address', event.target.value)}
                      className="mt-2 h-24 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                      maxLength={MAX_ADDRESS_LENGTH}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </TabsContent>

        <TabsContent value="labs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Chest X-Ray Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <SubmittedFilePreview title="Chest X-Ray" fileUrl={submission.xrayFileUrl} alt="Chest X-Ray" />
              <LabUploadActions
                title="Chest X-Ray"
                isUploading={uploadingLabFile.xray}
                onChooseImage={() => openLabImagePicker('xray', 'library')}
                onOpenCamera={() => openLabImagePicker('xray', 'camera')}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="xrayDate">Date</Label>
                  <Input
                    id="xrayDate"
                    type="date"
                    value={assessmentForm.xrayDate}
                    onChange={(event) => updateAssessmentField('xrayDate', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="xrayResult">Result</Label>
                  <Select
                    value={assessmentForm.xrayResult}
                    onValueChange={(value) => updateAssessmentField('xrayResult', value as 'normal' | 'abnormal')}
                  >
                    <SelectTrigger id="xrayResult" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="abnormal">Abnormal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="xrayFindings">Findings</Label>
                  <Textarea
                    id="xrayFindings"
                    value={assessmentForm.xrayFindings}
                    onChange={(event) => updateAssessmentField('xrayFindings', event.target.value)}
                    className="mt-2 h-24 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                    maxLength={MAX_FINDINGS_LENGTH}
                    rows={4}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Complete Blood Count (CBC)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <SubmittedFilePreview title="CBC" fileUrl={submission.cbcFileUrl} alt="CBC" />
              <LabUploadActions
                title="CBC"
                isUploading={uploadingLabFile.cbc}
                onChooseImage={() => openLabImagePicker('cbc', 'library')}
                onOpenCamera={() => openLabImagePicker('cbc', 'camera')}
              />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <Label htmlFor="cbcDate">Date</Label>
                  <Input
                    id="cbcDate"
                    type="date"
                    value={assessmentForm.cbcDate}
                    onChange={(event) => updateAssessmentField('cbcDate', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="hemoglobin">Hemoglobin (g/dL)</Label>
                  <Input
                    id="hemoglobin"
                    value={assessmentForm.hemoglobin}
                    onChange={(event) => updateAssessmentField('hemoglobin', event.target.value)}
                    inputMode="decimal"
                    placeholder="13.5"
                    maxLength={4}
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Decimal value, e.g. 13.5</p>
                </div>
                <div>
                  <Label htmlFor="hematocrit">Hematocrit (%)</Label>
                  <Input
                    id="hematocrit"
                    value={assessmentForm.hematocrit}
                    onChange={(event) => updateAssessmentField('hematocrit', event.target.value)}
                    inputMode="decimal"
                    placeholder="40.2"
                    maxLength={5}
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Decimal value, e.g. 40.2</p>
                </div>
                <div>
                  <Label htmlFor="wbc">White Blood Cell Count (x10⁹/L)</Label>
                  <Input
                    id="wbc"
                    value={assessmentForm.wbc}
                    onChange={(event) => updateAssessmentField('wbc', event.target.value)}
                    inputMode="decimal"
                    placeholder="7.8"
                    maxLength={9}
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">If value is over 1000, it auto-converts to x10⁹/L</p>
                </div>
                <div>
                  <Label htmlFor="plateletCount">Platelet Count (x10⁹/L)</Label>
                  <Input
                    id="plateletCount"
                    value={assessmentForm.plateletCount}
                    onChange={(event) => updateAssessmentField('plateletCount', event.target.value)}
                    inputMode="decimal"
                    placeholder="250"
                    maxLength={10}
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Whole number preferred; values over 1000 auto-convert</p>
                </div>
                <div>
                  <Label htmlFor="bloodType">Blood Type</Label>
                  <Select
                    value={assessmentForm.bloodType}
                    onValueChange={(value) => updateAssessmentField('bloodType', value)}
                  >
                    <SelectTrigger id="bloodType" className="mt-2">
                      <SelectValue placeholder="Select blood type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_TYPE_OPTIONS.map((bloodType) => (
                        <SelectItem key={bloodType} value={bloodType}>
                          {bloodType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Urinalysis Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <SubmittedFilePreview title="Urinalysis" fileUrl={submission.urinalysisFileUrl} alt="Urinalysis" />
              <LabUploadActions
                title="Urinalysis"
                isUploading={uploadingLabFile.urinalysis}
                onChooseImage={() => openLabImagePicker('urinalysis', 'library')}
                onOpenCamera={() => openLabImagePicker('urinalysis', 'camera')}
              />
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="urinalysisDate">Date</Label>
                  <Input
                    id="urinalysisDate"
                    type="date"
                    value={assessmentForm.urinalysisDate}
                    onChange={(event) => updateAssessmentField('urinalysisDate', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="urinalysisGlucose">Glucose</Label>
                  <Select
                    value={assessmentForm.urinalysisGlucose}
                    onValueChange={(value) => updateAssessmentField('urinalysisGlucose', value)}
                  >
                    <SelectTrigger
                      id="urinalysisGlucose"
                      className="mt-2"
                    >
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      {URINALYSIS_DIPSTICK_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="urinalysisProtein">Protein</Label>
                  <Select
                    value={assessmentForm.urinalysisProtein}
                    onValueChange={(value) => updateAssessmentField('urinalysisProtein', value)}
                  >
                    <SelectTrigger
                      id="urinalysisProtein"
                      className="mt-2"
                    >
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      {URINALYSIS_DIPSTICK_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Clinic Measurements and Verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                Compare the student-submitted values with the verified clinic examination values below before saving the review.
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <Label htmlFor="clinicBp">Verified Blood Pressure</Label>
                  <Input
                    id="clinicBp"
                    value={assessmentForm.bloodPressure}
                    onChange={(event) => updateAssessmentField('bloodPressure', event.target.value)}
                    inputMode="numeric"
                    placeholder="120/80"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="cardiacRate">Cardiac Rate (bpm)</Label>
                  <Input
                    id="cardiacRate"
                    value={assessmentForm.cardiacRate}
                    onChange={(event) => updateAssessmentField('cardiacRate', event.target.value)}
                    inputMode="decimal"
                    placeholder="72"
                    maxLength={3}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="respiratoryRate">Respiratory Rate (breaths/min)</Label>
                  <Input
                    id="respiratoryRate"
                    value={assessmentForm.respiratoryRate}
                    onChange={(event) => updateAssessmentField('respiratoryRate', event.target.value)}
                    inputMode="decimal"
                    placeholder="16"
                    maxLength={3}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="temperature">Temperature (°C)</Label>
                  <Input
                    id="temperature"
                    value={assessmentForm.temperature}
                    onChange={(event) => updateAssessmentField('temperature', event.target.value)}
                    inputMode="decimal"
                    placeholder="36.8"
                    maxLength={4}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="clinicWeight">Weight (kg)</Label>
                  <Input
                    id="clinicWeight"
                    value={assessmentForm.weight}
                    onChange={(event) => updateAssessmentField('weight', event.target.value)}
                    inputMode="decimal"
                    placeholder="60.5"
                    maxLength={5}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="clinicHeight">Height (cm)</Label>
                  <Input
                    id="clinicHeight"
                    value={assessmentForm.height}
                    onChange={(event) => updateAssessmentField('height', event.target.value)}
                    inputMode="decimal"
                    placeholder="170"
                    maxLength={5}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="clinicBmi">BMI</Label>
                  <Input id="clinicBmi" value={assessmentForm.bmi} readOnly className="mt-2 bg-muted/40" />
                </div>
                <div>
                  <Label htmlFor="visualAcuity">Visual Acuity</Label>
                  <Input
                    id="visualAcuity"
                    type="text"
                    value={assessmentForm.visualAcuity}
                    onChange={(event) => updateAssessmentField('visualAcuity', event.target.value)}
                    inputMode="text"
                    placeholder="20/20"
                    maxLength={20}
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Examples: 20/20, 20/40, 6/6, OD 20/20, OS 20/40</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Physical Examination Results</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="skin">Skin</Label>
                <Textarea
                  id="skin"
                  value={assessmentForm.skin}
                  onChange={(event) => updateAssessmentField('skin', event.target.value)}
                  className="mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="Normal / With rashes"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="heent">HEENT</Label>
                <Textarea
                  id="heent"
                  value={assessmentForm.heent}
                  onChange={(event) => updateAssessmentField('heent', event.target.value)}
                  className="mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="Normal HEENT"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="chestLungs">Chest / Lungs</Label>
                <Textarea
                  id="chestLungs"
                  value={assessmentForm.chestLungs}
                  onChange={(event) => updateAssessmentField('chestLungs', event.target.value)}
                  className="mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="Clear breath sounds"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="heart">Heart</Label>
                <Textarea
                  id="heart"
                  value={assessmentForm.heart}
                  onChange={(event) => updateAssessmentField('heart', event.target.value)}
                  className="mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="Regular rate and rhythm"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="abdomen">Abdomen</Label>
                <Textarea
                  id="abdomen"
                  value={assessmentForm.abdomen}
                  onChange={(event) => updateAssessmentField('abdomen', event.target.value)}
                  className="mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="Soft, non-tender"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="extremities">Extremities</Label>
                <Textarea
                  id="extremities"
                  value={assessmentForm.extremities}
                  onChange={(event) => updateAssessmentField('extremities', event.target.value)}
                  className="mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="No edema"
                  rows={3}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="otherFindings">Other Findings / Assessment Notes</Label>
                <Textarea
                  id="otherFindings"
                  value={assessmentForm.others}
                  onChange={(event) => updateAssessmentField('others', event.target.value)}
                  className="mt-2 h-24 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                  maxLength={MAX_PHYSICAL_EXAM_NOTES_LENGTH}
                  rows={4}
                  placeholder="Document additional observations, recommendations, or restrictions."
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="examinedBy">Examined By</Label>
                <Input
                  id="examinedBy"
                  value={assessmentForm.examinedBy}
                  onChange={(event) => updateAssessmentField('examinedBy', event.target.value)}
                  maxLength={MAX_EXAMINED_BY_LENGTH}
                  className="mt-2"
                  placeholder="Doctor name"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decision" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Clinic Notes and Medical Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="staffNotes">Clinic Notes</Label>
                <Textarea
                  id="staffNotes"
                  value={staffNotes}
                  onChange={(event) => setStaffNotes(sanitizeSafeText(event.target.value, MAX_CLINIC_NOTES_LENGTH))}
                  className="mt-2 h-24 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                  maxLength={MAX_CLINIC_NOTES_LENGTH}
                  rows={6}
                  placeholder="Add review notes, feedback to the student, follow-up instructions, or clinic observations."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                {canFinalizeClearance ? (
                <div className="xl:col-span-2">
                  <Label>Purpose *</Label>
                  <div
                    className={`mt-2 grid gap-2 rounded-lg border px-3 py-3 sm:grid-cols-3 xl:grid-cols-1 ${
                      clearanceForm.purpose.length === 0 ? 'border-red-300 bg-red-50/50' : 'border-outline-variant/50'
                    }`}
                  >
                    {CLEARANCE_PURPOSE_OPTIONS.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={clearanceForm.purpose.includes(option.value)}
                          onCheckedChange={(checked) => toggleClearancePurpose(option.value, checked === true)}
                          className="size-4"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                  {clearanceForm.purpose.length === 0 ? (
                    <p className="mt-1 text-xs text-red-600">Select at least one purpose.</p>
                  ) : null}
                </div>
                ) : null}

                {canFinalizeClearance ? (
                <div className="xl:col-span-2">
                  <Label htmlFor="controlNo">Control Number</Label>
                  <Input
                    id="controlNo"
                    value={clearanceForm.controlNo}
                    readOnly
                    className="mt-2 bg-muted/40"
                  />
                </div>
                ) : null}

                {canFinalizeClearance ? (
                <div className="xl:col-span-2">
                  <Label htmlFor="issuedDate">Issued Date</Label>
                  <Input
                    id="issuedDate"
                    type="date"
                    value={clearanceForm.issuedDate}
                    onChange={(event) => updateClearanceField('issuedDate', event.target.value)}
                    className="mt-2"
                  />
                </div>
                ) : null}

                {canFinalizeClearance ? (
                <div className="md:col-span-1 xl:col-span-3">
                  <Label htmlFor="clearanceSignatory">Clearance Signatory</Label>
                  <Select
                    value={assessmentForm.examinedBy || CLEARANCE_DOCTORS[0]}
                    onValueChange={(value) => updateAssessmentField('examinedBy', value)}
                  >
                    <SelectTrigger id="clearanceSignatory" className="mt-2">
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLEARANCE_DOCTORS.map((doctor) => (
                        <SelectItem key={doctor} value={doctor}>
                          {doctor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs text-muted-foreground">This name will appear on the medical clearance.</p>
                </div>
                ) : null}

                {canFinalizeClearance ? (
                <div className="md:col-span-1 xl:col-span-3">
                  <Label htmlFor="licenseNoSelect">License No.</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                    <Select
                      value={CLEARANCE_LICENSE_OPTIONS.some((option) => option.value === clearanceForm.licenseNo)
                        ? clearanceForm.licenseNo
                        : 'manual'}
                      onValueChange={(value) => {
                        if (value !== 'manual') {
                          updateClearanceField('licenseNo', value);
                        }
                      }}
                    >
                      <SelectTrigger id="licenseNoSelect">
                        <SelectValue placeholder="Select license no." />
                      </SelectTrigger>
                      <SelectContent>
                        {CLEARANCE_LICENSE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="licenseNo"
                      value={clearanceForm.licenseNo}
                      onChange={(event) => updateClearanceField('licenseNo', event.target.value)}
                      inputMode="numeric"
                      maxLength={15}
                      placeholder="License No."
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Numbers only, up to 15 digits.</p>
                </div>
                ) : null}

                {canFinalizeClearance ? (
                <div className="md:col-span-1 xl:col-span-3">
                  <Label>General Findings</Label>
                  <RadioGroup
                    value={clearanceForm.findingsNormal ? 'normal' : 'with-findings'}
                    onValueChange={(value) => updateClearanceField('findingsNormal', value === 'normal')}
                    className="mt-3 grid gap-3 sm:grid-cols-2"
                  >
                    <label className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                      <RadioGroupItem value="normal" id="findingsNormal" />
                      <span>Normal findings</span>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                      <RadioGroupItem value="with-findings" id="findingsAbnormal" />
                      <span>With findings / restrictions</span>
                    </label>
                  </RadioGroup>
                </div>
                ) : null}

                {canFinalizeClearance ? (
                <div className="md:col-span-1 xl:col-span-3">
                  <Label htmlFor="diagnosis">Diagnosis / Impression</Label>
                  <Textarea
                    id="diagnosis"
                    value={clearanceForm.diagnosis}
                    onChange={(event) => updateClearanceField('diagnosis', event.target.value)}
                    className="mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                    maxLength={MAX_CLEARANCE_DIAGNOSIS_LENGTH}
                    rows={4}
                  />
                </div>
                ) : null}

                {canFinalizeClearance ? (
                <div className="md:col-span-1 xl:col-span-3">
                  <Label htmlFor="remarks">Clearance Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={clearanceForm.remarks}
                    onChange={(event) => updateClearanceField('remarks', event.target.value)}
                    className="mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                    maxLength={MAX_CLEARANCE_REMARKS_LENGTH}
                    rows={4}
                    placeholder="State whether the student is fit, fit with recommendations, or needs follow-up."
                  />
                </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">
              Step {currentReviewStepIndex + 1} of {REVIEW_STEPS.length}: {getReviewStepLabel(activeReviewStep)}
            </p>
            <p className="text-sm text-muted-foreground">
              {nextReviewStep
                ? `Continue to ${getReviewStepLabel(nextReviewStep)} when this section is complete.`
                : `You are on the final review step. Finalize the ${isDoctorWorkspace ? 'clinic decision' : 'clearance'} below.`}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => previousReviewStep && setActiveReviewStep(previousReviewStep)}
              disabled={!previousReviewStep}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            {nextReviewStep ? (
              <Button type="button" onClick={() => setActiveReviewStep(nextReviewStep)}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {isDoctorWorkspace ? 'Finalize the clinic review' : 'Finalize the clearance'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isApprovedLocked
                ? 'This submission is already approved. Actions are locked to prevent accidental changes.'
                : persistedStatus === 'approved' && isArchiveEditMode
                  ? 'Archive edit mode is enabled. Save changes keeps this record approved while updating corrected details or replacement files.'
                : canFinalizeClearance
                  ? `Save draft edits at any time, mark the record pending when needed, or ${isDoctorWorkspace ? 'mark it cleared' : 'mark the record cleared'} once everything is complete.`
                  : 'Save draft edits at any time or mark the record pending when updates are needed.'}
            </p>
          </div>

          {!isApprovedLocked ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              variant="outline"
              onClick={() => void persistReview(isArchiveEditMode ? 'approved' : undefined)}
              disabled={saving}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Review'}
            </Button>
            {!isArchiveEditMode ? (
            <Button variant="destructive" onClick={() => {
              setReturnReason(staffNotes);
              setShowReturnDialog(true);
            }} disabled={saving}>
              Pending
            </Button>
            ) : null}
            {canFinalizeClearance && !isArchiveEditMode ? (
              <Button
                onClick={() => void persistReview('approved')}
                disabled={saving}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Cleared
              </Button>
            ) : null}
          </div>
          ) : (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved - Locked</Badge>
          )}
        </CardContent>
      </Card>

      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pending</DialogTitle>
            <DialogDescription>
              Provide clear instructions or reasons for marking this medical record as pending. The student will see this note on their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="returnReason" className="mb-2 block">Correction Message</Label>
            <Textarea
              id="returnReason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Please re-upload a clearer copy of your X-Ray result or complete the missing fields."
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setStaffNotes(returnReason);
                void persistReview('returned', returnReason);
                setShowReturnDialog(false);
              }}
              disabled={!returnReason.trim() || saving}
            >
              {saving ? 'Saving Pending...' : 'Confirm Pending'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
