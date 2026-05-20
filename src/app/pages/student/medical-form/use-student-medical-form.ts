import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AuthMe } from '../../../lib/api';
import type { SubmissionRecord } from '../../../lib/record-types';
import { getStudentProfileAssets, getStudentRecords, getSubmission, submitMedicalRecord, updateMedicalRecord, uploadFile } from '../../../lib/api';
import { invalidateStudentRecordsQuery } from '../student-records-query';
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

const TOTAL_STEPS = 6;
const NAME_REGEX = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
const COURSE_REGEX = /^[A-Za-z][A-Za-z\s.'&()/-]*$/;
const SQL_INJECTION_REGEX = /(\b(select|insert|update|delete|drop|truncate|union|alter)\b)|(--|\/\*|\*\/|;)/i;
const MAX_NAME_LENGTH = 30;
const MAX_ADDRESS_LENGTH = 180;
const MAX_CLINIC_NAME_LENGTH = 60;
const MIN_AGE = 15;
function normalizeStudentId(value: string) {
  return String(value || '').replace(/\D/g, '').slice(0, 9);
}

function normalizeMiddleInitial(value: string) {
  const letter = String(value || '').replace(/[^A-Za-z]/g, '').slice(0, 1);
  return letter;
}


function sanitizeName(value: string) {
  return value.replace(/[^A-Za-z\s'-]/g, '').slice(0, MAX_NAME_LENGTH);
}

function sanitizeCourse(value: string) {
  return value.replace(/[^A-Za-z\s.'&()/-]/g, '').slice(0, MAX_NAME_LENGTH);
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

function sanitizeDigits(value: string, maxLen?: number) {
  const digits = value.replace(/\D/g, '');
  return maxLen ? digits.slice(0, maxLen) : digits;
}

function getMaxBirthdateIso(minAge: number) {
  const today = new Date();
  const max = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  return max.toISOString().split('T')[0];
}

function isAtLeastAge(dateValue: string, minAge: number) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const maxBirthdate = new Date(getMaxBirthdateIso(minAge));
  return date <= maxBirthdate;
}

function buildInitialFormData(year: string | undefined, me?: AuthMe | null, initialDataPrivacyConsent = false): MedicalFormData {
  const student = me?.student;
  const department = resolveDepartmentValue(student?.department || me?.profile.department || 'CCS');
  return {
    studentId: normalizeStudentId(student?.student_id || me?.profile.student_id || ''),
    firstName: student?.first_name || me?.profile.first_name || '',
    lastName: student?.last_name || me?.profile.last_name || '',
    middleInitial: normalizeMiddleInitial(student?.middle_initial || ''),
    department,
    course: normalizeProgramForDepartment(department, student?.course || me?.profile.course || ''),
    yearLevel: year || '1',
    age: student?.age ? String(student.age) : '',
    sex: student?.sex || 'female',
    birthday: student?.birthday || '',
    civilStatus: student?.civil_status || 'Single',
    contactNumber: formatPhilippinePhoneInput(student?.contact_number || ''),
    address: student?.address || '',
    medicalHistory: { ...DEFAULT_MEDICAL_HISTORY },
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
    xrayFile: null,
    cbcFile: null,
    urinalysisFile: null,
    existingXrayFileUrl: '',
    existingCbcFileUrl: '',
    existingUrinalysisFileUrl: '',
    labTestLocation: '',
    otherClinicName: '',
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
  const [profileAssetUrls, setProfileAssetUrls] = useState<{ photoUrl: string | null; signatureUrl: string | null }>({
    photoUrl: null,
    signatureUrl: null,
  });
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [originalSubmissionStatus, setOriginalSubmissionStatus] = useState<string | null>(null);
  const [formData, setFormData] = useState<MedicalFormData>(() => buildInitialFormData(year, me, initialDataPrivacyConsent));
  const maxBirthdate = useMemo(() => getMaxBirthdateIso(MIN_AGE), []);
  const isEditingExistingSubmission = Boolean(activeSubmissionId);
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
          studentId: normalizeStudentId(submission.studentId || prev.studentId),
          firstName: submission.firstName || prev.firstName,
          lastName: submission.lastName || prev.lastName,
          middleInitial: normalizeMiddleInitial(submission.middleInitial || prev.middleInitial),
          department: resolveDepartmentValue(submission.department || prev.department),
          course: normalizeProgramForDepartment(submission.department || prev.department, submission.course || prev.course),
          yearLevel: submission.year || prev.yearLevel,
          year: submission.year || prev.year,
          age: submission.age || prev.age,
          sex: submission.sex || prev.sex,
          birthday: submission.birthday || prev.birthday,
          civilStatus: submission.civilStatus || prev.civilStatus,
          contactNumber: formatPhilippinePhoneInput(submission.contactNumber || prev.contactNumber),
          address: submission.address || prev.address,
          medicalHistory: {
            ...DEFAULT_MEDICAL_HISTORY,
            ...(submission.medicalHistory || {}),
          },
          allergyDetails: submission.allergyDetails || prev.allergyDetails,
          hadOperation: submission.hadOperation || prev.hadOperation,
          operationDetails: submission.operationDetails || prev.operationDetails,
          emergencyContact: {
            ...prev.emergencyContact,
            ...(submission.emergencyContact || {}),
            relationship: sanitizeEmergencyRelationship(submission.emergencyContact?.relationship || prev.emergencyContact.relationship),
            phone: formatPhilippinePhoneInput(submission.emergencyContact?.phone || prev.emergencyContact.phone),
          },
          weight: submission.weight || prev.weight,
          height: submission.height || prev.height,
          bmi: submission.bmi || prev.bmi,
          existingXrayFileUrl: (submission as any).xrayFileUrl || '',
          existingCbcFileUrl: (submission as any).cbcFileUrl || '',
          existingUrinalysisFileUrl: (submission as any).urinalysisFileUrl || '',
          labTestLocation: ((submission as any).labTestLocation || '') as '' | 'jlgh' | 'other',
          otherClinicName: (submission as any).otherClinicName || '',
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
    const studentId = me?.student?.student_id || me?.profile.student_id || '';
    const profileId = me?.student?.profile_id || me?.profile.id || '';
    if (!studentId || !profileId) {
      setProfileAssetUrls({ photoUrl: null, signatureUrl: null });
      return;
    }

    let active = true;

    const loadProfileAssets = async () => {
      try {
        const assets = await getStudentProfileAssets(studentId, profileId);
        if (!active) return;
        setProfileAssetUrls({
          photoUrl: assets.photoUrl || null,
          signatureUrl: assets.signatureUrl || null,
        });
      } catch {
        if (!active) return;
        setProfileAssetUrls({ photoUrl: null, signatureUrl: null });
      }
    };

    void loadProfileAssets();
    return () => {
      active = false;
    };
  }, [me?.profile.id, me?.profile.student_id, me?.student?.profile_id, me?.student?.student_id]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      studentId: normalizeStudentId(student?.student_id || me?.profile.student_id || prev.studentId),
      firstName: student?.first_name || me?.profile.first_name || prev.firstName,
      lastName: student?.last_name || me?.profile.last_name || prev.lastName,
      middleInitial: normalizeMiddleInitial(student?.middle_initial || prev.middleInitial),
      department: resolveDepartmentValue(student?.department || me?.profile.department || prev.department),
      course: normalizeProgramForDepartment(
        student?.department || me?.profile.department || prev.department,
        student?.course || me?.profile.course || prev.course,
      ),
      age: student?.age ? String(student.age) : prev.age,
      sex: student?.sex || prev.sex,
      birthday: student?.birthday || prev.birthday,
      civilStatus: student?.civil_status || prev.civilStatus,
      contactNumber: formatPhilippinePhoneInput(student?.contact_number || prev.contactNumber),
      address: student?.address || prev.address,
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
    if (field === 'age') return setFormData((prev) => ({ ...prev, age: sanitizeDigits(String(value), 2) }));
    if (field === 'contactNumber') {
      return setFormData((prev) => ({
        ...prev,
        contactNumber: formatPhilippinePhoneInput(String(value)),
      }));
    }
    if (field === 'address') return setFormData((prev) => ({ ...prev, address: sanitizeAddress(String(value)) }));
    if (field === 'otherClinicName') {
      const safe = sanitizeCourse(String(value)).slice(0, MAX_CLINIC_NAME_LENGTH);
      if (SQL_INJECTION_REGEX.test(safe)) return;
      return setFormData((prev) => ({ ...prev, otherClinicName: safe }));
    }
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

  const handleFileChange = useCallback((field: 'xrayFile' | 'cbcFile' | 'urinalysisFile', file: File | null) => {
    if (file && file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }
    setFormData((prev) => {
      const next = { ...prev, [field]: file };
      if (field === 'xrayFile' && file) next.existingXrayFileUrl = '';
      if (field === 'cbcFile' && file) next.existingCbcFileUrl = '';
      if (field === 'urinalysisFile' && file) next.existingUrinalysisFileUrl = '';
      return next;
    });
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

  const canProceed = useMemo(() => {
    const hasXray = Boolean(formData.xrayFile || formData.existingXrayFileUrl);
    const hasAllUploads = Boolean(
      (formData.xrayFile || formData.existingXrayFileUrl) &&
      (formData.cbcFile || formData.existingCbcFileUrl) &&
      (formData.urinalysisFile || formData.existingUrinalysisFileUrl),
    );

    switch (step) {
      case 1:
        return hasRequiredProfileFields && hasProfilePhoto && hasProfileSignature;
      case 2:
        return true;
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
        return (
          formData.weight &&
          formData.height &&
          /^\d{1,3}$/.test(formData.weight) &&
          /^\d{1,3}$/.test(formData.height)
        );
      case 5:
        if (!formData.labTestLocation) return false;
        if (formData.labTestLocation === 'jlgh') return true;
        return Boolean(
          formData.otherClinicName.trim() &&
            formData.otherClinicName.length <= MAX_CLINIC_NAME_LENGTH &&
            COURSE_REGEX.test(formData.otherClinicName) &&
            !SQL_INJECTION_REGEX.test(formData.otherClinicName) &&
            hasAllUploads,
        );
      case 6:
        return true;
      default:
        return false;
    }
  }, [formData, hasProfilePhoto, hasProfileSignature, hasRequiredProfileFields, step]);

  const canSubmit = useMemo(
    () => {
      const needsAllUploads = formData.labTestLocation === 'other';
      const hasXray = Boolean(formData.xrayFile || formData.existingXrayFileUrl);
      const hasAllUploads = Boolean(
        (formData.xrayFile || formData.existingXrayFileUrl) &&
        (formData.cbcFile || formData.existingCbcFileUrl) &&
        (formData.urinalysisFile || formData.existingUrinalysisFileUrl),
      );

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
          formData.weight &&
          formData.height &&
          formData.labTestLocation &&
          (formData.labTestLocation === 'jlgh' || hasXray) &&
          (formData.labTestLocation === 'jlgh' || formData.otherClinicName.trim()) &&
          (!needsAllUploads || hasAllUploads) &&
          NAME_REGEX.test(formData.firstName) &&
          NAME_REGEX.test(formData.lastName) &&
          COURSE_REGEX.test(formData.course) &&
          !SQL_INJECTION_REGEX.test(formData.address || '') &&
          formData.dataPrivacyConsent &&
          (formData.labTestLocation !== 'other' ||
            (COURSE_REGEX.test(formData.otherClinicName) &&
              formData.otherClinicName.length <= MAX_CLINIC_NAME_LENGTH &&
              !SQL_INJECTION_REGEX.test(formData.otherClinicName))) &&
          /^\d{1,3}$/.test(formData.weight) &&
          /^\d{1,3}$/.test(formData.height) &&
          (formData.hadOperation !== 'yes' || !SQL_INJECTION_REGEX.test(formData.operationDetails || '')),
      );
    },
    [formData, hasRequiredProfileFields, isEditingExistingSubmission],
  );

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
      photoUrl: profileAssetUrls.photoUrl || undefined,
      signatureUrl: profileAssetUrls.signatureUrl || undefined,
    }),
    [formData, profileAssetUrls.photoUrl, profileAssetUrls.signatureUrl],
  );

  const submit = useCallback(async () => {
    if (uploading) return;
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

    // Final file size check before submission
    const files = [formData.xrayFile, formData.cbcFile, formData.urinalysisFile];
    for (const file of files) {
      if (file && file.size > 2 * 1024 * 1024) {
        toast.error(`File "${file.name}" exceeds the 2MB limit. Please upload a smaller file.`);
        return;
      }
    }

    setUploading(true);
    try {
      const payload = {
        studentId: formData.studentId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleInitial: formData.middleInitial,
        department: formData.department,
        course: formData.course,
        yearLevel: formData.yearLevel,
        age: formData.age,
        sex: formData.sex,
        birthday: formData.birthday,
        civilStatus: formData.civilStatus,
        contactNumber: formData.contactNumber,
        address: formData.address,
        medicalHistory: formData.medicalHistory,
        allergyDetails: formData.allergyDetails,
        hadOperation: formData.hadOperation,
        operationDetails: formData.operationDetails,
        emergencyContact: formData.emergencyContact,
        dataPrivacyConsent: formData.dataPrivacyConsent,
        weight: formData.weight,
        height: formData.height,
        bmi: formData.bmi,
        labTestLocation: formData.labTestLocation,
        otherClinicName: formData.otherClinicName,
      };

      let recordId = activeSubmissionId;
      let isResubmission = Boolean(recordId && originalSubmissionStatus === 'returned');
      if (!recordId) {
        const myStudentId = formData.studentId.trim();
        if (myStudentId && formData.yearLevel) {
          const existing = await getStudentRecords(myStudentId);
          const latestSameYear = (existing.records || [])
            .filter((item: any) => String(item?.year || '') === String(formData.yearLevel))
            .sort(
              (a: any, b: any) =>
                new Date(b?.updatedAt || b?.submittedAt || 0).getTime() -
                new Date(a?.updatedAt || a?.submittedAt || 0).getTime(),
            )[0];
          const latestSameYearStatus = String(latestSameYear?.status || '').toLowerCase();
          const latestSameYearId = String(latestSameYear?.id || '').trim();

          // Safety: even without ?edit=... in URL, force resubmission to update
          // the latest returned record for this year instead of creating a new row.
          if (latestSameYearStatus === 'returned' && latestSameYearId) {
            recordId = latestSameYearId;
            isResubmission = true;
            setActiveSubmissionId(latestSameYearId);
            setOriginalSubmissionStatus('returned');
          }

          if (latestSameYearStatus && latestSameYearStatus !== 'returned') {
            throw new Error(
              `You already have a Year ${formData.yearLevel} submission with status "${latestSameYearStatus}".`,
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
        formData.xrayFile ? uploadFile(formData.xrayFile, recordId, 'xray') : null,
        formData.cbcFile ? uploadFile(formData.cbcFile, recordId, 'cbc') : null,
        formData.urinalysisFile ? uploadFile(formData.urinalysisFile, recordId, 'urinalysis') : null,
      ].filter(Boolean) as Promise<unknown>[];

      await Promise.all(uploads);
      await invalidateStudentRecordsQuery(queryClient, formData.studentId);
      toast.success(isResubmission ? 'Medical record resubmitted successfully!' : 'Medical record submitted successfully!');
      setSubmitted(true);
      setActiveSubmissionId(null);
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit medical record');
    } finally {
      setUploading(false);
    }
  }, [activeSubmissionId, canSubmit, formData, originalSubmissionStatus, queryClient, uploading]);

  return {
    step,
    setStep,
    totalSteps: TOTAL_STEPS,
    formData,
    uploading,
    submitted,
    canProceed,
    canSubmit,
    hasRequiredProfileFields,
    hasProfilePhoto,
    hasProfileSignature,
    previewRecord,
    updateField,
    updateEmergencyContact,
    updateMedicalCondition,
    updateMeasurement,
    handleFileChange,
    getBmiCategory,
    maxBirthdate,
    submit,
  };
}
