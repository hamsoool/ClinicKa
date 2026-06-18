import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Loader2,
  Save,
  ScanText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import FilePickerButton from '../../components/file-picker-button';
import { StudentProfileFormCard } from '../../components/student-profile-form-card';

import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { cn } from '../../components/ui/utils';
import {
  extractCbcFields,
  extractChestXrayFindings,
  extractUrinalysisFields,
  getStaffSignature,
  isDoctorPosition,
  saveSubmissionReview,
  updateSubmissionStatus,
  uploadFile,
  uploadStaffSignature,
  type CbcOcrExtraction,
  type ChestXrayOcrExtraction,
  type StaffSignatureAsset,
  type UrinalysisOcrExtraction,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { STAFF_REVIEW_MUTATION_KEY } from '../../lib/staff-clearance';
import type { MedicalHistory, SubmissionRecord } from '../../lib/record-types';
import { SubmittedFilePreview } from './record-review/submitted-file-preview';
import {
  invalidateStaffWorkflowQueries,
  staffSubmissionDetailQueryKey,
  useStaffSubmissionDetailQuery,
} from './staff-workflow-query';
import type { LabUploadType } from '../../lib/media-upload-types';
import {
  EMERGENCY_CONTACT_RELATIONSHIPS,
  formatPhilippinePhoneInput,
  isValidPhilippinePhoneNumber,
  normalizeProgramForDepartment,
  resolveDepartmentValue,
} from '../student/medical-form/constants';
import { getSubmissionSlotLabel } from '../../lib/academic-year';
import { getYearLevelLabel } from '../../lib/student-year';

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
type LabUploadSource = 'file' | 'camera';
const CLINIC_INTERNAL_LAB_SOURCE = 'James L. Gordon Memorial Hospital';
const CLINIC_INTERNAL_LAB_SOURCE_ALIASES = [
  CLINIC_INTERNAL_LAB_SOURCE,
  'James L. Gordon Hospital',
];

function isClinicManagedLabSource(source?: string | null) {
  const normalizedSource = String(source || '').trim().toLowerCase();
  return CLINIC_INTERNAL_LAB_SOURCE_ALIASES.some((value) => value.toLowerCase() === normalizedSource);
}

type XrayOcrState = {
  confidence?: number;
  fieldsDetected?: number;
  message: string;
  source?: ChestXrayOcrExtraction['source'];
  status: 'idle' | 'processing' | 'success' | 'warning' | 'error';
};

type CbcOcrState = {
  fieldsDetected?: number;
  message: string;
  source?: CbcOcrExtraction['source'];
  status: XrayOcrState['status'];
};

type UrinalysisOcrState = {
  fieldsDetected?: number;
  message: string;
  source?: UrinalysisOcrExtraction['source'];
  status: XrayOcrState['status'];
};

type OcrRunOutcome = 'filled' | 'filled_with_warning' | 'warning' | 'error' | 'skipped';
type UpdatedAssessmentFields = Partial<Record<keyof AssessmentForm, boolean>>;
type PreparedReviewSubmission = {
  statusToSave: ReviewStatus;
  notesToSave: string;
  reviewPayload: any;
  updatedSubmission: SubmissionDetails;
  studentId: string;
};

type PrepareReviewSubmissionOptions = {
  issuedDateOverride?: string;
};

type RecordForm = {
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  department: string;
  course: string;
  yearLevel: string;
  recordSlot: string;
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

type PhysicalExamRequiredField =
  | 'skin'
  | 'heent'
  | 'chestLungs'
  | 'heart'
  | 'abdomen'
  | 'extremities';
type AssessmentValidationErrors = Partial<Record<keyof AssessmentForm, string>>;

type ClearanceForm = {
  findingsNormal: boolean;
  diagnosis: string;
  remarks: string;
  purpose: ClearancePurpose[];
  issuedDate: string;
  licenseNo: string;
  signatoryName: string;
};

type ClearancePurpose = 'enrolment' | 'ojt' | 'rle';

const CLEARANCE_PURPOSE_OPTIONS: Array<{ value: ClearancePurpose; label: string }> = [
  { value: 'enrolment', label: 'Enrollment' },
  { value: 'ojt', label: 'OJT' },
  { value: 'rle', label: 'RLE' },
];

function isClearancePurpose(value: string): value is ClearancePurpose {
  return CLEARANCE_PURPOSE_OPTIONS.some((option) => option.value === value);
}

const DEFAULT_LICENSE_NO = '0084558';
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

const LAB_RESULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const LAB_RESULT_MAX_FILE_SIZE_LABEL = '5 MB';
const LAB_RESULT_ACCEPT_ATTRIBUTE = '.pdf,.png,.jpg,.jpeg,.heic,.heif,.webp,.avif,.gif,.bmp,.tif,.tiff,image/*,application/pdf';
const LAB_RESULT_ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'heic', 'heif', 'webp', 'avif', 'gif', 'bmp', 'tif', 'tiff'];
const STAFF_SIGNATURE_ACCEPT_ATTRIBUTE = 'image/*,.png,.jpg,.jpeg,.heic,.heif,.webp';
const STAFF_SIGNATURE_ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'heic', 'heif', 'webp']);
const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const URINALYSIS_DIPSTICK_OPTIONS = ['Negative', 'Trace', '1+', '2+', '3+', '4+'] as const;
const VISUAL_ACUITY_OPTIONS = [
  '20/20',
  '20/25',
  '20/30',
  '20/40',
  '20/50',
  '20/70',
  '20/100',
  '20/200',
  '20/400',
  'Other / Blind',
] as const;
type VisualAcuityOption = (typeof VISUAL_ACUITY_OPTIONS)[number];
const BLOOD_PRESSURE_PATTERN = /^\d{2,3}\/\d{2,3}$/;
const MIN_SYSTOLIC_BLOOD_PRESSURE = 20;
const MAX_SYSTOLIC_BLOOD_PRESSURE = 300;
const MIN_DIASTOLIC_BLOOD_PRESSURE = 20;
const MAX_DIASTOLIC_BLOOD_PRESSURE = 200;
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
const MAX_FINDINGS_LENGTH = 300;
const MAX_PHYSICAL_EXAM_FIELD_LENGTH = 100;
const MAX_PHYSICAL_EXAM_NOTES_LENGTH = 150;
const MAX_EXAMINED_BY_LENGTH = 40;
const MAX_CLINIC_NOTES_LENGTH = 100;
const MAX_CLEARANCE_DIAGNOSIS_LENGTH = 50;
const MAX_CLEARANCE_REMARKS_LENGTH = 50;
const SEX_BASE_OPTIONS = ['male', 'female'] as const;
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'] as const;
const MEDICAL_RECORD_DATE_RANGE_MONTHS = 6;
const UPDATED_FIELD_CLASS = 'border-green-300 bg-green-50 text-green-950 focus-visible:border-green-500 focus-visible:ring-green-500/20';
const INVALID_FIELD_CLASS = 'border-red-300 bg-red-50/50 focus-visible:border-red-500 focus-visible:ring-red-500/20';
const PHYSICAL_EXAM_REQUIRED_FIELDS: PhysicalExamRequiredField[] = [
  'skin',
  'heent',
  'chestLungs',
  'heart',
  'abdomen',
  'extremities',
];
const PHYSICAL_EXAM_FIELD_LABELS: Record<PhysicalExamRequiredField, string> = {
  skin: 'Skin',
  heent: 'HEENT',
  chestLungs: 'Chest / Lungs',
  heart: 'Heart',
  abdomen: 'Abdomen',
  extremities: 'Extremities',
};
const HIGHLIGHTED_ASSESSMENT_FIELDS: Array<keyof AssessmentForm> = [
  'xrayDate',
  'xrayResult',
  'xrayFindings',
  'cbcDate',
  'hemoglobin',
  'hematocrit',
  'wbc',
  'plateletCount',
  'bloodType',
  'urinalysisDate',
  'urinalysisGlucose',
  'urinalysisProtein',
];

type ReviewStep = (typeof REVIEW_STEPS)[number];
type ReviewAction = 'save' | 'pending' | 'cleared';

type LabUploadActionsProps = {
  title: string;
  isUploading: boolean;
  uploadSource?: LabUploadSource | null;
  onChooseFile: (file: File | null) => void;
  onOpenCamera: (file: File | null) => void;
};

function LabUploadActions({
  title,
  isUploading,
  uploadSource,
  onChooseFile,
  onOpenCamera,
}: LabUploadActionsProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const isFileUploading = isUploading && uploadSource === 'file';
  const isCameraUploading = isUploading && uploadSource === 'camera';

  return (
    <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
      <div className="rounded-[18px] border border-dashed border-outline-variant/50 bg-surface-container-low px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-on-surface">Add or replace {title} file</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={isUploading}
              onClick={() => setIsUploadDialogOpen(true)}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </div>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload {title} file</DialogTitle>
          <DialogDescription>Choose whether to upload an existing file or capture a new one with the camera.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FilePickerButton
            accept={LAB_RESULT_ACCEPT_ATTRIBUTE}
            ariaLabel={`Upload ${title} PDF or image`}
            className="h-auto min-h-24 w-full flex-col gap-2 px-4 py-4 text-center"
            disabled={isCameraUploading}
            loading={isFileUploading}
            onFileSelected={(file) => {
              if (file) setIsUploadDialogOpen(false);
              onChooseFile(file);
            }}
          >
            <FileUp className="h-5 w-5" />
            <span>Existing File</span>
          </FilePickerButton>
          <FilePickerButton
            accept="image/*,.heic,.heif"
            ariaLabel={`Capture ${title} image`}
            capture="environment"
            className="h-auto min-h-24 w-full flex-col gap-2 px-4 py-4 text-center"
            disabled={isFileUploading}
            loading={isCameraUploading}
            onFileSelected={(file) => {
              if (file) setIsUploadDialogOpen(false);
              onOpenCamera(file);
            }}
          >
            <Camera className="h-5 w-5" />
            <span>Use Camera</span>
          </FilePickerButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getOcrStatusClass(status: XrayOcrState['status']) {
  if (status === 'success') return 'border-green-200 bg-green-50 text-green-800';
  if (status === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (status === 'error') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-blue-200 bg-blue-50 text-blue-800';
}

function buildEmptyStaffSignature(): StaffSignatureAsset {
  return {
    signatureUrl: null,
    signatureFileName: null,
  };
}

function getFileExtension(file?: File | null) {
  const fileName = String(file?.name || '');
  return fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
}

function isAllowedSignatureImage(file?: File | null) {
  if (!file) return false;
  const mimeType = String(file.type || '').toLowerCase();
  return mimeType.startsWith('image/') || STAFF_SIGNATURE_ALLOWED_EXTENSIONS.has(getFileExtension(file));
}

function withCacheBust(url: string | null | undefined) {
  const value = String(url || '').trim();
  if (!value) return null;
  const separator = value.includes('?') ? '&' : '?';
  return `${value}${separator}t=${Date.now()}`;
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

  if (!sanitized.includes('/')) {
    const digitsOnly = sanitized.replace(/\D/g, '');

    if (digitsOnly.length <= 3) {
      return digitsOnly.slice(0, maxLeftDigits);
    }

    const candidateLeftLengths = [3, 2].filter((candidate) => candidate <= maxLeftDigits);
    for (const candidateLeftLength of candidateLeftLengths) {
      const candidateRightLength = digitsOnly.length - candidateLeftLength;
      if (candidateRightLength < 2 || candidateRightLength > maxRightDigits) {
        continue;
      }

      const candidateLeft = digitsOnly.slice(0, candidateLeftLength);
      const candidateRight = digitsOnly.slice(candidateLeftLength, candidateLeftLength + candidateRightLength);
      const leftValue = Number(candidateLeft);
      const rightValue = Number(candidateRight);
      const isValidSystolic =
        Number.isFinite(leftValue)
        && leftValue >= MIN_SYSTOLIC_BLOOD_PRESSURE
        && leftValue <= MAX_SYSTOLIC_BLOOD_PRESSURE;
      const isValidDiastolic =
        Number.isFinite(rightValue)
        && rightValue >= MIN_DIASTOLIC_BLOOD_PRESSURE
        && rightValue <= MAX_DIASTOLIC_BLOOD_PRESSURE;

      if (isValidSystolic && isValidDiastolic) {
        return `${candidateLeft}/${candidateRight}`;
      }
    }

    return digitsOnly.slice(0, maxLeftDigits + maxRightDigits);
  }
  return `${normalizedLeft}/${normalizedRight}`;
}

function isValidBloodPressure(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return true;
  if (!BLOOD_PRESSURE_PATTERN.test(trimmedValue)) return false;

  const [systolicText = '', diastolicText = ''] = trimmedValue.split('/');
  const systolicValue = Number(systolicText);
  const diastolicValue = Number(diastolicText);

  return (
    Number.isFinite(systolicValue)
    && Number.isFinite(diastolicValue)
    && systolicValue >= MIN_SYSTOLIC_BLOOD_PRESSURE
    && systolicValue <= MAX_SYSTOLIC_BLOOD_PRESSURE
    && diastolicValue >= MIN_DIASTOLIC_BLOOD_PRESSURE
    && diastolicValue <= MAX_DIASTOLIC_BLOOD_PRESSURE
  );
}

function isValidVisualAcuity(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return true;
  if (VISUAL_ACUITY_OPTIONS.includes(trimmedValue as VisualAcuityOption)) return true;
  if (VISUAL_ACUITY_PATTERN.test(trimmedValue)) return true;
  return /^(OD|OS)\s\d{1,2}\/\d{1,3}$/i.test(trimmedValue);
}

function normalizeVisualAcuitySelectValue(value?: string | null): '' | VisualAcuityOption {
  const sanitizedValue = sanitizeVisualAcuityText(value || '').trim();
  if (!sanitizedValue) return '';
  if (VISUAL_ACUITY_OPTIONS.includes(sanitizedValue as VisualAcuityOption)) {
    return sanitizedValue as VisualAcuityOption;
  }
  return 'Other / Blind';
}

function isVisualAcuitySelectValue(value: string): value is '' | VisualAcuityOption {
  return value === '' || VISUAL_ACUITY_OPTIONS.includes(value as VisualAcuityOption);
}

function formatDateInputValue(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function shiftCalendarMonths(date: Date, amount: number) {
  const shifted = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const lastDayOfShiftedMonth = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(date.getDate(), lastDayOfShiftedMonth));
  return shifted;
}

function getTodayDateInputValue() {
  return formatDateInputValue(new Date());
}

function getMedicalRecordDateBounds(referenceDate = new Date()) {
  return {
    min: formatDateInputValue(shiftCalendarMonths(referenceDate, -MEDICAL_RECORD_DATE_RANGE_MONTHS)),
    max: formatDateInputValue(referenceDate),
  };
}

function isMedicalRecordDateInRange(value?: string | null, referenceDate = new Date()) {
  const normalized = normalizeDateInputValue(value);
  if (!normalized) return false;

  const { min, max } = getMedicalRecordDateBounds(referenceDate);
  return normalized >= min && normalized <= max;
}

function getMedicalRecordDateValidationMessage(label: string, value?: string | null, referenceDate = new Date()) {
  const normalized = normalizeDateInputValue(value);
  if (!normalized) return `${label} must be a valid date.`;

  const { min, max } = getMedicalRecordDateBounds(referenceDate);
  if (normalized > max) return `${label} cannot be in the future.`;
  if (normalized < min) return `${label} must be within the past ${MEDICAL_RECORD_DATE_RANGE_MONTHS} months.`;
  return '';
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

function isPhysicalExamRequiredField(field: keyof AssessmentForm): field is PhysicalExamRequiredField {
  return PHYSICAL_EXAM_REQUIRED_FIELDS.includes(field as PhysicalExamRequiredField);
}

function getPhysicalExamFieldValidationError(field: PhysicalExamRequiredField, value: string) {
  const normalizedValue = sanitizeSafeText(value, MAX_PHYSICAL_EXAM_FIELD_LENGTH).trim();
  if (!normalizedValue) return `${PHYSICAL_EXAM_FIELD_LABELS[field]} is required.`;
  return '';
}

function validatePhysicalExamFields(form: AssessmentForm): AssessmentValidationErrors {
  return PHYSICAL_EXAM_REQUIRED_FIELDS.reduce<AssessmentValidationErrors>((errors, field) => {
    const message = getPhysicalExamFieldValidationError(field, form[field]);
    if (message) errors[field] = message;
    return errors;
  }, {});
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

function normalizeSingleClearancePurpose(value?: string | string[] | null): ClearancePurpose[] {
  return normalizeClearancePurposes(value).slice(0, 1);
}

function serializeClearancePurposes(value: ClearancePurpose[]) {
  return value.join(',');
}

function sanitizeLicenseNo(value: string) {
  return String(value || '').replace(/\D/g, '').slice(0, 15);
}

function normalizeSignatoryNameForMatch(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b(m\.?\s*d\.?|doctor|dr\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchClearanceSignatoryName(value?: string | null) {
  const normalized = normalizeSignatoryNameForMatch(value);
  return CLEARANCE_DOCTORS.find((doctor) => normalizeSignatoryNameForMatch(doctor) === normalized) || '';
}

function normalizeClearanceSignatoryName(value?: string | null) {
  return matchClearanceSignatoryName(value) || CLEARANCE_DOCTORS[0];
}

function isClearanceSignatoryName(value?: string | null) {
  return Boolean(matchClearanceSignatoryName(value));
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
    yearLevel: submission?.studentYearLevel || '',
    recordSlot: submission?.year || '',
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
  const fallbackLabDate = getTodayDateInputValue();
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
    visualAcuity: normalizeVisualAcuitySelectValue(submission?.staffMeasurements?.visualAcuity),
    skin: submission?.staffMeasurements?.skin || '',
    heent: submission?.staffMeasurements?.heent || '',
    chestLungs: submission?.staffMeasurements?.chestLungs || '',
    heart: submission?.staffMeasurements?.heart || '',
    abdomen: submission?.staffMeasurements?.abdomen || '',
    extremities: submission?.staffMeasurements?.extremities || '',
    others: submission?.staffMeasurements?.others || '',
    examinedBy: sanitizeSafeText(submission?.staffMeasurements?.examinedBy || '', MAX_EXAMINED_BY_LENGTH),
    xrayDate: normalizeDateInputValue(submission?.labResults?.xrayDate) || fallbackLabDate,
    xrayResult: submission?.labResults?.xrayResult || 'normal',
    xrayFindings: submission?.labResults?.xrayFindings || '',
    cbcDate: normalizeDateInputValue(submission?.labResults?.cbcDate) || fallbackLabDate,
    hemoglobin: submission?.labResults?.hemoglobin || '',
    hematocrit: submission?.labResults?.hematocrit || '',
    wbc: submission?.labResults?.wbc || '',
    plateletCount: submission?.labResults?.plateletCount || '',
    bloodType: submission?.labResults?.bloodType || '',
    glucose: submission?.labResults?.glucose || submission?.labResults?.urinalysisGlucose || '',
    protein: submission?.labResults?.protein || submission?.labResults?.urinalysisProtein || '',
    urinalysisDate: normalizeDateInputValue(submission?.labResults?.urinalysisDate) || fallbackLabDate,
    urinalysisGlucose: submission?.labResults?.urinalysisGlucose || submission?.labResults?.glucose || '',
    urinalysisProtein: submission?.labResults?.urinalysisProtein || submission?.labResults?.protein || '',
  };
}

function createClearanceForm(submission?: SubmissionDetails | null): ClearanceForm {
  const fallbackIssuedDate = getTodayDateInputValue();
  const savedSignatory = matchClearanceSignatoryName(submission?.clearanceInfo?.signatoryName);
  const legacySignatory = matchClearanceSignatoryName(submission?.staffMeasurements?.examinedBy);
  return {
    findingsNormal: submission?.clearanceInfo?.findingsNormal ?? true,
    diagnosis: sanitizeSafeText(submission?.clearanceInfo?.diagnosis || '', MAX_CLEARANCE_DIAGNOSIS_LENGTH),
    remarks: sanitizeSafeText(submission?.clearanceInfo?.remarks || '', MAX_CLEARANCE_REMARKS_LENGTH),
    purpose: normalizeSingleClearancePurpose(submission?.clearanceInfo?.purpose),
    issuedDate: normalizeDateInputValue(submission?.clearanceInfo?.issuedDate) || fallbackIssuedDate,
    licenseNo: sanitizeLicenseNo(submission?.clearanceInfo?.licenseNo || DEFAULT_LICENSE_NO),
    signatoryName: savedSignatory || legacySignatory || CLEARANCE_DOCTORS[0],
  };
}

function getStatusBadge(status: ReviewStatus) {
  switch (status) {
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
    case 'in_review':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Review</Badge>;
    case 'physical_exam_done':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Physical Exam Done</Badge>;
    case 'approved':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Issued Medical Certificate</Badge>;
    case 'returned':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Returned</Badge>;
    case 'resubmitted':
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Resubmitted</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

function StaffRecordReviewSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto w-full max-w-[100rem] space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-9 w-72 bg-primary/15" />
        <Skeleton className="h-4 w-full max-w-2xl bg-surface-container-high" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.8fr)]">
        <Card className="border-outline-variant/30">
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 w-48 bg-surface-container-high" />
            <Skeleton className="h-4 w-64 bg-surface-container" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-20 bg-surface-container-high" />
                  <Skeleton className="h-10 w-full bg-surface-container" />
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-28 bg-surface-container-high" />
                  <Skeleton className="h-24 w-full bg-surface-container" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/30">
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 w-32 bg-surface-container-high" />
            <Skeleton className="h-4 w-40 bg-surface-container" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full bg-surface-container" />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-outline-variant/30">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-28 rounded-full bg-surface-container-high" />
            ))}
          </div>
          <Skeleton className="h-4 w-56 bg-surface-container" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-4">
              <Skeleton className="h-56 w-full rounded-[18px] bg-surface-container" />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-3 w-24 bg-surface-container-high" />
                    <Skeleton className="h-10 w-full bg-surface-container" />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-32 w-full rounded-[18px] bg-surface-container" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <span className="sr-only">Loading submission...</span>
    </div>
  );
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
  const [recordForm, setRecordForm] = useState<RecordForm>(() => createRecordForm());
  const [assessmentForm, setAssessmentForm] = useState<AssessmentForm>(() => createAssessmentForm());
  const [clearanceForm, setClearanceForm] = useState<ClearanceForm>(() => createClearanceForm());
  const [saveLicenseNoChecked, setSaveLicenseNoChecked] = useState(() => {
    if (typeof window === 'undefined') return false;
    const staffId = String(me?.staff?.id || '').trim();
    if (!staffId) return false;
    return window.localStorage.getItem(`gc-save-license-no-checked:${staffId}`) === 'true';
  });

  useEffect(() => {
    if (!currentStaffId) return;
    const isChecked = window.localStorage.getItem(`gc-save-license-no-checked:${currentStaffId}`) === 'true';
    setSaveLicenseNoChecked(isChecked);
    if (isChecked) {
      const savedLicense = window.localStorage.getItem(`gc-saved-license-no:${currentStaffId}`);
      if (savedLicense && (!clearanceForm.licenseNo || clearanceForm.licenseNo === DEFAULT_LICENSE_NO)) {
        setClearanceForm((prev) => ({
          ...prev,
          licenseNo: savedLicense,
        }));
      }
    }
  }, [currentStaffId]);

  const handleSaveLicenseNoChange = (checked: boolean) => {
    setSaveLicenseNoChecked(checked);
    if (currentStaffId) {
      window.localStorage.setItem(`gc-save-license-no-checked:${currentStaffId}`, String(checked));
      if (checked) {
        window.localStorage.setItem(`gc-saved-license-no:${currentStaffId}`, clearanceForm.licenseNo);
      } else {
        window.localStorage.removeItem(`gc-saved-license-no:${currentStaffId}`);
      }
    }
  };
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
  const [uploadingLabSource, setUploadingLabSource] = useState<Record<LabUploadType, LabUploadSource | null>>({
    xray: null,
    cbc: null,
    urinalysis: null,
  });
  const [showAutoFillReplaceDialog, setShowAutoFillReplaceDialog] = useState(false);
  const [xrayOcrState, setXrayOcrState] = useState<XrayOcrState>({
    message: '',
    status: 'idle',
  });
  const [cbcOcrState, setCbcOcrState] = useState<CbcOcrState>({
    message: '',
    status: 'idle',
  });
  const [urinalysisOcrState, setUrinalysisOcrState] = useState<UrinalysisOcrState>({
    message: '',
    status: 'idle',
  });
  const [updatedAssessmentFields, setUpdatedAssessmentFields] = useState<UpdatedAssessmentFields>({});
  const [assessmentValidationErrors, setAssessmentValidationErrors] = useState<AssessmentValidationErrors>({});
  const [savingAction, setSavingAction] = useState<ReviewAction | null>(null);
  const [loadingSignature, setLoadingSignature] = useState(true);
  const [staffSignature, setStaffSignature] = useState<StaffSignatureAsset>(buildEmptyStaffSignature);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const assessmentFormRef = useRef<AssessmentForm>(createAssessmentForm());
  const inReviewTransitionRef = useRef<string | null>(null);
  const hydratedSubmissionIdRef = useRef<string | null>(null);
  const lastXrayOcrFileRef = useRef<string | null>(null);
  const lastCbcOcrFileRef = useRef<string | null>(null);
  const lastUrinalysisOcrFileRef = useRef<string | null>(null);
  const xrayOcrRunRef = useRef(0);
  const cbcOcrRunRef = useRef(0);
  const urinalysisOcrRunRef = useRef(0);
  const rawDefaultSignatoryName = [
    me?.staff?.first_name || me?.profile.first_name || '',
    me?.staff?.last_name || me?.profile.last_name || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  const isDoctor = isDoctorPosition(me?.staff?.position);
  const defaultSignatoryName = isDoctor && rawDefaultSignatoryName && !rawDefaultSignatoryName.startsWith('Dr. ')
    ? `Dr. ${rawDefaultSignatoryName}`
    : rawDefaultSignatoryName;
  const currentStaffSignatureUrl = signaturePreviewUrl || staffSignature.signatureUrl || null;
  const {
    data: submissionData,
    isLoading: loading,
    isError,
  } = useStaffSubmissionDetailQuery(submissionId);

  const prepareReviewSubmission = (
    nextStatus?: ReviewStatus,
    customNotes?: string,
    options: PrepareReviewSubmissionOptions = {},
  ): PreparedReviewSubmission | null => {
    if (!submissionId || !submission) return null;
    if (!/^\d{2}$/.test(recordForm.age)) {
      toast.error('Age must be exactly 2 digits.');
      return null;
    }
    if (recordForm.contactNumber && !isValidPhilippinePhoneNumber(recordForm.contactNumber)) {
      toast.error('Contact number must be exactly 11 digits starting with 09.');
      return null;
    }
    if (recordForm.emergencyContact.phone && !isValidPhilippinePhoneNumber(recordForm.emergencyContact.phone)) {
      toast.error('Emergency contact phone must be exactly 11 digits starting with 09.');
      return null;
    }

    const statusToSave = nextStatus || reviewStatus;
    if (statusToSave !== 'returned') {
      const nextAssessmentValidationErrors = validatePhysicalExamFields(assessmentForm);
      if (Object.keys(nextAssessmentValidationErrors).length > 0) {
        setAssessmentValidationErrors(nextAssessmentValidationErrors);
        setActiveReviewStep('assessment');
        toast.error('Complete the required physical examination fields.');
        return null;
      }
      setAssessmentValidationErrors({});
    }
    if (canFinalizeClearance && statusToSave === 'approved' && clearanceForm.purpose.length === 0) {
      toast.error('Select a clearance purpose.');
      return null;
    }
    if (canFinalizeClearance && statusToSave === 'approved' && !clearanceForm.licenseNo.trim()) {
      toast.error('License number is required before clearing this record.');
      return null;
    }

    const resolvedIssuedDate = options.issuedDateOverride || clearanceForm.issuedDate;

    if (statusToSave !== 'returned') {
      const medicalRecordDateChecks: Array<[string, string]> = [
        ['Chest X-Ray date', assessmentForm.xrayDate],
        ['CBC date', assessmentForm.cbcDate],
        ['Urinalysis date', assessmentForm.urinalysisDate],
      ];

      if (canFinalizeClearance) {
        medicalRecordDateChecks.push(['Issued date', resolvedIssuedDate]);
      }

      for (const [label, value] of medicalRecordDateChecks) {
        const validationMessage = getMedicalRecordDateValidationMessage(label, value);
        if (validationMessage) {
          toast.error(validationMessage);
          return null;
        }
      }
    }

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
      examinedBySignatureUrl: currentStaffSignatureUrl || submission.staffMeasurements?.examinedBySignatureUrl || '',
      staff_notes: notesToSave,
    };
    const clearanceInfoPayload = {
      ...clearanceForm,
      issuedDate: resolvedIssuedDate,
      signatoryName: normalizeClearanceSignatoryName(clearanceForm.signatoryName),
      purpose: serializeClearancePurposes(clearanceForm.purpose),
    };

    return {
      statusToSave,
      notesToSave,
      studentId: recordForm.studentId || submission.studentId,
      reviewPayload: {
        personalInfo: {
          studentId: recordForm.studentId,
          firstName: recordForm.firstName,
          lastName: recordForm.lastName,
          middleInitial: recordForm.middleInitial,
          department: recordForm.department,
          course: recordForm.course,
          year: recordForm.recordSlot,
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
        clearanceInfo: clearanceInfoPayload,
        staffNotes: notesToSave,
        status: statusToSave,
      },
      updatedSubmission: {
        ...submission,
        firstName: recordForm.firstName,
        lastName: recordForm.lastName,
        middleInitial: recordForm.middleInitial,
        department: recordForm.department,
        course: recordForm.course,
        year: recordForm.recordSlot,
        studentYearLevel: recordForm.yearLevel,
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
        staffMeasurements: {
          ...staffMeasurementsPayload,
          examinedBySignatureUrl: currentStaffSignatureUrl || submission.staffMeasurements?.examinedBySignatureUrl,
        },
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
        clearanceInfo: clearanceInfoPayload,
        staffNotes: notesToSave,
        status: statusToSave,
        updatedAt: new Date().toISOString(),
      },
    };
  };

  const backgroundReviewMutation = useMutation({
    mutationKey: [...STAFF_REVIEW_MUTATION_KEY, submissionId || 'unknown'],
    mutationFn: async ({ prepared }: { prepared: PreparedReviewSubmission; action: ReviewAction }) => {
      if (!submissionId) {
        throw new Error('Submission ID is required to update this record.');
      }

      await saveSubmissionReview(submissionId, prepared.reviewPayload);
      return prepared;
    },
    onSuccess: async (prepared, variables) => {
      setSubmission(prepared.updatedSubmission);
      setReviewStatus(prepared.statusToSave);
      await invalidateStaffWorkflowQueries(queryClient, submissionId, prepared.studentId);
      if (variables.action === 'cleared') {
        toast.success('Medical clearance approved and issued.');
        return;
      }
      if (variables.action === 'pending') {
        toast.success(
          `Record declined with note: "${prepared.notesToSave.substring(0, 30)}${prepared.notesToSave.length > 30 ? '...' : ''}"`,
        );
        return;
      }
      toast.success('Review saved as draft.');
    },
    onError: (error, variables) => {
      console.error('Error saving review:', error);
      toast.error(
        variables.action === 'cleared'
          ? 'Failed to clear this medical record.'
          : variables.action === 'pending'
            ? 'Failed to decline this record.'
            : 'Failed to save review changes.',
      );
    },
    onSettled: () => {
      setSavingAction(null);
    },
  });

  useEffect(() => {
    if (!me?.profile?.id) {
      setStaffSignature(buildEmptyStaffSignature());
      setLoadingSignature(false);
      return;
    }

    let active = true;
    setLoadingSignature(true);

    const loadSignature = async () => {
      try {
        const signature = await getStaffSignature();
        if (active) {
          setStaffSignature(signature);
        }
      } catch {
        if (active) {
          setStaffSignature(buildEmptyStaffSignature());
        }
      } finally {
        if (active) {
          setLoadingSignature(false);
        }
      }
    };

    void loadSignature();

    return () => {
      active = false;
    };
  }, [me?.profile?.id]);

  useEffect(() => {
    if (!signatureFile) {
      setSignaturePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(signatureFile);
    setSignaturePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [signatureFile]);

  useEffect(() => {
    const loadedSubmission = (submissionData || null) as SubmissionDetails | null;

    if (!loadedSubmission) {
      hydratedSubmissionIdRef.current = null;
      setSubmission(null);
      setUpdatedAssessmentFields({});
      setAssessmentValidationErrors({});
      return;
    }

    const isSameSubmissionRefresh = hydratedSubmissionIdRef.current === loadedSubmission.id;
    if (!isSameSubmissionRefresh) {
      setUpdatedAssessmentFields({});
      setAssessmentValidationErrors({});
    }
    setSubmission(loadedSubmission);
    setRecordForm(createRecordForm(loadedSubmission));
    const nextAssessmentForm = createAssessmentForm(loadedSubmission);
    const nextClearanceForm = createClearanceForm(loadedSubmission);
    if (currentStaffId) {
      const isChecked = window.localStorage.getItem(`gc-save-license-no-checked:${currentStaffId}`) === 'true';
      if (isChecked) {
        const savedLicense = window.localStorage.getItem(`gc-saved-license-no:${currentStaffId}`);
        const hasDBSavedLicense = loadedSubmission?.clearanceInfo?.licenseNo;
        if (savedLicense && !hasDBSavedLicense) {
          nextClearanceForm.licenseNo = savedLicense;
        }
      }
    }
    if (!nextAssessmentForm.examinedBy && defaultSignatoryName) {
      nextAssessmentForm.examinedBy = defaultSignatoryName;
    }
    const previousAssessmentForm = assessmentFormRef.current;
    const hydratedAssessmentForm = isSameSubmissionRefresh
      ? {
        ...nextAssessmentForm,
        // Preserve locally extracted lab values when background refetches return older saved data.
        xrayDate: previousAssessmentForm.xrayDate,
        xrayResult: previousAssessmentForm.xrayResult,
        xrayFindings: previousAssessmentForm.xrayFindings,
        cbcDate: previousAssessmentForm.cbcDate,
        hemoglobin: previousAssessmentForm.hemoglobin,
        hematocrit: previousAssessmentForm.hematocrit,
        wbc: previousAssessmentForm.wbc,
        plateletCount: previousAssessmentForm.plateletCount,
        bloodType: previousAssessmentForm.bloodType,
        glucose: previousAssessmentForm.glucose,
        protein: previousAssessmentForm.protein,
        urinalysisDate: previousAssessmentForm.urinalysisDate,
        urinalysisGlucose: previousAssessmentForm.urinalysisGlucose,
        urinalysisProtein: previousAssessmentForm.urinalysisProtein,
      }
      : nextAssessmentForm;
    assessmentFormRef.current = hydratedAssessmentForm;
    setAssessmentForm(hydratedAssessmentForm);
    setClearanceForm(nextClearanceForm);
    setStaffNotes(loadedSubmission.staffNotes || '');
    setReviewStatus(loadedSubmission.status);
    hydratedSubmissionIdRef.current = loadedSubmission.id;
  }, [defaultSignatoryName, submissionData, currentStaffId]);

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load submission');
    }
  }, [isError]);

  useEffect(() => {
    if (!defaultSignatoryName) return;
    const previousAssessmentForm = assessmentFormRef.current;
    if (previousAssessmentForm.examinedBy) return;

    const nextAssessmentForm = { ...previousAssessmentForm, examinedBy: defaultSignatoryName };
    assessmentFormRef.current = nextAssessmentForm;
    setAssessmentForm(nextAssessmentForm);
  }, [defaultSignatoryName]);

  const handleSignatureUpload = async (nextFile?: File | null) => {
    const targetFile = nextFile || signatureFile;
    if (!targetFile) {
      toast.info('Choose a signature image first.');
      return;
    }

    setUploadingSignature(true);
    try {
      const uploaded = await uploadStaffSignature(targetFile);
      const refreshed = await getStaffSignature().catch(() => buildEmptyStaffSignature());
      const nextSignatureUrl = withCacheBust(uploaded.signatureUrl || refreshed.signatureUrl);

      setStaffSignature({
        signatureUrl: nextSignatureUrl,
        signatureFileName: targetFile.name || refreshed.signatureFileName || uploaded.signatureFileName || null,
      });
      setSubmission((prev) => (
        prev
          ? {
            ...prev,
            staffMeasurements: {
              ...(prev.staffMeasurements || {}),
              examinedBySignatureUrl: nextSignatureUrl || undefined,
            },
          }
          : prev
      ));
      setSignatureFile(null);
      await Promise.all([
        invalidateStaffWorkflowQueries(queryClient, submissionId, submission?.studentId),
        queryClient.invalidateQueries({ queryKey: ['studentRecords'] }),
      ]);
      toast.success('Staff signature uploaded successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload staff signature.');
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleSignatureChange = (file: File | null) => {
    if (!file) {
      setSignatureFile(null);
      return;
    }

    if (!isAllowedSignatureImage(file)) {
      toast.error('Please upload an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Staff signature must be 5 MB or smaller.');
      return;
    }

    setSignatureFile(file);
    void handleSignatureUpload(file);
  };

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

  useEffect(() => {
    const nextFileUrl = submission?.xrayFileUrl || '';
    if (lastXrayOcrFileRef.current === nextFileUrl) return;

    lastXrayOcrFileRef.current = nextFileUrl;
    xrayOcrRunRef.current += 1;
    setXrayOcrState({
      message: '',
      status: 'idle',
    });
  }, [submission?.xrayFileUrl]);

  useEffect(() => {
    const nextFileUrl = submission?.cbcFileUrl || '';
    if (lastCbcOcrFileRef.current === nextFileUrl) return;

    lastCbcOcrFileRef.current = nextFileUrl;
    cbcOcrRunRef.current += 1;
    setCbcOcrState({
      message: '',
      status: 'idle',
    });
  }, [submission?.cbcFileUrl]);

  useEffect(() => {
    const nextFileUrl = submission?.urinalysisFileUrl || '';
    if (lastUrinalysisOcrFileRef.current === nextFileUrl) return;

    lastUrinalysisOcrFileRef.current = nextFileUrl;
    urinalysisOcrRunRef.current += 1;
    setUrinalysisOcrState({
      message: '',
      status: 'idle',
    });
  }, [submission?.urinalysisFileUrl]);

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

  function markChangedAssessmentFields(previous: AssessmentForm, updates: Partial<AssessmentForm>) {
    const changedFields = Object.entries(updates)
      .filter(([field, value]) => {
        const assessmentField = field as keyof AssessmentForm;
        return (
          HIGHLIGHTED_ASSESSMENT_FIELDS.includes(assessmentField)
          && String(previous[assessmentField] || '') !== String(value || '')
        );
      })
      .map(([field]) => field as keyof AssessmentForm);

    if (!changedFields.length) return;

    setUpdatedAssessmentFields((prev) => {
      const next = { ...prev };
      changedFields.forEach((field) => {
        next[field] = true;
      });
      return next;
    });
  }

  function getUpdatedFieldClass(field: keyof AssessmentForm) {
    return updatedAssessmentFields[field] ? UPDATED_FIELD_CLASS : '';
  }

  function commitAssessmentFormChange(previous: AssessmentForm, next: AssessmentForm) {
    markChangedAssessmentFields(previous, next);
    assessmentFormRef.current = next;
    setAssessmentForm(next);
  }

  function updateAssessmentField<K extends keyof AssessmentForm>(field: K, value: AssessmentForm[K]) {
    const prev = assessmentFormRef.current;
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

    commitAssessmentFormChange(prev, next);

    if (isPhysicalExamRequiredField(field)) {
      const validationMessage = getPhysicalExamFieldValidationError(field, String(normalizedValue));
      setAssessmentValidationErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        if (validationMessage) {
          nextErrors[field] = validationMessage;
        } else {
          delete nextErrors[field];
        }
        return nextErrors;
      });
    }
  }

  function handleVisualAcuityChange(value: string) {
    if (!isVisualAcuitySelectValue(value)) return;
    updateAssessmentField('visualAcuity', value);
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
                ? normalizeSingleClearancePurpose(value as ClearanceForm['purpose'])
                : field === 'licenseNo'
                  ? sanitizeLicenseNo(String(value))
                  : field === 'signatoryName'
                    ? normalizeClearanceSignatoryName(String(value))
                    : value,
    }));
  }

  function selectClearancePurpose(purpose: ClearancePurpose) {
    setClearanceForm((prev) => {
      return {
        ...prev,
        purpose: [purpose],
      };
    });
  }

  function getFileExtension(fileName: string) {
    return String(fileName || '').split('.').pop()?.toLowerCase() || '';
  }

  function isAllowedLabResultFile(file: File) {
    const mimeType = String(file.type || '').toLowerCase();
    const extension = getFileExtension(file.name);
    return mimeType === 'application/pdf' || mimeType.startsWith('image/') || LAB_RESULT_ALLOWED_EXTENSIONS.includes(extension);
  }

  function validateLabResultFile(file: File, title: string) {
    if (!isAllowedLabResultFile(file)) {
      toast.error(`${title} must be a PDF or image file.`);
      return false;
    }

    if (file.size > LAB_RESULT_MAX_FILE_SIZE_BYTES) {
      toast.error(`${title} file must be ${LAB_RESULT_MAX_FILE_SIZE_LABEL} or smaller.`);
      return false;
    }

    return true;
  }

  function getLabUploadTitle(fileType: LabUploadType) {
    if (fileType === 'xray') return 'Chest X-Ray';
    if (fileType === 'cbc') return 'CBC';
    return 'Urinalysis';
  }

  function getCurrentLabFileUrl(fileType: LabUploadType) {
    if (fileType === 'xray') return submission?.xrayFileUrl || '';
    if (fileType === 'cbc') return submission?.cbcFileUrl || '';
    return submission?.urinalysisFileUrl || '';
  }

  async function handleLabResultFileSelected(fileType: LabUploadType, file: File | null, source: LabUploadSource) {
    if (!submissionId || !submission || !file) return;

    const title = getLabUploadTitle(fileType);
    if (uploadingLabFile[fileType]) {
      toast.info(`${title} upload is already in progress.`);
      return;
    }
    if (!validateLabResultFile(file, title)) return;

    if (getCurrentLabFileUrl(fileType)) {
      toast.info(`${title} replacement started. You can keep reviewing while it uploads.`);
      await uploadLabResultFile(fileType, file, true, source);
      return;
    }

    await uploadLabResultFile(fileType, file, false, source);
  }

  async function uploadLabResultFile(
    fileType: LabUploadType,
    file: File,
    isReplacement = false,
    source: LabUploadSource = 'file',
  ) {
    if (!submissionId || !submission) return false;

    const title = getLabUploadTitle(fileType);
    setUploadingLabFile((prev) => ({ ...prev, [fileType]: true }));
    setUploadingLabSource((prev) => ({ ...prev, [fileType]: source }));
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

      queryClient.setQueryData(
        staffSubmissionDetailQueryKey(submissionId),
        (cached: SubmissionDetails | null) => {
          if (!cached) return cached;
          return {
            ...cached,
            xrayFileUrl: fileType === 'xray' ? nextUrl || cached.xrayFileUrl : cached.xrayFileUrl,
            cbcFileUrl: fileType === 'cbc' ? nextUrl || cached.cbcFileUrl : cached.cbcFileUrl,
            urinalysisFileUrl: fileType === 'urinalysis' ? nextUrl || cached.urinalysisFileUrl : cached.urinalysisFileUrl,
            updatedAt: now,
          };
        },
      );
      toast.success(`${title} file ${isReplacement ? 'replaced' : 'uploaded'}.`);
      return true;
    } catch (error) {
      console.error(`Failed to upload ${fileType} file:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to upload ${title} file.`);
      return false;
    } finally {
      setUploadingLabFile((prev) => ({ ...prev, [fileType]: false }));
      setUploadingLabSource((prev) => ({ ...prev, [fileType]: null }));
    }
  }

  function normalizeCbcOcrFields(fields: CbcOcrExtraction['fields']) {
    const normalized: Partial<Pick<AssessmentForm, 'bloodType' | 'cbcDate' | 'hematocrit' | 'hemoglobin' | 'plateletCount' | 'wbc'>> = {};

    const cbcDate = normalizeDateInputValue(fields.date);
    if (cbcDate) normalized.cbcDate = cbcDate;

    const hemoglobin = sanitizeNumericWithLimits(fields.hemoglobin || '', 2, 1);
    if (hemoglobin) normalized.hemoglobin = hemoglobin;

    const hematocrit = sanitizeNumericWithLimits(fields.hematocrit || '', 3, 1);
    if (hematocrit) normalized.hematocrit = hematocrit;

    const wbc = sanitizeNumericWithLimits(fields.wbc || '', 3, 2);
    const wbcValue = Number(wbc);
    if (Number.isFinite(wbcValue) && wbcValue >= 0.5 && wbcValue <= 100) normalized.wbc = wbc;

    const plateletCount = sanitizeNumericWithLimits(fields.plateletCount || '', 4, 0);
    const plateletValue = Number(plateletCount);
    if (Number.isFinite(plateletValue) && plateletValue >= 10 && plateletValue <= 1000) normalized.plateletCount = plateletCount;

    const bloodType = String(fields.bloodType || '').trim().toUpperCase();
    if (BLOOD_TYPE_OPTIONS.includes(bloodType as (typeof BLOOD_TYPE_OPTIONS)[number])) {
      normalized.bloodType = bloodType;
    }

    return normalized;
  }

  function getCbcDetectedFieldCount(fields: Partial<Pick<AssessmentForm, 'bloodType' | 'cbcDate' | 'hematocrit' | 'hemoglobin' | 'plateletCount' | 'wbc'>>) {
    return Object.values(fields).filter((value) => String(value || '').trim()).length;
  }

  function normalizeUrinalysisOcrFields(fields: UrinalysisOcrExtraction['fields']) {
    const normalized: Partial<Pick<AssessmentForm, 'glucose' | 'protein' | 'urinalysisDate' | 'urinalysisGlucose' | 'urinalysisProtein'>> = {};

    const urinalysisDate = normalizeDateInputValue(fields.date);
    if (urinalysisDate) normalized.urinalysisDate = urinalysisDate;

    const glucose = String(fields.glucose || '').trim();
    if (URINALYSIS_DIPSTICK_OPTIONS.includes(glucose as (typeof URINALYSIS_DIPSTICK_OPTIONS)[number])) {
      normalized.urinalysisGlucose = glucose;
      normalized.glucose = glucose;
    }

    const protein = String(fields.protein || '').trim();
    if (URINALYSIS_DIPSTICK_OPTIONS.includes(protein as (typeof URINALYSIS_DIPSTICK_OPTIONS)[number])) {
      normalized.urinalysisProtein = protein;
      normalized.protein = protein;
    }

    return normalized;
  }

  function getUrinalysisDetectedFieldCount(fields: Partial<Pick<AssessmentForm, 'urinalysisDate' | 'urinalysisGlucose' | 'urinalysisProtein'>>) {
    return [fields.urinalysisDate, fields.urinalysisGlucose, fields.urinalysisProtein].filter((value) => String(value || '').trim()).length;
  }

  async function runChestXrayOcr(manualRun: boolean): Promise<OcrRunOutcome> {
    if (!submissionId) {
      if (manualRun) toast.error('Submission record is still loading.');
      return 'skipped';
    }

    const xrayFileUrl = submission?.xrayFileUrl || '';
    if (!xrayFileUrl) {
      if (manualRun) toast.error('Upload a Chest X-Ray result file before running OCR.');
      return 'skipped';
    }

    const runId = xrayOcrRunRef.current + 1;
    xrayOcrRunRef.current = runId;
    setXrayOcrState({
      message: 'Scanning result...',
      status: 'processing',
    });

    try {
      const result = await extractChestXrayFindings(submissionId);

      if (xrayOcrRunRef.current !== runId) return 'skipped';

      const rawFindings = String(result.findings || '').trim();
      const findings = sanitizeSafeText(rawFindings, MAX_FINDINGS_LENGTH).trim();
      const detectedXrayDate = normalizeDateInputValue(result.date);
      const detectedDateOutOfRange = Boolean(
        detectedXrayDate && !isMedicalRecordDateInRange(detectedXrayDate),
      );
      const detectedFieldCount = (detectedXrayDate ? 1 : 0) + (findings ? 1 : 0) + (result.result ? 1 : 0);

      if (!detectedFieldCount) {
        setXrayOcrState({
          message: result.rawText.trim()
            ? 'Scan finished, but no X-Ray date, findings, or impression line was detected.'
            : 'No readable text was found in the Chest X-Ray file.',
          source: result.source,
          status: 'warning',
        });
        if (manualRun) {
          toast.warning('No Chest X-Ray fields were detected in the uploaded file.');
        }
        return 'warning';
      }

      const isLowConfidence = typeof result.confidence === 'number' && result.confidence < 80;
      const previousAssessmentForm = assessmentFormRef.current;
      commitAssessmentFormChange(previousAssessmentForm, {
        ...previousAssessmentForm,
        xrayDate: detectedXrayDate || previousAssessmentForm.xrayDate,
        xrayFindings: findings || previousAssessmentForm.xrayFindings,
        xrayResult: result.result || previousAssessmentForm.xrayResult,
      });
      setXrayOcrState({
        confidence: result.confidence,
        fieldsDetected: detectedFieldCount,
        message: detectedDateOutOfRange
          ? `Filled ${detectedFieldCount} field${detectedFieldCount === 1 ? '' : 's'} (detected date is outside allowed date window). Review before saving.`
          : isLowConfidence
            ? `Filled ${detectedFieldCount} field${detectedFieldCount === 1 ? '' : 's'} with low confidence. Review before saving.`
            : `Filled ${detectedFieldCount} field${detectedFieldCount === 1 ? '' : 's'}. Review before saving.`,
        source: result.source,
        status: isLowConfidence || detectedDateOutOfRange ? 'warning' : 'success',
      });
      if (manualRun) {
        if (detectedDateOutOfRange) {
          toast.warning('Chest X-Ray fields were filled, but the detected date is outside the allowed date window.');
        } else {
          toast.success('Chest X-Ray fields were filled from the uploaded file.');
        }
      }
      return isLowConfidence || detectedDateOutOfRange ? 'filled_with_warning' : 'filled';
    } catch (error) {
      if (xrayOcrRunRef.current !== runId) return 'skipped';
      const message = error instanceof Error ? error.message : 'Failed to read the Chest X-Ray result file.';
      setXrayOcrState({
        message,
        status: 'error',
      });
      if (manualRun) {
        toast.error(message);
      }
      return 'error';
    }
  }

  async function runCbcOcr(manualRun: boolean): Promise<OcrRunOutcome> {
    if (!submissionId) {
      if (manualRun) toast.error('Submission record is still loading.');
      return 'skipped';
    }

    const cbcFileUrl = submission?.cbcFileUrl || '';
    if (!cbcFileUrl) {
      if (manualRun) toast.error('Upload a CBC result file before running OCR.');
      return 'skipped';
    }

    const runId = cbcOcrRunRef.current + 1;
    cbcOcrRunRef.current = runId;
    setCbcOcrState({
      message: 'Scanning result',
      status: 'processing',
    });

    try {
      const result = await extractCbcFields(submissionId);

      if (cbcOcrRunRef.current !== runId) return 'skipped';

      const fields = normalizeCbcOcrFields(result.fields);
      const detectedFieldCount = getCbcDetectedFieldCount(fields);
      const detectedCbcDate = normalizeDateInputValue(result.fields.date);
      const detectedDateOutOfRange = Boolean(
        detectedCbcDate && !isMedicalRecordDateInRange(detectedCbcDate),
      );

      if (!detectedFieldCount) {
        setCbcOcrState({
          message: result.rawText.trim()
            ? 'Scan finished, but no CBC labels and values were detected.'
            : 'No readable text was found in the CBC file.',
          source: result.source,
          status: 'warning',
        });
        if (manualRun) {
          toast.warning('No CBC values were detected in the uploaded file.');
        }
        return 'warning';
      }

      const previousAssessmentForm = assessmentFormRef.current;
      commitAssessmentFormChange(previousAssessmentForm, {
        ...previousAssessmentForm,
        ...fields,
      });
      setCbcOcrState({
        fieldsDetected: detectedFieldCount,
        message: detectedDateOutOfRange
          ? `Filled ${detectedFieldCount} CBC field${detectedFieldCount === 1 ? '' : 's'} (detected date is outside allowed date window). Review before saving.`
          : `Filled ${detectedFieldCount} CBC field${detectedFieldCount === 1 ? '' : 's'}. Review before saving.`,
        source: result.source,
        status: detectedDateOutOfRange ? 'warning' : 'success',
      });
      if (manualRun) {
        if (detectedDateOutOfRange) {
          toast.warning('CBC date was detected, but it is outside the allowed date window.');
        } else {
          toast.success('CBC fields were filled from the uploaded file.');
        }
      }
      return detectedDateOutOfRange ? 'filled_with_warning' : 'filled';
    } catch (error) {
      if (cbcOcrRunRef.current !== runId) return 'skipped';
      const message = error instanceof Error ? error.message : 'Failed to read the CBC result file.';
      setCbcOcrState({
        message,
        status: 'error',
      });
      if (manualRun) {
        toast.error(message);
      }
      return 'error';
    }
  }

  async function runUrinalysisOcr(manualRun: boolean): Promise<OcrRunOutcome> {
    if (!submissionId) {
      if (manualRun) toast.error('Submission record is still loading.');
      return 'skipped';
    }

    const urinalysisFileUrl = submission?.urinalysisFileUrl || '';
    if (!urinalysisFileUrl) {
      if (manualRun) toast.error('Upload a Urinalysis result file before running OCR.');
      return 'skipped';
    }

    const runId = urinalysisOcrRunRef.current + 1;
    urinalysisOcrRunRef.current = runId;
    setUrinalysisOcrState({
      message: 'Scanning result',
      status: 'processing',
    });

    try {
      const result = await extractUrinalysisFields(submissionId);

      if (urinalysisOcrRunRef.current !== runId) return 'skipped';

      const fields = normalizeUrinalysisOcrFields(result.fields);
      const detectedFieldCount = getUrinalysisDetectedFieldCount(fields);
      const detectedUrinalysisDate = normalizeDateInputValue(result.fields.date);
      const detectedDateOutOfRange = Boolean(
        detectedUrinalysisDate && !isMedicalRecordDateInRange(detectedUrinalysisDate),
      );

      if (!detectedFieldCount) {
        setUrinalysisOcrState({
          message: result.rawText.trim()
            ? 'Scan finished, but no Urinalysis glucose or protein result was detected.'
            : 'No readable text was found in the Urinalysis file.',
          source: result.source,
          status: 'warning',
        });
        if (manualRun) {
          toast.warning('No Urinalysis values were detected in the uploaded file.');
        }
        return 'warning';
      }

      const previousAssessmentForm = assessmentFormRef.current;
      commitAssessmentFormChange(previousAssessmentForm, {
        ...previousAssessmentForm,
        ...fields,
      });
      setUrinalysisOcrState({
        fieldsDetected: detectedFieldCount,
        message: detectedDateOutOfRange
          ? `Filled ${detectedFieldCount} Urinalysis field${detectedFieldCount === 1 ? '' : 's'} (detected date is outside allowed date window). Review before saving.`
          : `Filled ${detectedFieldCount} Urinalysis field${detectedFieldCount === 1 ? '' : 's'}. Review before saving.`,
        source: result.source,
        status: detectedDateOutOfRange ? 'warning' : 'success',
      });
      if (manualRun) {
        if (detectedDateOutOfRange) {
          toast.warning('Urinalysis date was detected, but it is outside the allowed date window.');
        } else {
          toast.success('Urinalysis fields were filled from the uploaded file.');
        }
      }
      return detectedDateOutOfRange ? 'filled_with_warning' : 'filled';
    } catch (error) {
      if (urinalysisOcrRunRef.current !== runId) return 'skipped';
      const message = error instanceof Error ? error.message : 'Failed to read the Urinalysis result file.';
      setUrinalysisOcrState({
        message,
        status: 'error',
      });
      if (manualRun) {
        toast.error(message);
      }
      return 'error';
    }
  }

  function getUploadedLabOcrTypes() {
    const fileTypes: LabUploadType[] = [];
    if (submission?.xrayFileUrl) fileTypes.push('xray');
    if (submission?.cbcFileUrl) fileTypes.push('cbc');
    if (submission?.urinalysisFileUrl) fileTypes.push('urinalysis');
    return fileTypes;
  }

  function hasCurrentLabOcrValues(fileTypes: LabUploadType[]) {
    return fileTypes.some((fileType) => {
      if (fileType === 'xray') {
        return Boolean(assessmentForm.xrayFindings.trim());
      }

      if (fileType === 'cbc') {
        return [
          assessmentForm.cbcDate,
          assessmentForm.hemoglobin,
          assessmentForm.hematocrit,
          assessmentForm.wbc,
          assessmentForm.plateletCount,
          assessmentForm.bloodType,
        ].some((value) => String(value || '').trim());
      }

      return [
        assessmentForm.urinalysisDate,
        assessmentForm.urinalysisGlucose,
        assessmentForm.urinalysisProtein,
      ].some((value) => String(value || '').trim());
    });
  }

  async function runLabResultsAutoFill(options: { skipExistingValueConfirmation?: boolean } = {}) {
    if (!submissionId) {
      toast.error('Submission record is still loading.');
      return;
    }

    const uploadedLabFiles = getUploadedLabOcrTypes();
    if (!uploadedLabFiles.length) {
      toast.error('Upload at least one lab result file before running Auto Fill.');
      return;
    }

    const isProcessing = [xrayOcrState.status, cbcOcrState.status, urinalysisOcrState.status].some(
      (status) => status === 'processing',
    );
    if (isProcessing) return;

    if (!options.skipExistingValueConfirmation && hasCurrentLabOcrValues(uploadedLabFiles)) {
      setShowAutoFillReplaceDialog(true);
      return;
    }

    setShowAutoFillReplaceDialog(false);
    const outcomes = await Promise.all(
      uploadedLabFiles.map((fileType) => {
        if (fileType === 'xray') return runChestXrayOcr(false);
        if (fileType === 'cbc') return runCbcOcr(false);
        return runUrinalysisOcr(false);
      }),
    );

    const filledCount = outcomes.filter((outcome) => outcome === 'filled' || outcome === 'filled_with_warning').length;
    const warningCount = outcomes.filter((outcome) => outcome === 'warning' || outcome === 'filled_with_warning').length;
    const errorCount = outcomes.filter((outcome) => outcome === 'error').length;

    if (filledCount && !warningCount && !errorCount) {
      toast.success(`Auto Fill completed for ${filledCount} lab result file${filledCount === 1 ? '' : 's'}.`);
    } else if (filledCount) {
      toast.warning('Auto Fill filled some lab result fields. Review the OCR messages below for anything missed.');
    } else if (warningCount && !errorCount) {
      toast.warning('Auto Fill finished, but no lab result fields were detected. Review the OCR messages below.');
    } else {
      toast.error('Auto Fill could not extract lab result fields. Review the OCR messages below.');
    }
  }

  function queueBackgroundReview(action: ReviewAction, nextStatus?: ReviewStatus, customNotes?: string) {
    const issuedDateOverride = action === 'cleared' ? getTodayDateInputValue() : undefined;
    if (issuedDateOverride && clearanceForm.issuedDate !== issuedDateOverride) {
      setClearanceForm((current) => ({
        ...current,
        issuedDate: issuedDateOverride,
      }));
    }

    const prepared = prepareReviewSubmission(nextStatus, customNotes, { issuedDateOverride });
    if (!prepared) return;

    setSavingAction(action);
    backgroundReviewMutation.mutate({ prepared, action });
    toast.success(
      action === 'cleared'
        ? 'Medical certificate is being processed.'
        : action === 'pending'
          ? 'Decline update is being processed.'
          : 'Review save is being processed.',
    );
  }

  if (loading) {
    return <StaffRecordReviewSkeleton />;
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

  const xrayManagedByClinic = isClinicManagedLabSource(submission.xrayTestClinic);
  const cbcManagedByClinic = isClinicManagedLabSource(submission.cbcTestClinic);
  const urinalysisManagedByClinic = isClinicManagedLabSource(submission.urinalysisTestClinic);
  const readyLabResultCount = [
    submission.xrayFileUrl || xrayManagedByClinic,
    submission.cbcFileUrl || cbcManagedByClinic,
    submission.urinalysisFileUrl || urinalysisManagedByClinic,
  ].filter(Boolean).length;
  const reportedConditionCount = countVerifiedConditions(recordForm.medicalHistory);
  const studentDisplayName = [recordForm.firstName, recordForm.lastName].filter(Boolean).join(' ') || 'Student';
  const studentYearLevel = recordForm.yearLevel ? getYearLevelLabel(recordForm.yearLevel) : 'Year level not set';
  const recordSlotLabel = recordForm.recordSlot ? getSubmissionSlotLabel(recordForm.recordSlot) : 'Record slot not set';
  const submittedDate = new Date(submission.submittedAt).toLocaleDateString();
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

  const scrollToPortalTop = () => {
    if (typeof document === 'undefined') return;
    const portalContent = document.getElementById('portal-content');
    if (portalContent) {
      portalContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeReviewStep = (nextStep: ReviewStep) => {
    setActiveReviewStep(nextStep);
    window.requestAnimationFrame(() => {
      scrollToPortalTop();
    });
  };
  const medicalRecordDateBounds = getMedicalRecordDateBounds();
  const finalDecisionLabel = 'Clearance';
  const uploadedLabOcrTypes = getUploadedLabOcrTypes();
  const hasUploadedLabResultFile = uploadedLabOcrTypes.length > 0;
  const isUploadingAnyLabFile = Object.values(uploadingLabFile).some(Boolean);
  const uploadingLabTitles = (Object.entries(uploadingLabFile) as Array<[LabUploadType, boolean]>)
    .filter(([, isUploading]) => isUploading)
    .map(([fileType]) => getLabUploadTitle(fileType));
  const isLabAutoFillProcessing = [xrayOcrState.status, cbcOcrState.status, urinalysisOcrState.status].some(
    (status) => status === 'processing',
  );
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
      <Dialog
        open={showAutoFillReplaceDialog}
        onOpenChange={(open) => {
          if (!open && !isLabAutoFillProcessing) {
            setShowAutoFillReplaceDialog(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replace existing lab values?</DialogTitle>
            <DialogDescription>
              Auto Fill will update current lab fields from the uploaded files.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAutoFillReplaceDialog(false)}
              disabled={isLabAutoFillProcessing}
            >
              No
            </Button>
            <Button
              type="button"
              onClick={() => void runLabResultsAutoFill({ skipExistingValueConfirmation: true })}
              disabled={isLabAutoFillProcessing}
            >
              {isLabAutoFillProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLabAutoFillProcessing ? 'Filling...' : 'Yes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button
        variant="ghost"
        onClick={() => navigate('/staff/submissions')}
        className="pl-0 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Submissions
      </Button>

      <header className="border-b border-border/70 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clinic Review</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="text-base font-semibold text-foreground">{studentDisplayName}</span>
              <span>{recordForm.studentId}</span>
              <span>{studentYearLevel}</span>
              <span>{recordForm.course || 'Course not set'}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {getStatusBadge(persistedStatus)}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span>
            <span className="text-muted-foreground">Submitted </span>
            <span className="font-medium text-foreground">{submittedDate}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Labs </span>
            <span className="font-medium text-foreground">{readyLabResultCount}/3 ready</span>
          </span>
          <span>
            <span className="text-muted-foreground">Conditions </span>
            <span className="font-medium text-foreground">{reportedConditionCount || 'None'}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Examiner </span>
            <span className="font-medium text-foreground">{assessmentForm.examinedBy || 'Unassigned'}</span>
          </span>
        </div>
      </header>

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

      {isUploadingAnyLabFile ? (
        <div className="flex items-start gap-3 rounded-[18px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          <p>
            {uploadingLabTitles.join(', ')} {uploadingLabTitles.length === 1 ? 'file is' : 'files are'} still uploading.
            You can continue to other review steps while this finishes.
          </p>
        </div>
      ) : null}

      <Tabs value={activeReviewStep} onValueChange={(value) => changeReviewStep(value as ReviewStep)} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 rounded-[18px] border border-border/60 bg-muted/40 p-1.5 md:grid-cols-4">
          <TabsTrigger value="record" className="min-h-10 w-full rounded-[18px] px-3 py-2 text-xs font-semibold sm:text-sm">
            Student Record
          </TabsTrigger>
          <TabsTrigger value="labs" className="min-h-10 w-full rounded-[18px] px-3 py-2 text-xs font-semibold sm:text-sm">
            Lab Results
          </TabsTrigger>
          <TabsTrigger value="assessment" className="min-h-10 w-full rounded-[18px] px-3 py-2 text-xs font-semibold sm:text-sm">
            Assessment
          </TabsTrigger>
          <TabsTrigger value="decision" className="min-h-10 w-full rounded-[18px] px-3 py-2 text-xs font-semibold sm:text-sm">
            {finalDecisionLabel}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="space-y-6">
          <StudentProfileFormCard
            value={{
              studentId: recordForm.studentId,
              firstName: recordForm.firstName,
              lastName: recordForm.lastName,
              middleInitial: recordForm.middleInitial,
              department: recordForm.department,
              course: recordForm.course,
              yearLevel: recordForm.yearLevel,
              age: recordForm.age,
              sex: recordForm.sex,
              birthday: recordForm.birthday,
              civilStatus: recordForm.civilStatus,
              contactNumber: recordForm.contactNumber,
              address: recordForm.address,
            }}
            readOnly
            title="Student Profile"
            yearLevelLabel="Year Level"
            extraFields={[{ id: 'recordSlot', label: 'Record Slot', value: recordSlotLabel }]}
          />

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
                      maxLength={11}
                      placeholder="e.g. 09XXXXXXXXX"
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
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => void runLabResultsAutoFill()}
              disabled={!hasUploadedLabResultFile || isLabAutoFillProcessing || isUploadingAnyLabFile}
              className="w-full sm:h-10 sm:w-auto sm:min-w-[10.5rem] sm:px-6"
            >
              {isLabAutoFillProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanText className="mr-2 h-4 w-4" />
              )}
              Auto Fill
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Chest X-Ray Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <span className="font-medium">Submitted test location: </span>
                {submission.xrayTestClinic || 'Not specified'}
              </div>
              {submission.xrayFileUrl ? (
                <SubmittedFilePreview title="Chest X-Ray Result" fileUrl={submission.xrayFileUrl} alt="Student chest X-ray result" />
              ) : xrayManagedByClinic ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  No student upload required. Results from James L. Gordon Memorial Hospital are sent directly to the clinic.
                </div>
              ) : (
                <SubmittedFilePreview title="Chest X-Ray Result" fileUrl={submission.xrayFileUrl} alt="Student chest X-ray result" />
              )}
              <LabUploadActions
                title="Chest X-Ray result"
                isUploading={uploadingLabFile.xray}
                uploadSource={uploadingLabSource.xray}
                onChooseFile={(file) => void handleLabResultFileSelected('xray', file, 'file')}
                onOpenCamera={(file) => void handleLabResultFileSelected('xray', file, 'camera')}
              />
              {submission.xrayFileUrl ? (
                <div
                  aria-live="polite"
                  className={`rounded-lg border px-4 py-3 text-sm ${xrayOcrState.status === 'idle'
                      ? 'border-outline-variant/50 bg-surface-container-low text-on-surface'
                      : getOcrStatusClass(xrayOcrState.status)
                    }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      {xrayOcrState.status === 'processing' ? (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <ScanText className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">Chest X-Ray OCR</p>
                        {xrayOcrState.message ? (
                          <p className="mt-1 text-xs opacity-85">{xrayOcrState.message}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                      {typeof xrayOcrState.fieldsDetected === 'number' ? (
                        <Badge variant="outline" className="w-fit bg-white/70">
                          {xrayOcrState.fieldsDetected} field{xrayOcrState.fieldsDetected === 1 ? '' : 's'}
                        </Badge>
                      ) : null}
                      {typeof xrayOcrState.confidence === 'number' ? (
                        <Badge variant="outline" className="w-fit bg-white/70">
                          Confidence {Math.round(xrayOcrState.confidence)}%
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="xrayDate">Issuance Date</Label>
                  <Input
                    id="xrayDate"
                    type="date"
                    value={assessmentForm.xrayDate}
                    onChange={(event) => updateAssessmentField('xrayDate', event.target.value)}
                    min={medicalRecordDateBounds.min}
                    max={medicalRecordDateBounds.max}
                    className={cn('mt-2', getUpdatedFieldClass('xrayDate'))}
                  />
                </div>
                <div>
                  <Label htmlFor="xrayResult">Result</Label>
                  <Select
                    value={assessmentForm.xrayResult}
                    onValueChange={(value) => updateAssessmentField('xrayResult', value as 'normal' | 'abnormal')}
                  >
                    <SelectTrigger id="xrayResult" className={cn('mt-2', getUpdatedFieldClass('xrayResult'))}>
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
                    className={cn(
                      'mt-2 h-24 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap',
                      getUpdatedFieldClass('xrayFindings'),
                    )}
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
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <span className="font-medium">Submitted test location: </span>
                {submission.cbcTestClinic || 'Not specified'}
              </div>
              {submission.cbcFileUrl ? (
                <SubmittedFilePreview title="CBC Result" fileUrl={submission.cbcFileUrl} alt="Student CBC result" />
              ) : cbcManagedByClinic ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  No student upload required. Results from James L. Gordon Memorial Hospital are sent directly to the clinic.
                </div>
              ) : (
                <SubmittedFilePreview title="CBC Result" fileUrl={submission.cbcFileUrl} alt="Student CBC result" />
              )}
              <LabUploadActions
                title="CBC result"
                isUploading={uploadingLabFile.cbc}
                uploadSource={uploadingLabSource.cbc}
                onChooseFile={(file) => void handleLabResultFileSelected('cbc', file, 'file')}
                onOpenCamera={(file) => void handleLabResultFileSelected('cbc', file, 'camera')}
              />
              {submission.cbcFileUrl ? (
                <div
                  aria-live="polite"
                  className={`rounded-lg border px-4 py-3 text-sm ${cbcOcrState.status === 'idle'
                      ? 'border-outline-variant/50 bg-surface-container-low text-on-surface'
                      : getOcrStatusClass(cbcOcrState.status)
                    }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      {cbcOcrState.status === 'processing' ? (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <ScanText className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">CBC OCR</p>
                        {cbcOcrState.message ? (
                          <p className="mt-1 text-xs opacity-85">{cbcOcrState.message}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                      {typeof cbcOcrState.fieldsDetected === 'number' ? (
                        <Badge variant="outline" className="w-fit bg-white/70">
                          {cbcOcrState.fieldsDetected} field{cbcOcrState.fieldsDetected === 1 ? '' : 's'}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <Label htmlFor="cbcDate">Issuance Date</Label>
                  <Input
                    id="cbcDate"
                    type="date"
                    value={assessmentForm.cbcDate}
                    onChange={(event) => updateAssessmentField('cbcDate', event.target.value)}
                    min={medicalRecordDateBounds.min}
                    max={medicalRecordDateBounds.max}
                    className={cn('mt-2', getUpdatedFieldClass('cbcDate'))}
                  />
                </div>
                <div>
                  <Label htmlFor="hemoglobin">Hemoglobin (g/dL)</Label>
                  <Input
                    id="hemoglobin"
                    value={assessmentForm.hemoglobin}
                    onChange={(event) => updateAssessmentField('hemoglobin', event.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 13.5"
                    maxLength={4}
                    className={cn('mt-2', getUpdatedFieldClass('hemoglobin'))}
                  />
                </div>
                <div>
                  <Label htmlFor="hematocrit">Hematocrit (%)</Label>
                  <Input
                    id="hematocrit"
                    value={assessmentForm.hematocrit}
                    onChange={(event) => updateAssessmentField('hematocrit', event.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 40.2"
                    maxLength={5}
                    className={cn('mt-2', getUpdatedFieldClass('hematocrit'))}
                  />
                </div>
                <div>
                  <Label htmlFor="wbc">White Blood Cell Count (x10⁹/L)</Label>
                  <Input
                    id="wbc"
                    value={assessmentForm.wbc}
                    onChange={(event) => updateAssessmentField('wbc', event.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 7.8"
                    maxLength={9}
                    className={cn('mt-2', getUpdatedFieldClass('wbc'))}
                  />
                </div>
                <div>
                  <Label htmlFor="plateletCount">Platelet Count (x10⁹/L)</Label>
                  <Input
                    id="plateletCount"
                    value={assessmentForm.plateletCount}
                    onChange={(event) => updateAssessmentField('plateletCount', event.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 250"
                    maxLength={10}
                    className={cn('mt-2', getUpdatedFieldClass('plateletCount'))}
                  />
                </div>
                <div>
                  <Label htmlFor="bloodType">Blood Type</Label>
                  <Select
                    value={assessmentForm.bloodType}
                    onValueChange={(value) => updateAssessmentField('bloodType', value)}
                  >
                    <SelectTrigger id="bloodType" className={cn('mt-2', getUpdatedFieldClass('bloodType'))}>
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
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <span className="font-medium">Submitted test location: </span>
                {submission.urinalysisTestClinic || 'Not specified'}
              </div>
              {submission.urinalysisFileUrl ? (
                <SubmittedFilePreview title="Urinalysis Result" fileUrl={submission.urinalysisFileUrl} alt="Student urinalysis result" />
              ) : urinalysisManagedByClinic ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  No student upload required. Results from James L. Gordon Memorial Hospital are sent directly to the clinic.
                </div>
              ) : (
                <SubmittedFilePreview title="Urinalysis Result" fileUrl={submission.urinalysisFileUrl} alt="Student urinalysis result" />
              )}
              <LabUploadActions
                title="Urinalysis result"
                isUploading={uploadingLabFile.urinalysis}
                uploadSource={uploadingLabSource.urinalysis}
                onChooseFile={(file) => void handleLabResultFileSelected('urinalysis', file, 'file')}
                onOpenCamera={(file) => void handleLabResultFileSelected('urinalysis', file, 'camera')}
              />
              {submission.urinalysisFileUrl ? (
                <div
                  aria-live="polite"
                  className={`rounded-lg border px-4 py-3 text-sm ${urinalysisOcrState.status === 'idle'
                      ? 'border-outline-variant/50 bg-surface-container-low text-on-surface'
                      : getOcrStatusClass(urinalysisOcrState.status)
                    }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      {urinalysisOcrState.status === 'processing' ? (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <ScanText className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">Urinalysis OCR</p>
                        {urinalysisOcrState.message ? (
                          <p className="mt-1 text-xs opacity-85">{urinalysisOcrState.message}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                      {typeof urinalysisOcrState.fieldsDetected === 'number' ? (
                        <Badge variant="outline" className="w-fit bg-white/70">
                          {urinalysisOcrState.fieldsDetected} field{urinalysisOcrState.fieldsDetected === 1 ? '' : 's'}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="urinalysisDate">Issuance Date</Label>
                  <Input
                    id="urinalysisDate"
                    type="date"
                    value={assessmentForm.urinalysisDate}
                    onChange={(event) => updateAssessmentField('urinalysisDate', event.target.value)}
                    min={medicalRecordDateBounds.min}
                    max={medicalRecordDateBounds.max}
                    className={cn('mt-2', getUpdatedFieldClass('urinalysisDate'))}
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
                      className={cn('mt-2', getUpdatedFieldClass('urinalysisGlucose'))}
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
                      className={cn('mt-2', getUpdatedFieldClass('urinalysisProtein'))}
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
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <Label htmlFor="clinicBp">Verified Blood Pressure</Label>
                  <Input
                    id="clinicBp"
                    value={assessmentForm.bloodPressure}
                    onChange={(event) => updateAssessmentField('bloodPressure', event.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 120/80"
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
                    placeholder="e.g. 72"
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
                    placeholder="e.g. 16"
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
                    placeholder="e.g. 36.8"
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
                    placeholder="e.g. 60.5"
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
                    placeholder="e.g. 170"
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
                  <Select value={assessmentForm.visualAcuity} onValueChange={handleVisualAcuityChange}>
                    <SelectTrigger id="visualAcuity" className="mt-2">
                      <SelectValue placeholder="Select visual acuity" />
                    </SelectTrigger>
                    <SelectContent>
                      {VISUAL_ACUITY_OPTIONS.map((option) => (
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
                  aria-describedby={assessmentValidationErrors.skin ? 'skin-error' : undefined}
                  aria-invalid={Boolean(assessmentValidationErrors.skin)}
                  className={cn(
                    'mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap',
                    assessmentValidationErrors.skin && INVALID_FIELD_CLASS,
                  )}
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="e.g. Normal / With rashes"
                  rows={3}
                />
                {assessmentValidationErrors.skin ? (
                  <p id="skin-error" className="mt-1 text-xs text-red-600">{assessmentValidationErrors.skin}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="heent">HEENT</Label>
                <Textarea
                  id="heent"
                  value={assessmentForm.heent}
                  onChange={(event) => updateAssessmentField('heent', event.target.value)}
                  aria-describedby={assessmentValidationErrors.heent ? 'heent-error' : undefined}
                  aria-invalid={Boolean(assessmentValidationErrors.heent)}
                  className={cn(
                    'mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap',
                    assessmentValidationErrors.heent && INVALID_FIELD_CLASS,
                  )}
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="e.g. Normal HEENT"
                  rows={3}
                />
                {assessmentValidationErrors.heent ? (
                  <p id="heent-error" className="mt-1 text-xs text-red-600">{assessmentValidationErrors.heent}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="chestLungs">Chest / Lungs</Label>
                <Textarea
                  id="chestLungs"
                  value={assessmentForm.chestLungs}
                  onChange={(event) => updateAssessmentField('chestLungs', event.target.value)}
                  aria-describedby={assessmentValidationErrors.chestLungs ? 'chestLungs-error' : undefined}
                  aria-invalid={Boolean(assessmentValidationErrors.chestLungs)}
                  className={cn(
                    'mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap',
                    assessmentValidationErrors.chestLungs && INVALID_FIELD_CLASS,
                  )}
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="e.g. Clear breath sounds"
                  rows={3}
                />
                {assessmentValidationErrors.chestLungs ? (
                  <p id="chestLungs-error" className="mt-1 text-xs text-red-600">{assessmentValidationErrors.chestLungs}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="heart">Heart</Label>
                <Textarea
                  id="heart"
                  value={assessmentForm.heart}
                  onChange={(event) => updateAssessmentField('heart', event.target.value)}
                  aria-describedby={assessmentValidationErrors.heart ? 'heart-error' : undefined}
                  aria-invalid={Boolean(assessmentValidationErrors.heart)}
                  className={cn(
                    'mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap',
                    assessmentValidationErrors.heart && INVALID_FIELD_CLASS,
                  )}
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="e.g. Regular rate and rhythm"
                  rows={3}
                />
                {assessmentValidationErrors.heart ? (
                  <p id="heart-error" className="mt-1 text-xs text-red-600">{assessmentValidationErrors.heart}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="abdomen">Abdomen</Label>
                <Textarea
                  id="abdomen"
                  value={assessmentForm.abdomen}
                  onChange={(event) => updateAssessmentField('abdomen', event.target.value)}
                  aria-describedby={assessmentValidationErrors.abdomen ? 'abdomen-error' : undefined}
                  aria-invalid={Boolean(assessmentValidationErrors.abdomen)}
                  className={cn(
                    'mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap',
                    assessmentValidationErrors.abdomen && INVALID_FIELD_CLASS,
                  )}
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="e.g. Soft, non-tender"
                  rows={3}
                />
                {assessmentValidationErrors.abdomen ? (
                  <p id="abdomen-error" className="mt-1 text-xs text-red-600">{assessmentValidationErrors.abdomen}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="extremities">Extremities</Label>
                <Textarea
                  id="extremities"
                  value={assessmentForm.extremities}
                  onChange={(event) => updateAssessmentField('extremities', event.target.value)}
                  aria-describedby={assessmentValidationErrors.extremities ? 'extremities-error' : undefined}
                  aria-invalid={Boolean(assessmentValidationErrors.extremities)}
                  className={cn(
                    'mt-2 h-20 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap',
                    assessmentValidationErrors.extremities && INVALID_FIELD_CLASS,
                  )}
                  maxLength={MAX_PHYSICAL_EXAM_FIELD_LENGTH}
                  placeholder="e.g. No edema"
                  rows={3}
                />
                {assessmentValidationErrors.extremities ? (
                  <p id="extremities-error" className="mt-1 text-xs text-red-600">{assessmentValidationErrors.extremities}</p>
                ) : null}
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
              <div className="grid gap-6 md:col-span-2 md:grid-cols-2 md:items-start">
                <div>
                  <Label htmlFor="examinedBy">Examined By</Label>
                  <Input
                    id="examinedBy"
                    value={assessmentForm.examinedBy}
                    onChange={(event) => updateAssessmentField('examinedBy', event.target.value)}
                    maxLength={MAX_EXAMINED_BY_LENGTH}
                    className="mt-2"
                    placeholder="e.g. Dr. Maria Santos"
                  />
                </div>
                <div className="rounded-[18px] border border-dashed border-outline-variant/60 bg-surface-container-low px-4 py-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-on-surface">Staff signature</p>
                      <p className="text-xs text-on-surface-variant">
                        Upload once here to save your signature for the Examined by section.
                      </p>
                    </div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-h-16 flex-1 items-center rounded-lg border bg-white px-3 py-2">
                        {currentStaffSignatureUrl ? (
                          <img
                            src={currentStaffSignatureUrl}
                            alt="Staff signature"
                            className="h-12 w-auto object-contain"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {loadingSignature ? 'Loading saved signature...' : 'No saved signature yet.'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <FilePickerButton
                          accept={STAFF_SIGNATURE_ACCEPT_ATTRIBUTE}
                          ariaLabel="Choose staff signature image"
                          className="w-full sm:w-auto"
                          disabled={uploadingSignature}
                          onFileSelected={handleSignatureChange}
                        >
                          <FileUp className="mr-2 h-4 w-4" />
                          Choose Signature
                        </FilePickerButton>
                      </div>
                    </div>
                    {signatureFile ? (
                      <p className="text-xs text-on-surface-variant">{signatureFile.name}</p>
                    ) : staffSignature.signatureFileName ? (
                      <p className="text-xs text-on-surface-variant">{staffSignature.signatureFileName}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decision" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Medical Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {canFinalizeClearance ? (
                <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-12">
                  <div className="lg:col-span-2 xl:col-span-8">
                    <Label>Purpose *</Label>
                    <RadioGroup
                      value={clearanceForm.purpose[0] || ''}
                      onValueChange={(value) => {
                        if (isClearancePurpose(value)) {
                          selectClearancePurpose(value);
                        }
                      }}
                      className={cn(
                        'mt-2 grid gap-3 rounded-[18px] border p-2 sm:grid-cols-3',
                        clearanceForm.purpose.length === 0
                          ? 'border-red-300 bg-red-50/50'
                          : 'border-outline-variant/50 bg-surface-container-low/30',
                      )}
                    >
                      {CLEARANCE_PURPOSE_OPTIONS.map((option) => {
                        const isSelected = clearanceForm.purpose[0] === option.value;

                        return (
                          <label
                            key={option.value}
                            className={cn(
                              'flex h-11 items-center gap-3 rounded-full border px-4 text-sm font-medium transition-colors',
                              isSelected
                                ? 'border-primary/55 bg-primary/5 text-on-surface'
                                : 'border-outline-variant/45 bg-input-background text-on-surface',
                            )}
                          >
                            <RadioGroupItem value={option.value} id={`clearancePurpose-${option.value}`} />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </RadioGroup>
                    {clearanceForm.purpose.length === 0 ? (
                      <p className="mt-1 text-xs text-red-600">Select a clearance purpose.</p>
                    ) : null}
                  </div>

                  <div className="xl:col-span-4">
                    <Label htmlFor="issuedDate">Issued Date</Label>
                    <Input
                      id="issuedDate"
                      type="date"
                      value={clearanceForm.issuedDate}
                      onChange={(event) => updateClearanceField('issuedDate', event.target.value)}
                      min={medicalRecordDateBounds.min}
                      max={medicalRecordDateBounds.max}
                      className="mt-2"
                    />
                  </div>

                  <div className="xl:col-span-6">
                    <Label htmlFor="clearanceSignatory">Clearance Signatory</Label>
                    <Select
                      value={clearanceForm.signatoryName || CLEARANCE_DOCTORS[0]}
                      onValueChange={(value) => updateClearanceField('signatoryName', value)}
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
                    <p className="mt-2 text-xs text-muted-foreground">This name will appear on the medical certificate.</p>
                  </div>

                  <div className="xl:col-span-6">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="licenseNo">License No.</Label>
                      <Label
                        htmlFor="saveLicenseNo"
                        className="inline-flex cursor-pointer items-center gap-2 text-xs font-normal text-on-surface"
                      >
                        <Checkbox
                          id="saveLicenseNo"
                          checked={saveLicenseNoChecked}
                          onCheckedChange={(checked) => handleSaveLicenseNoChange(checked === true)}
                          className="size-4"
                        />
                        Save License No.
                      </Label>
                    </div>
                    <div className="mt-2">
                      <Input
                        id="licenseNo"
                        value={clearanceForm.licenseNo}
                        onChange={(event) => {
                          const val = sanitizeLicenseNo(event.target.value);
                          updateClearanceField('licenseNo', val);
                          if (saveLicenseNoChecked && currentStaffId) {
                            window.localStorage.setItem(`gc-saved-license-no:${currentStaffId}`, val);
                          }
                        }}
                        inputMode="numeric"
                        maxLength={15}
                        placeholder="License No."
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Numbers only, up to 15 digits.</p>
                  </div>

                  <div className="lg:col-span-2 xl:col-span-12">
                    <Label>General Findings</Label>
                    <RadioGroup
                      value={clearanceForm.findingsNormal ? 'normal' : 'with-findings'}
                      onValueChange={(value) => updateClearanceField('findingsNormal', value === 'normal')}
                      className="mt-2 grid gap-3 md:grid-cols-2"
                    >
                      <label
                        className={cn(
                          'flex h-11 items-center gap-3 rounded-full border px-4 text-sm font-medium transition-colors',
                          clearanceForm.findingsNormal
                            ? 'border-primary/55 bg-primary/5 text-on-surface'
                            : 'border-outline-variant/45 bg-input-background text-on-surface',
                        )}
                      >
                        <RadioGroupItem value="normal" id="findingsNormal" />
                        <span>Normal findings</span>
                      </label>
                      <label
                        className={cn(
                          'flex h-11 items-center gap-3 rounded-full border px-4 text-sm font-medium transition-colors',
                          !clearanceForm.findingsNormal
                            ? 'border-primary/55 bg-primary/5 text-on-surface'
                            : 'border-outline-variant/45 bg-input-background text-on-surface',
                        )}
                      >
                        <RadioGroupItem value="with-findings" id="findingsAbnormal" />
                        <span>With findings / restrictions</span>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="xl:col-span-6">
                    <Label htmlFor="diagnosis">Diagnosis / Impression</Label>
                    <Textarea
                      id="diagnosis"
                      value={clearanceForm.diagnosis}
                      onChange={(event) => updateClearanceField('diagnosis', event.target.value)}
                      className="mt-2 h-28 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                      maxLength={MAX_CLEARANCE_DIAGNOSIS_LENGTH}
                      rows={4}
                    />
                  </div>

                  <div className="xl:col-span-6">
                    <Label htmlFor="remarks">Clearance Remarks</Label>
                    <Textarea
                      id="remarks"
                      value={clearanceForm.remarks}
                      onChange={(event) => updateClearanceField('remarks', event.target.value)}
                      className="mt-2 h-28 resize-none overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap"
                      maxLength={MAX_CLEARANCE_REMARKS_LENGTH}
                      rows={4}
                      placeholder="State whether the student is fit, fit with recommendations, or needs follow-up."
                    />
                  </div>
                </div>
              ) : null}
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
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => previousReviewStep && changeReviewStep(previousReviewStep)}
              disabled={!previousReviewStep}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            {nextReviewStep ? (
              <Button type="button" onClick={() => changeReviewStep(nextReviewStep)}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-semibold text-foreground">
              {isDoctorWorkspace ? 'Finalize the clinic review' : 'Finalize the clearance'}
            </p>
          </div>

          {!isApprovedLocked ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                variant="outline"
                onClick={() => queueBackgroundReview('save', isArchiveEditMode ? 'approved' : undefined)}
                disabled={backgroundReviewMutation.isPending}
                loading={backgroundReviewMutation.isPending && savingAction === 'save'}
              >
                <Save className="mr-2 h-4 w-4" />
                {backgroundReviewMutation.isPending && savingAction === 'save' ? 'Saving...' : 'Save Review'}
              </Button>
              {!isArchiveEditMode ? (
                <Button variant="destructive" onClick={() => {
                  setReturnReason(staffNotes);
                  setShowReturnDialog(true);
                }} disabled={backgroundReviewMutation.isPending}>
                  Decline
                </Button>
              ) : null}
              {canFinalizeClearance && !isArchiveEditMode ? (
                <Button
                  onClick={() => queueBackgroundReview('cleared', 'approved')}
                  disabled={backgroundReviewMutation.isPending}
                  loading={backgroundReviewMutation.isPending && savingAction === 'cleared'}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {backgroundReviewMutation.isPending && savingAction === 'cleared' ? 'Clearing...' : 'Cleared'}
                </Button>
              ) : null}
            </div>
          ) : (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Cleared</Badge>
          )}
        </CardContent>
      </Card>

      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Submission</DialogTitle>
            <DialogDescription>
              Provide clear instructions or reasons for declining this medical record. The student will see this note on their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="returnReason" className="mb-2 block">Correction Message</Label>
            <Textarea
              id="returnReason"
              value={returnReason}
              onChange={(event) => setReturnReason(sanitizeSafeText(event.target.value, MAX_CLINIC_NOTES_LENGTH))}
              placeholder="e.g. Please re-upload a clearer copy of your X-Ray result or complete the missing fields."
              maxLength={MAX_CLINIC_NOTES_LENGTH}
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const sanitizedReturnReason = sanitizeSafeText(returnReason, MAX_CLINIC_NOTES_LENGTH).trim();
                setStaffNotes(sanitizedReturnReason);
                queueBackgroundReview('pending', 'returned', sanitizedReturnReason);
                setShowReturnDialog(false);
              }}
              disabled={!returnReason.trim() || backgroundReviewMutation.isPending}
              loading={backgroundReviewMutation.isPending && savingAction === 'pending'}
            >
              {backgroundReviewMutation.isPending && savingAction === 'pending' ? 'Declining...' : 'Confirm Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
