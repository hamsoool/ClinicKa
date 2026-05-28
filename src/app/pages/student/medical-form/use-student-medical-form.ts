import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AuthMe } from '../../../lib/api';
import type { SubmissionRecord } from '../../../lib/record-types';
import { getMe, getStudentRecords, getSubmission, submitMedicalRecord, updateMedicalRecord, uploadFile } from '../../../lib/api';
import {
  getDefaultAcademicYear,
  getNextSubmissionSlot,
  getRecordAcademicYear,
  getSubmissionSlotLabel,
  normalizeAcademicYear,
} from '../../../lib/academic-year';
import { useActiveAcademicYearSettingsQuery } from '../../../lib/academic-year-query';
import { invalidateStudentRecordsQuery } from '../student-records-query';
import { useStudentProfileAssetsQuery } from '../student-profile-assets-query';
import {
  DEFAULT_MEDICAL_HISTORY,
  formatPhilippinePhoneInput,
  isValidPhilippinePhoneNumber,
  normalizeProgramForDepartment,
  resolveDepartmentValue,
} from './constants';
import type {
  BmiCategory,
  EmergencyContact,
  LabUploadKind,
  MedicalConditionKey,
  MedicalFormData,
  MedicalHistoryState,
} from './types';

type UseStudentMedicalFormArgs = {
  year?: string;
  me?: AuthMe | null;
  editSubmissionId?: string | null;
  initialDataPrivacyConsent?: boolean;
};

const TOTAL_STEPS = 5;
const COURSE_REGEX = /^[A-Za-z][A-Za-z\s.'&()/-]*$/;
const SQL_INJECTION_REGEX = /(\b(select|insert|update|delete|drop|truncate|union|alter)\b)|(--|\/\*|\*\/|;)/i;
const MAX_NAME_LENGTH = 30;
const MAX_ADDRESS_LENGTH = 180;
const MAX_CLINIC_NAME_LENGTH = 60;
const MAX_TEST_SITE_OTHER_LENGTH = 50;
const MAX_OTHER_MEDICAL_HISTORY_LENGTH = 20;
const MIN_AGE = 15;
const LAB_RESULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const LAB_RESULT_MAX_FILE_SIZE_LABEL = '5 MB';
const LAB_RESULT_AUTO_OPTIMIZE_THRESHOLD_LABEL = '1 MB';
const LAB_RESULT_ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'heic', 'heif', 'webp', 'avif', 'gif', 'bmp', 'tif', 'tiff'];
const LAB_RESULT_ACCEPT_ATTRIBUTE = '.pdf,.png,.jpg,.jpeg,.heic,.heif,.webp,.avif,.gif,.bmp,.tif,.tiff,image/*,application/pdf';
const CLINIC_INTERNAL_LAB_SOURCE = 'James L. Gordon Hospital';

const LAB_UPLOAD_FIELD_CONFIG: Record<
  LabUploadKind,
  {
    fileField: 'cbcFile' | 'urinalysisFile' | 'xrayFile';
    label: string;
  }
> = {
  cbc: {
    fileField: 'cbcFile',
    label: 'CBC result',
  },
  urinalysis: {
    fileField: 'urinalysisFile',
    label: 'Urinalysis result',
  },
  xray: {
    fileField: 'xrayFile',
    label: 'X-Ray result',
  },
};

function normalizeStudentId(value: string) {
  return String(value || '').replace(/\D/g, '').slice(0, 9);
}

function normalizeMiddleInitial(value: string) {
  const letter = String(value || '').replace(/[^A-Za-z]/g, '').slice(0, 1);
  return letter;
}


function sanitizeName(value: string) {
  return value.normalize('NFC').replace(/[^\p{L}\s'-]/gu, '').slice(0, MAX_NAME_LENGTH);
}

function sanitizeCourse(value: string) {
  return value.replace(/[^A-Za-z\s.'&()/-]/g, '').slice(0, MAX_NAME_LENGTH);
}

function sanitizeTestSiteOther(value: string) {
  return String(value).replace(/[^A-Za-z0-9\s]/g, '').slice(0, MAX_TEST_SITE_OTHER_LENGTH);
}

function sanitizeAddress(value: string) {
  return value
    .replace(/[<>`]/g, '')
    .replace(/--|\/\*|\*\//g, '')
    .slice(0, MAX_ADDRESS_LENGTH);
}

function sanitizeSafeText(value: string, maxLength: number) {
  return value
    .replace(/[<>`]/g, '')
    .replace(/--|\/\*|\*\//g, '')
    .slice(0, maxLength);
}

function sanitizeEmergencyRelationship(value: string) {
  return sanitizeName(value);
}

function sanitizeOtherMedicalHistory(value: string) {
  return String(value).replace(/[^A-Za-z\s]/g, '').slice(0, MAX_OTHER_MEDICAL_HISTORY_LENGTH);
}

function sanitizeDigits(value: string, maxLen?: number) {
  const digits = value.replace(/\D/g, '');
  return maxLen ? digits.slice(0, maxLen) : digits;
}

function getMaxBirthdateIso(minAge: number) {
  const today = new Date();
  const max = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  return max.toISOString().split('T')[0];
}

function calculateAgeFromBirthdate(dateValue: string) {
  if (!dateValue) return null;

  const birthdate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(birthdate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const monthDelta = today.getMonth() - birthdate.getMonth();
  const hasBirthdayPassed =
    monthDelta > 0 || (monthDelta === 0 && today.getDate() >= birthdate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function isAtLeastAge(dateValue: string, minAge: number) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const maxBirthdate = new Date(getMaxBirthdateIso(minAge));
  return date <= maxBirthdate;
}

function getFileExtension(file?: File | null) {
  const fileName = String(file?.name || '');
  return fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
}

function isAllowedLabResultFile(file?: File | null) {
  if (!file) return false;
  const mimeType = String(file.type || '').toLowerCase();
  const extension = getFileExtension(file);
  return mimeType === 'application/pdf' || mimeType.startsWith('image/') || LAB_RESULT_ALLOWED_EXTENSIONS.includes(extension);
}

function resolveSelectedLabSource(primaryValue: string, otherValue: string) {
  return String(primaryValue === 'Others' ? otherValue : primaryValue).trim();
}

function isClinicManagedLabSource(primaryValue: string, otherValue: string) {
  return resolveSelectedLabSource(primaryValue, otherValue).toLowerCase() === CLINIC_INTERNAL_LAB_SOURCE.toLowerCase();
}

function buildInitialFormData(year: string | undefined, me?: AuthMe | null, initialDataPrivacyConsent = false): MedicalFormData {
  const student = me?.student;
  const department = resolveDepartmentValue(student?.department || me?.profile.department || 'CCS');
  const birthday = student?.birthday || '';
  const derivedAge = calculateAgeFromBirthdate(birthday);
  return {
    studentId: normalizeStudentId(student?.student_id || me?.profile.student_id || ''),
    firstName: sanitizeName(student?.first_name || me?.profile.first_name || ''),
    lastName: sanitizeName(student?.last_name || me?.profile.last_name || ''),
    middleInitial: normalizeMiddleInitial(student?.middle_initial || ''),
    department,
    course: normalizeProgramForDepartment(department, student?.course || me?.profile.course || ''),
    yearLevel: year || '1',
    age: derivedAge !== null ? sanitizeDigits(String(derivedAge), 2) : student?.age ? sanitizeDigits(String(student.age), 2) : '',
    sex: student?.sex || 'female',
    birthday,
    civilStatus: student?.civil_status || 'Single',
    contactNumber: formatPhilippinePhoneInput(student?.contact_number || ''),
    address: sanitizeAddress(student?.address || ''),
    medicalHistory: { ...DEFAULT_MEDICAL_HISTORY },
    otherMedicalHistory: '',
    allergyDetails: '',
    hadOperation: 'no',
    operationDetails: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
      address: '',
    },
    dataPrivacyConsent: initialDataPrivacyConsent,
    weight: '',
    height: '',
    bmi: '',
    cbcFile: null,
    urinalysisFile: null,
    xrayFile: null,
    existingCbcFileUrl: '',
    existingUrinalysisFileUrl: '',
    existingXrayFileUrl: '',
    cbcTestSite: '',
    cbcTestSiteOther: '',
    urinalysisTestSite: '',
    urinalysisTestSiteOther: '',
    xrayTestSite: '',
    xrayTestSiteOther: '',
    physicalCopyAgreement: false,
    submissionConfirmed: false,
    year: year || '1',
  };
}

function calculateBmi(weight: string, height: string): string {
  const weightValue = parseFloat(weight);
  const heightInMeters = parseFloat(height) / 100;

  if (weightValue > 0 && heightInMeters > 0) {
    return (weightValue / (heightInMeters * heightInMeters)).toFixed(2);
  }

  return '';
}

export function useStudentMedicalForm({
  year,
  me,
  editSubmissionId = null,
  initialDataPrivacyConsent = false,
}: UseStudentMedicalFormArgs) {
  const queryClient = useQueryClient();
  const student = me?.student;
  const { data: academicYearSettings } = useActiveAcademicYearSettingsQuery();
  const activeAcademicYear = normalizeAcademicYear(academicYearSettings?.academicYear || getDefaultAcademicYear());
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [originalSubmissionStatus, setOriginalSubmissionStatus] = useState<string | null>(null);
  const [formData, setFormData] = useState<MedicalFormData>(() => buildInitialFormData(year, me, initialDataPrivacyConsent));
  const maxBirthdate = useMemo(() => getMaxBirthdateIso(MIN_AGE), []);
  const profileAssetStudentId = me?.student?.student_id || me?.profile.student_id || '';
  const profileAssetProfileId = me?.student?.profile_id || me?.profile.id || '';
  const profileAssetsQuery = useStudentProfileAssetsQuery(profileAssetStudentId, profileAssetProfileId);
  const profileAssetUrls = {
    photoUrl: profileAssetsQuery.data?.photoUrl || null,
    signatureUrl: profileAssetsQuery.data?.signatureUrl || null,
  };
  const profileAssetsLoading = Boolean(
    profileAssetStudentId &&
      profileAssetProfileId &&
      (profileAssetsQuery.isLoading || (profileAssetsQuery.isFetching && !profileAssetsQuery.data)),
  );

  useEffect(() => {
    let active = true;

    const loadFreshProfileSnapshot = async () => {
      try {
        const latestMe = await getMe();
        if (!active) return;

        const latestStudent = latestMe?.student;
        const latestProfile = latestMe?.profile;
        const latestBirthday = latestStudent?.birthday || '';
        const derivedAge = calculateAgeFromBirthdate(latestBirthday);

        setFormData((prev) => ({
          ...prev,
          studentId: normalizeStudentId(latestStudent?.student_id || latestProfile?.student_id || prev.studentId),
          firstName: sanitizeName(latestStudent?.first_name || latestProfile?.first_name || prev.firstName),
          lastName: sanitizeName(latestStudent?.last_name || latestProfile?.last_name || prev.lastName),
          middleInitial: normalizeMiddleInitial(latestStudent?.middle_initial || prev.middleInitial),
          department: resolveDepartmentValue(latestStudent?.department || latestProfile?.department || prev.department),
          course: normalizeProgramForDepartment(
            latestStudent?.department || latestProfile?.department || prev.department,
            latestStudent?.course || latestProfile?.course || prev.course,
          ),
          age: derivedAge !== null ? sanitizeDigits(String(derivedAge), 2) : latestStudent?.age ? sanitizeDigits(String(latestStudent.age), 2) : prev.age,
          sex: latestStudent?.sex || prev.sex,
          birthday: latestBirthday || prev.birthday,
          civilStatus: latestStudent?.civil_status || prev.civilStatus,
          contactNumber: formatPhilippinePhoneInput(latestStudent?.contact_number || prev.contactNumber),
          address: sanitizeAddress(latestStudent?.address || prev.address),
        }));
      } catch {
        if (!active) return;
      }
    };

    void loadFreshProfileSnapshot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSubmitted(false);
    setStep(1);
    setUploading(false);
    setActiveSubmissionId(null);
    setOriginalSubmissionStatus(null);
    setFormData(buildInitialFormData(year, me, initialDataPrivacyConsent));
  }, [year, me, editSubmissionId, initialDataPrivacyConsent]);

  useEffect(() => {
    if (!editSubmissionId) return;
    let active = true;

    const loadSubmissionForEdit = async () => {
      try {
        const response = await getSubmission(editSubmissionId);
        const submission = response?.submission as SubmissionRecord | undefined;
        if (!active || !submission) return;

        setActiveSubmissionId(submission.id || null);
        setOriginalSubmissionStatus(submission.status || null);
        setFormData((prev) => ({
          ...prev,
          studentId: normalizeStudentId(prev.studentId || submission.studentId),
          firstName: sanitizeName(prev.firstName || submission.firstName || ''),
          lastName: sanitizeName(prev.lastName || submission.lastName || ''),
          middleInitial: normalizeMiddleInitial(prev.middleInitial || submission.middleInitial || ''),
          department: resolveDepartmentValue(prev.department || submission.department || ''),
          course: normalizeProgramForDepartment(
            prev.department || submission.department || '',
            prev.course || submission.course || '',
          ),
          yearLevel: submission.year || prev.yearLevel,
          year: submission.year || prev.year,
          age: (() => {
            const chosenBirthday = prev.birthday || submission.birthday || '';
            const derivedAge = calculateAgeFromBirthdate(chosenBirthday);
            return derivedAge !== null
              ? sanitizeDigits(String(derivedAge), 2)
              : sanitizeDigits(prev.age || submission.age || '', 2);
          })(),
          sex: prev.sex || submission.sex || '',
          birthday: prev.birthday || submission.birthday || '',
          civilStatus: prev.civilStatus || submission.civilStatus || '',
          contactNumber: formatPhilippinePhoneInput(prev.contactNumber || submission.contactNumber || ''),
          address: sanitizeAddress(prev.address || submission.address || ''),
          medicalHistory: {
            ...DEFAULT_MEDICAL_HISTORY,
            ...(submission.medicalHistory || {}),
          },
          otherMedicalHistory: sanitizeOtherMedicalHistory((submission as any).otherMedicalHistory || ''),
          allergyDetails: sanitizeSafeText(submission.allergyDetails || prev.allergyDetails, 120),
          hadOperation: submission.hadOperation || prev.hadOperation,
          operationDetails: sanitizeSafeText(submission.operationDetails || prev.operationDetails, 120),
          emergencyContact: {
            ...prev.emergencyContact,
            ...(submission.emergencyContact || {}),
            name: sanitizeName(submission.emergencyContact?.name || prev.emergencyContact.name),
            relationship: sanitizeEmergencyRelationship(submission.emergencyContact?.relationship || prev.emergencyContact.relationship),
            phone: formatPhilippinePhoneInput(submission.emergencyContact?.phone || prev.emergencyContact.phone),
            address: sanitizeAddress(submission.emergencyContact?.address || prev.emergencyContact.address),
          },
          weight: submission.weight || prev.weight,
          height: submission.height || prev.height,
          bmi: submission.bmi || prev.bmi,
          cbcTestSite: sanitizeSafeText((submission as any).cbcTestClinic || '', MAX_CLINIC_NAME_LENGTH),
          urinalysisTestSite: sanitizeSafeText((submission as any).urinalysisTestClinic || '', MAX_CLINIC_NAME_LENGTH),
          xrayTestSite: sanitizeSafeText((submission as any).xrayTestClinic || '', MAX_CLINIC_NAME_LENGTH),
          cbcTestSiteOther: '',
          urinalysisTestSiteOther: '',
          xrayTestSiteOther: '',
          cbcFile: null,
          urinalysisFile: null,
          xrayFile: null,
          existingCbcFileUrl: submission.cbcFileUrl || '',
          existingUrinalysisFileUrl: submission.urinalysisFileUrl || '',
          existingXrayFileUrl: submission.xrayFileUrl || '',
          submissionConfirmed: false,
        }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load returned record for editing');
      }
    };

    void loadSubmissionForEdit();
    return () => {
      active = false;
    };
  }, [editSubmissionId]);

  useEffect(() => {
    if (editSubmissionId) return;
    const studentId = normalizeStudentId(me?.student?.student_id || me?.profile.student_id || '');
    if (!studentId || !year) return;
    let active = true;

    const resolveCategoryAndPrefill = async () => {
      try {
        const response = await getStudentRecords(studentId, { includeProfileAssetsFallback: false });
        const records = (response?.records || []) as SubmissionRecord[];
        const hasAnyRecords = records.length > 0;
        if (!active) return;
        if (!hasAnyRecords) return;
        const latest = [...records].sort(
          (a, b) =>
            new Date(b?.updatedAt || b?.submittedAt || 0).getTime() -
            new Date(a?.updatedAt || a?.submittedAt || 0).getTime(),
        )[0];
        if (!latest || !active) return;

        setFormData((prev) => ({
          ...prev,
          medicalHistory: {
            ...prev.medicalHistory,
            ...(latest.medicalHistory || {}),
          },
          otherMedicalHistory: sanitizeOtherMedicalHistory((latest as any).otherMedicalHistory || prev.otherMedicalHistory || ''),
          allergyDetails: sanitizeSafeText(latest.allergyDetails || prev.allergyDetails || '', 120),
          hadOperation: (latest.hadOperation as 'yes' | 'no') || prev.hadOperation,
          operationDetails: sanitizeSafeText(latest.operationDetails || prev.operationDetails || '', 120),
          emergencyContact: {
            ...prev.emergencyContact,
            ...(latest.emergencyContact || {}),
            name: sanitizeName(latest.emergencyContact?.name || prev.emergencyContact.name || ''),
            relationship: sanitizeEmergencyRelationship(latest.emergencyContact?.relationship || prev.emergencyContact.relationship || ''),
            phone: formatPhilippinePhoneInput(latest.emergencyContact?.phone || prev.emergencyContact.phone || ''),
            address: sanitizeAddress(latest.emergencyContact?.address || prev.emergencyContact.address || ''),
          },
          cbcTestSite: sanitizeSafeText((latest as any).cbcTestClinic || prev.cbcTestSite || '', MAX_CLINIC_NAME_LENGTH),
          urinalysisTestSite: sanitizeSafeText((latest as any).urinalysisTestClinic || prev.urinalysisTestSite || '', MAX_CLINIC_NAME_LENGTH),
          xrayTestSite: sanitizeSafeText((latest as any).xrayTestClinic || prev.xrayTestSite || '', MAX_CLINIC_NAME_LENGTH),
        }));
      } catch {
        if (!active) return;
      }
    };

    void resolveCategoryAndPrefill();
    return () => {
      active = false;
    };
  }, [activeAcademicYear, editSubmissionId, me?.profile.student_id, me?.student?.student_id, year]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      studentId: normalizeStudentId(student?.student_id || me?.profile.student_id || prev.studentId),
      firstName: sanitizeName(student?.first_name || me?.profile.first_name || prev.firstName),
      lastName: sanitizeName(student?.last_name || me?.profile.last_name || prev.lastName),
      middleInitial: normalizeMiddleInitial(student?.middle_initial || prev.middleInitial),
      department: resolveDepartmentValue(student?.department || me?.profile.department || prev.department),
      course: normalizeProgramForDepartment(
        student?.department || me?.profile.department || prev.department,
        student?.course || me?.profile.course || prev.course,
      ),
      age: (() => {
        const latestBirthday = student?.birthday || prev.birthday;
        const derivedAge = calculateAgeFromBirthdate(latestBirthday);
        return derivedAge !== null ? sanitizeDigits(String(derivedAge), 2) : student?.age ? sanitizeDigits(String(student.age), 2) : prev.age;
      })(),
      sex: student?.sex || prev.sex,
      birthday: student?.birthday || prev.birthday,
      civilStatus: student?.civil_status || prev.civilStatus,
      contactNumber: formatPhilippinePhoneInput(student?.contact_number || prev.contactNumber),
      address: sanitizeAddress(student?.address || prev.address),
      dataPrivacyConsent: initialDataPrivacyConsent,
      yearLevel: year || prev.yearLevel,
      year: year || prev.year,
    }));
  }, [
    me?.profile.course,
    me?.profile.department,
    me?.profile.first_name,
    me?.profile.last_name,
    me?.profile.student_id,
    student?.address,
    student?.age,
    student?.birthday,
    student?.civil_status,
    student?.contact_number,
    student?.course,
    student?.department,
    student?.first_name,
    student?.last_name,
    student?.middle_initial,
    student?.sex,
    student?.student_id,
    year,
    initialDataPrivacyConsent,
  ]);

  const updateField = useCallback(<K extends keyof MedicalFormData>(field: K, value: MedicalFormData[K]) => {
    if (field === 'studentId') return setFormData((prev) => ({ ...prev, studentId: sanitizeDigits(String(value), 9) }));
    if (field === 'firstName') return setFormData((prev) => ({ ...prev, firstName: sanitizeName(String(value)) }));
    if (field === 'lastName') return setFormData((prev) => ({ ...prev, lastName: sanitizeName(String(value)) }));
    if (field === 'middleInitial') return setFormData((prev) => ({ ...prev, middleInitial: sanitizeName(String(value)).slice(0, 1) }));
    if (field === 'department') {
      const department = resolveDepartmentValue(String(value));
      return setFormData((prev) => ({ ...prev, department, course: '' }));
    }
    if (field === 'course') {
      return setFormData((prev) => ({
        ...prev,
        course: normalizeProgramForDepartment(prev.department, sanitizeCourse(String(value))),
      }));
    }
    if (field === 'birthday') {
      return setFormData((prev) => {
        const birthday = String(value);
        const derivedAge = calculateAgeFromBirthdate(birthday);
        return {
          ...prev,
          birthday,
          age: derivedAge !== null ? sanitizeDigits(String(derivedAge), 2) : '',
        };
      });
    }
    if (field === 'age') return setFormData((prev) => ({ ...prev, age: sanitizeDigits(String(value), 2) }));
    if (field === 'contactNumber') {
      return setFormData((prev) => ({
        ...prev,
        contactNumber: formatPhilippinePhoneInput(String(value)),
      }));
    }
    if (field === 'address') return setFormData((prev) => ({ ...prev, address: sanitizeAddress(String(value)) }));
    if (field === 'allergyDetails') {
      return setFormData((prev) => ({ ...prev, allergyDetails: sanitizeSafeText(String(value), 120) }));
    }
    if (field === 'otherMedicalHistory') {
      return setFormData((prev) => ({ ...prev, otherMedicalHistory: sanitizeOtherMedicalHistory(String(value)) }));
    }
    if (field === 'cbcTestSiteOther') return setFormData((prev) => ({ ...prev, cbcTestSiteOther: sanitizeTestSiteOther(String(value)) }));
    if (field === 'urinalysisTestSiteOther') return setFormData((prev) => ({ ...prev, urinalysisTestSiteOther: sanitizeTestSiteOther(String(value)) }));
    if (field === 'xrayTestSiteOther') return setFormData((prev) => ({ ...prev, xrayTestSiteOther: sanitizeTestSiteOther(String(value)) }));
    if (field === 'operationDetails') {
      const safe = sanitizeSafeText(String(value), 120);
      if (SQL_INJECTION_REGEX.test(safe)) return;
      return setFormData((prev) => ({ ...prev, operationDetails: safe }));
    }
    if (field === 'yearLevel') return setFormData((prev) => ({ ...prev, yearLevel: year || String(value) }));

    setFormData((prev) => ({ ...prev, [field]: value }));
  }, [year]);

  const updateEmergencyContact = useCallback(
    <K extends keyof EmergencyContact>(field: K, value: EmergencyContact[K]) => {
      setFormData((prev) => ({
        ...prev,
        emergencyContact: {
          ...prev.emergencyContact,
          [field]:
            field === 'name'
              ? sanitizeName(value)
              : field === 'relationship'
                ? sanitizeEmergencyRelationship(value)
              : field === 'phone'
                ? formatPhilippinePhoneInput(value)
                : sanitizeAddress(value),
        },
      }));
    },
    [],
  );

  const updateMedicalCondition = useCallback((condition: MedicalConditionKey, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      ...(condition === 'others' && !checked ? { otherMedicalHistory: '' } : {}),
      medicalHistory: {
        ...prev.medicalHistory,
        [condition]: checked,
      } as MedicalHistoryState,
    }));
  }, []);

  const updateMeasurement = useCallback((field: 'weight' | 'height', value: string) => {
    const nextInput = sanitizeDigits(value, 3);

    setFormData((prev) => {
      const next = {
        ...prev,
        [field]: nextInput,
      };

      if (field === 'weight' || field === 'height') {
        next.bmi = calculateBmi(field === 'weight' ? nextInput : next.weight, field === 'height' ? nextInput : next.height);
      }

      return next;
    });
  }, []);

  const updateLabFile = useCallback((kind: LabUploadKind, nextFile: File | null) => {
    const config = LAB_UPLOAD_FIELD_CONFIG[kind];

    if (!nextFile) {
      setFormData((prev) => ({
        ...prev,
        [config.fileField]: null,
      }));
      return;
    }

    if (nextFile.size > LAB_RESULT_MAX_FILE_SIZE_BYTES) {
      toast.error(`${config.label} must be ${LAB_RESULT_MAX_FILE_SIZE_LABEL} or smaller.`);
      return;
    }

    if (!isAllowedLabResultFile(nextFile)) {
      toast.error(`${config.label} must be a PDF or supported image file.`);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [config.fileField]: nextFile,
    }));
  }, []);

  const getBmiCategory = useCallback((bmi: string): BmiCategory => {
    const bmiValue = parseFloat(bmi);
    if (bmiValue < 18.5) return { category: 'Underweight', color: 'text-blue-600' };
    if (bmiValue < 25) return { category: 'Normal', color: 'text-green-600' };
    if (bmiValue < 30) return { category: 'Overweight', color: 'text-yellow-600' };
    return { category: 'Obese', color: 'text-red-600' };
  }, []);

  const hasRequiredProfileFields = useMemo(
    () =>
      Boolean(
        formData.firstName?.trim() &&
          formData.lastName?.trim() &&
          normalizeMiddleInitial(formData.middleInitial).length === 1 &&
          normalizeStudentId(formData.studentId).length === 9 &&
          formData.department &&
          formData.course &&
          formData.age &&
          formData.sex &&
          formData.birthday &&
          formData.civilStatus &&
          formData.contactNumber?.trim() &&
          formData.address?.trim() &&
          isValidPhilippinePhoneNumber(formData.contactNumber) &&
          isAtLeastAge(formData.birthday, MIN_AGE),
      ),
    [formData],
  );
  const hasProfilePhoto = Boolean(profileAssetUrls.photoUrl);
  const hasProfileSignature = Boolean(profileAssetUrls.signatureUrl);
  const hasCbcFile = Boolean(formData.cbcFile || formData.existingCbcFileUrl);
  const hasUrinalysisFile = Boolean(formData.urinalysisFile || formData.existingUrinalysisFileUrl);
  const hasXrayFile = Boolean(formData.xrayFile || formData.existingXrayFileUrl);
  const requiresCbcFile = !isClinicManagedLabSource(formData.cbcTestSite, formData.cbcTestSiteOther);
  const requiresUrinalysisFile = !isClinicManagedLabSource(formData.urinalysisTestSite, formData.urinalysisTestSiteOther);
  const requiresXrayFile = !isClinicManagedLabSource(formData.xrayTestSite, formData.xrayTestSiteOther);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return hasRequiredProfileFields && hasProfilePhoto && hasProfileSignature;
      case 2:
        return !formData.medicalHistory.others || Boolean(formData.otherMedicalHistory.trim());
      case 3:
        return (
          formData.hadOperation &&
          formData.emergencyContact.name &&
          formData.emergencyContact.relationship &&
          formData.emergencyContact.phone &&
          isValidPhilippinePhoneNumber(formData.emergencyContact.phone) &&
          formData.emergencyContact.address
        );
      case 4:
        return Boolean(
          formData.cbcTestSite.trim() &&
            formData.urinalysisTestSite.trim() &&
            formData.xrayTestSite.trim() &&
            (!requiresCbcFile || hasCbcFile) &&
            (!requiresUrinalysisFile || hasUrinalysisFile) &&
            (!requiresXrayFile || hasXrayFile) &&
            formData.physicalCopyAgreement &&
            (formData.cbcTestSite !== 'Others' || Boolean(formData.cbcTestSiteOther.trim())) &&
            (formData.urinalysisTestSite !== 'Others' || Boolean(formData.urinalysisTestSiteOther.trim())) &&
            (formData.xrayTestSite !== 'Others' || Boolean(formData.xrayTestSiteOther.trim())),
        );
      case 5:
        return true;
      default:
        return false;
    }
  }, [formData, hasCbcFile, hasProfilePhoto, hasProfileSignature, hasRequiredProfileFields, hasUrinalysisFile, hasXrayFile, requiresCbcFile, requiresUrinalysisFile, requiresXrayFile, step]);

  const canSubmit = useMemo(
    () => {
      return Boolean(
        hasRequiredProfileFields &&
          formData.yearLevel &&
          formData.sex &&
        formData.hadOperation &&
        formData.emergencyContact.name &&
        formData.emergencyContact.relationship &&
        formData.emergencyContact.phone &&
        isValidPhilippinePhoneNumber(formData.emergencyContact.phone) &&
        formData.emergencyContact.address &&
        formData.cbcTestSite.trim() &&
        formData.urinalysisTestSite.trim() &&
        formData.xrayTestSite.trim() &&
        (!requiresCbcFile || hasCbcFile) &&
        (!requiresUrinalysisFile || hasUrinalysisFile) &&
        (!requiresXrayFile || hasXrayFile) &&
        formData.physicalCopyAgreement &&
        (formData.cbcTestSite !== 'Others' || Boolean(formData.cbcTestSiteOther.trim())) &&
        (formData.urinalysisTestSite !== 'Others' || Boolean(formData.urinalysisTestSiteOther.trim())) &&
        (formData.xrayTestSite !== 'Others' || Boolean(formData.xrayTestSiteOther.trim())) &&
          (!formData.medicalHistory.others || Boolean(formData.otherMedicalHistory.trim())) &&
          COURSE_REGEX.test(formData.course) &&
          !SQL_INJECTION_REGEX.test(formData.address || '') &&
          formData.dataPrivacyConsent &&
          formData.submissionConfirmed &&
          (formData.hadOperation !== 'yes' || !SQL_INJECTION_REGEX.test(formData.operationDetails || '')) &&
          (!formData.otherMedicalHistory || /^[A-Za-z\s]{1,20}$/.test(formData.otherMedicalHistory)),
      );
    },
    [formData, hasCbcFile, hasRequiredProfileFields, hasUrinalysisFile, hasXrayFile, requiresCbcFile, requiresUrinalysisFile, requiresXrayFile],
  );

  const submitBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!hasRequiredProfileFields) blockers.push('Complete all required fields in Profile.');
    if (!formData.yearLevel) blockers.push('Submission slot could not be determined.');
    if (!formData.sex) blockers.push('Select your sex.');
    if (!formData.hadOperation) blockers.push('Answer the operation history question.');
    if (!formData.emergencyContact.name?.trim()) blockers.push('Enter your emergency contact name.');
    if (!formData.emergencyContact.relationship?.trim()) blockers.push('Select your emergency contact relationship.');
    if (!formData.emergencyContact.phone?.trim()) blockers.push('Enter your emergency contact phone number.');
    if (formData.emergencyContact.phone?.trim() && !isValidPhilippinePhoneNumber(formData.emergencyContact.phone)) {
      blockers.push('Enter a valid emergency contact Philippine mobile number.');
    }
    if (!formData.emergencyContact.address?.trim()) blockers.push('Enter your emergency contact address.');
    if (!formData.cbcTestSite.trim()) blockers.push('Select where you took your CBC test.');
    if (!formData.urinalysisTestSite.trim()) blockers.push('Select where you took your Urinalysis test.');
    if (!formData.xrayTestSite.trim()) blockers.push('Select where you took your X-Ray test.');
    if (requiresCbcFile && !hasCbcFile) blockers.push('Upload your CBC laboratory result.');
    if (requiresUrinalysisFile && !hasUrinalysisFile) blockers.push('Upload your Urinalysis laboratory result.');
    if (requiresXrayFile && !hasXrayFile) blockers.push('Upload your X-Ray laboratory result.');
    if (formData.cbcTestSite === 'Others' && !formData.cbcTestSiteOther.trim()) blockers.push('Specify the CBC test clinic/lab.');
    if (formData.urinalysisTestSite === 'Others' && !formData.urinalysisTestSiteOther.trim()) blockers.push('Specify the Urinalysis test clinic/lab.');
    if (formData.xrayTestSite === 'Others' && !formData.xrayTestSiteOther.trim()) blockers.push('Specify the X-Ray test clinic/lab.');
    if (!formData.physicalCopyAgreement) blockers.push('Agree to bring physical copies of CBC, Urinalysis, and X-ray results.');
    if (formData.medicalHistory.others && !formData.otherMedicalHistory.trim()) blockers.push('Specify the "Others" medical condition.');
    if (formData.otherMedicalHistory && !/^[A-Za-z\s]{1,20}$/.test(formData.otherMedicalHistory)) {
      blockers.push('Others medical condition must be letters/spaces only (max 20 characters).');
    }
    if (formData.course && !COURSE_REGEX.test(formData.course)) blockers.push('Course contains invalid characters.');
    if (SQL_INJECTION_REGEX.test(formData.address || '')) blockers.push('Address contains invalid characters.');
    if (formData.hadOperation === 'yes' && SQL_INJECTION_REGEX.test(formData.operationDetails || '')) {
      blockers.push('Operation details contain invalid characters.');
    }
    if (!formData.submissionConfirmed) blockers.push('Check the final confirmation box.');
    if (!formData.dataPrivacyConsent) blockers.push('Data Privacy Consent is required.');
    return blockers;
  }, [formData, hasCbcFile, hasRequiredProfileFields, hasUrinalysisFile, hasXrayFile, requiresCbcFile, requiresUrinalysisFile, requiresXrayFile]);

  const previewRecord = useMemo<SubmissionRecord>(
    () => ({
      id: 'preview',
      studentId: formData.studentId,
      firstName: formData.firstName,
      lastName: formData.lastName,
      middleInitial: formData.middleInitial,
      course: formData.course,
      department: formData.department,
      year: formData.yearLevel,
      academicYear: activeAcademicYear,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      age: formData.age,
      sex: formData.sex,
      birthday: formData.birthday,
      civilStatus: formData.civilStatus,
      contactNumber: formData.contactNumber,
      address: formData.address,
      emergencyContact: formData.emergencyContact,
      medicalHistory: formData.medicalHistory,
      otherMedicalHistory: formData.otherMedicalHistory,
      allergyDetails: formData.allergyDetails,
      hadOperation: formData.hadOperation,
      operationDetails: formData.operationDetails,
      weight: formData.weight,
      height: formData.height,
      bmi: formData.bmi,
      staffMeasurements: {
        weight: formData.weight,
        height: formData.height,
        bmi: formData.bmi,
      },
      cbcTestClinic: formData.cbcTestSite === 'Others' ? formData.cbcTestSiteOther : formData.cbcTestSite,
      urinalysisTestClinic: formData.urinalysisTestSite === 'Others' ? formData.urinalysisTestSiteOther : formData.urinalysisTestSite,
      xrayTestClinic: formData.xrayTestSite === 'Others' ? formData.xrayTestSiteOther : formData.xrayTestSite,
      photoUrl: profileAssetUrls.photoUrl || undefined,
      signatureUrl: profileAssetUrls.signatureUrl || undefined,
      cbcFileUrl: formData.existingCbcFileUrl || undefined,
      urinalysisFileUrl: formData.existingUrinalysisFileUrl || undefined,
      xrayFileUrl: formData.existingXrayFileUrl || undefined,
    }),
    [activeAcademicYear, formData, profileAssetUrls.photoUrl, profileAssetUrls.signatureUrl],
  );

  const submit = useCallback(async () => {
    if (uploading) return;
    if (!formData.physicalCopyAgreement) {
      toast.error('Please agree to bring physical copies of CBC, Urinalysis, and X-ray results before submitting.');
      return;
    }
    if ((requiresCbcFile && !hasCbcFile) || (requiresUrinalysisFile && !hasUrinalysisFile) || (requiresXrayFile && !hasXrayFile)) {
      toast.error('Please attach your CBC, Urinalysis, and X-Ray result files before submitting.');
      return;
    }
    if (!formData.submissionConfirmed) {
      toast.error('Please confirm that all details are complete before submitting.');
      return;
    }
    if (!formData.dataPrivacyConsent) {
      toast.error('Please read and agree to the data privacy consent before submitting.');
      return;
    }
    if (!canSubmit) {
      toast.error('Please fix invalid fields before submitting. Student ID must be 9 digits, age must be valid, and text fields must follow format rules.');
      return;
    }
    setUploading(true);
    try {
      const myStudentId = formData.studentId.trim();
      const existing = myStudentId
        ? await getStudentRecords(myStudentId, { includeProfileAssetsFallback: false })
        : { records: [] as SubmissionRecord[] };
      const existingRecords = (existing.records || []) as SubmissionRecord[];
      const expectedSlot = getNextSubmissionSlot(existingRecords, activeAcademicYear);
      if (!activeSubmissionId) {
        if (!expectedSlot) {
          throw new Error('All four year levels have already been used.');
        }
        if (Number.parseInt(String(formData.yearLevel || ''), 10) !== expectedSlot) {
          throw new Error(`This school year submission must use ${getSubmissionSlotLabel(expectedSlot)}.`);
        }
      }

      const payload = {
        studentId: formData.studentId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleInitial: formData.middleInitial,
        department: formData.department,
        course: formData.course,
        yearLevel: formData.yearLevel,
        academicYear: activeAcademicYear,
        age: formData.age,
        sex: formData.sex,
        birthday: formData.birthday,
        civilStatus: formData.civilStatus,
        contactNumber: formData.contactNumber,
        address: formData.address,
        medicalHistory: formData.medicalHistory,
        otherMedicalHistory: formData.otherMedicalHistory,
        allergyDetails: formData.allergyDetails,
        hadOperation: formData.hadOperation,
        operationDetails: formData.operationDetails,
        emergencyContact: formData.emergencyContact,
        dataPrivacyConsent: formData.dataPrivacyConsent,
        weight: formData.weight,
        height: formData.height,
        bmi: formData.bmi,
        cbcTestClinic: formData.cbcTestSite === 'Others' ? formData.cbcTestSiteOther.trim() : formData.cbcTestSite,
        urinalysisTestClinic: formData.urinalysisTestSite === 'Others' ? formData.urinalysisTestSiteOther.trim() : formData.urinalysisTestSite,
        xrayTestClinic: formData.xrayTestSite === 'Others' ? formData.xrayTestSiteOther.trim() : formData.xrayTestSite,
      };

      let recordId = activeSubmissionId;
      let isResubmission = Boolean(recordId && originalSubmissionStatus === 'returned');
      if (!recordId) {
        if (myStudentId && formData.yearLevel) {
          const latestSameAcademicYear = existingRecords
            .filter((item) => getRecordAcademicYear(item, activeAcademicYear) === activeAcademicYear)
            .sort(
              (a, b) =>
                new Date(b?.updatedAt || b?.submittedAt || 0).getTime() -
                new Date(a?.updatedAt || a?.submittedAt || 0).getTime(),
            )[0];
          const latestSameAcademicYearStatus = String(latestSameAcademicYear?.status || '').toLowerCase();
          const latestSameAcademicYearId = String(latestSameAcademicYear?.id || '').trim();

          // Safety: even without ?edit=... in URL, force resubmission to update
          // the latest returned record for this school year instead of creating a new row.
          if (latestSameAcademicYearStatus === 'returned' && latestSameAcademicYearId) {
            recordId = latestSameAcademicYearId;
            isResubmission = true;
            setActiveSubmissionId(latestSameAcademicYearId);
            setOriginalSubmissionStatus('returned');
          }

          if (latestSameAcademicYearStatus && latestSameAcademicYearStatus !== 'returned') {
            throw new Error(
              `You already have an SY ${activeAcademicYear} submission with status "${latestSameAcademicYearStatus}".`,
            );
          }
        }
        if (!recordId) {
          const result = await submitMedicalRecord(payload);
          recordId = result.recordId;
          setActiveSubmissionId(recordId);
        }
      } else {
        await updateMedicalRecord(recordId, {
          ...payload,
          status: isResubmission ? 'resubmitted' : undefined,
        });
      }

      if (recordId && isResubmission && !activeSubmissionId) {
        await updateMedicalRecord(recordId, {
          ...payload,
          status: 'resubmitted',
        });
      }

      if (!recordId) {
        throw new Error('Failed to identify or create medical record.');
      }

      const uploads = [
        { kind: 'cbc' as const, file: formData.cbcFile },
        { kind: 'urinalysis' as const, file: formData.urinalysisFile },
        { kind: 'xray' as const, file: formData.xrayFile },
      ];

      const uploadedUrls: Partial<Record<LabUploadKind, string>> = {};
      const uploadedFiles = await Promise.all(
        uploads
          .filter((uploadItem): uploadItem is { kind: LabUploadKind; file: File } => Boolean(uploadItem.file))
          .map(async (uploadItem) => {
            const result = await uploadFile(uploadItem.file, recordId, uploadItem.kind);
            return { kind: uploadItem.kind, url: result.url };
          }),
      );

      for (const result of uploadedFiles) {
        if (result.url) {
          uploadedUrls[result.kind] = result.url;
        }
      }

      if (Object.keys(uploadedUrls).length || formData.cbcFile || formData.urinalysisFile || formData.xrayFile) {
        setFormData((prev) => ({
          ...prev,
          cbcFile: null,
          urinalysisFile: null,
          xrayFile: null,
          existingCbcFileUrl: uploadedUrls.cbc || prev.existingCbcFileUrl || '',
          existingUrinalysisFileUrl: uploadedUrls.urinalysis || prev.existingUrinalysisFileUrl || '',
          existingXrayFileUrl: uploadedUrls.xray || prev.existingXrayFileUrl || '',
        }));
      }

      await invalidateStudentRecordsQuery(queryClient, formData.studentId);
      toast.success(isResubmission ? 'Medical record and laboratory files resubmitted successfully!' : 'Medical record and laboratory files submitted successfully!');
      setSubmitted(true);
      setActiveSubmissionId(null);
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit medical record');
    } finally {
      setUploading(false);
    }
  }, [activeAcademicYear, activeSubmissionId, canSubmit, formData, hasCbcFile, hasUrinalysisFile, hasXrayFile, originalSubmissionStatus, queryClient, uploading]);

  return {
    step,
    setStep,
    totalSteps: TOTAL_STEPS,
    formData,
    uploading,
    submitted,
    canProceed,
    canSubmit,
    submitBlockers,
    hasRequiredProfileFields,
    hasProfilePhoto,
    hasProfileSignature,
    profileAssetsLoading,
    labResultAccept: LAB_RESULT_ACCEPT_ATTRIBUTE,
    labResultMaxFileSizeLabel: LAB_RESULT_MAX_FILE_SIZE_LABEL,
    labResultAutoOptimizeThresholdLabel: LAB_RESULT_AUTO_OPTIMIZE_THRESHOLD_LABEL,
    hasCbcFile,
    hasUrinalysisFile,
    hasXrayFile,
    requiresCbcFile,
    requiresUrinalysisFile,
    requiresXrayFile,
    previewRecord,
    updateField,
    updateEmergencyContact,
    updateMedicalCondition,
    updateLabFile,
    updateMeasurement,
    getBmiCategory,
    maxBirthdate,
    submit,
  };
}
