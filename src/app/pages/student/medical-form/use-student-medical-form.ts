import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { AuthMe } from '../../../lib/api';
import type { MockSubmission } from '../../../lib/mock-data';
import { submitMedicalRecord, updateMedicalRecord, uploadFile } from '../../../lib/api';
import { DEFAULT_MEDICAL_HISTORY } from './constants';
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
  privacyAccepted?: boolean;
};

const TOTAL_STEPS = 6;

function buildInitialFormData(year: string | undefined, me?: AuthMe | null, privacyAccepted = false): MedicalFormData {
  const student = me?.student;
  return {
    studentId: student?.student_id || me?.profile.student_id || '',
    firstName: student?.first_name || me?.profile.first_name || '',
    lastName: student?.last_name || me?.profile.last_name || '',
    middleInitial: student?.middle_initial || '',
    department: student?.department || me?.profile.department || 'CCS',
    course: student?.course || me?.profile.course || '',
    yearLevel: year || '1',
    age: student?.age ? String(student.age) : '',
    sex: student?.sex || 'female',
    birthday: student?.birthday || '',
    civilStatus: student?.civil_status || 'Single',
    contactNumber: student?.contact_number || '',
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
    dataPrivacyConsent: privacyAccepted,
    bloodPressure: '',
    weight: '',
    height: '',
    bmi: '',
    xrayFile: null,
    cbcFile: null,
    urinalysisFile: null,
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

export function useStudentMedicalForm({ year, me, privacyAccepted = false }: UseStudentMedicalFormArgs) {
  const student = me?.student;
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MedicalFormData>(() => buildInitialFormData(year, me, privacyAccepted));
  useEffect(() => {
    setSubmitted(false);
    setStep(1);
    setUploading(false);
    setActiveSubmissionId(null);
    setFormData(buildInitialFormData(year, me, privacyAccepted));
  }, [year, me?.profile.id, privacyAccepted]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      studentId: student?.student_id || me?.profile.student_id || prev.studentId,
      firstName: student?.first_name || me?.profile.first_name || prev.firstName,
      lastName: student?.last_name || me?.profile.last_name || prev.lastName,
      middleInitial: student?.middle_initial || prev.middleInitial,
      department: student?.department || me?.profile.department || prev.department,
      course: student?.course || me?.profile.course || prev.course,
      age: student?.age ? String(student.age) : prev.age,
      sex: student?.sex || prev.sex,
      birthday: student?.birthday || prev.birthday,
      civilStatus: student?.civil_status || prev.civilStatus,
      contactNumber: student?.contact_number || prev.contactNumber,
      address: student?.address || prev.address,
      dataPrivacyConsent: privacyAccepted || prev.dataPrivacyConsent,
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
    privacyAccepted,
    year,
  ]);

  const updateField = useCallback(<K extends keyof MedicalFormData>(field: K, value: MedicalFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateEmergencyContact = useCallback(
    <K extends keyof EmergencyContact>(field: K, value: EmergencyContact[K]) => {
      setFormData((prev) => ({
        ...prev,
        emergencyContact: {
          ...prev.emergencyContact,
          [field]: value,
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

  const updateMeasurement = useCallback((field: 'bloodPressure' | 'weight' | 'height' | 'bmi', value: string) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === 'weight' || field === 'height') {
        next.bmi = calculateBmi(field === 'weight' ? value : next.weight, field === 'height' ? value : next.height);
      }

      return next;
    });
  }, []);

  const handleFileChange = useCallback((field: 'xrayFile' | 'cbcFile' | 'urinalysisFile', file: File | null) => {
    if (file && file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: file }));
  }, []);

  const getBmiCategory = useCallback((bmi: string): BmiCategory => {
    const bmiValue = parseFloat(bmi);
    if (bmiValue < 18.5) return { category: 'Underweight', color: 'text-blue-600' };
    if (bmiValue < 25) return { category: 'Normal', color: 'text-green-600' };
    if (bmiValue < 30) return { category: 'Overweight', color: 'text-yellow-600' };
    return { category: 'Obese', color: 'text-red-600' };
  }, []);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return (
          formData.firstName &&
          formData.lastName &&
          formData.studentId &&
          formData.department &&
          formData.yearLevel &&
          formData.age &&
          formData.sex &&
          formData.birthday
        );
      case 2:
        return true;
      case 3:
        return (
          formData.hadOperation &&
          formData.emergencyContact.name &&
          formData.emergencyContact.phone
        );
      case 4:
        return formData.bloodPressure && formData.weight && formData.height;
      case 5:
        return formData.xrayFile && formData.cbcFile && formData.urinalysisFile;
      case 6:
        return true;
      default:
        return false;
    }
  }, [formData, step]);

  const canSubmit = useMemo(
    () =>
      Boolean(
        formData.firstName &&
          formData.lastName &&
          formData.studentId &&
          formData.department &&
          formData.yearLevel &&
          formData.age &&
          formData.sex &&
          formData.birthday &&
          formData.hadOperation &&
          formData.emergencyContact.name &&
          formData.emergencyContact.phone &&
          formData.dataPrivacyConsent &&
          formData.bloodPressure &&
          formData.weight &&
          formData.height &&
          formData.xrayFile &&
          formData.cbcFile &&
          formData.urinalysisFile,
      ),
    [formData],
  );

  const previewRecord = useMemo<MockSubmission>(
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
      bloodPressure: formData.bloodPressure,
      weight: formData.weight,
      height: formData.height,
      bmi: formData.bmi,
      staffMeasurements: {
        bloodPressure: formData.bloodPressure,
        weight: formData.weight,
        height: formData.height,
        bmi: formData.bmi,
      },
    }),
    [formData],
  );

  const submit = useCallback(async () => {
    if (uploading) return;

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
        bloodPressure: formData.bloodPressure,
        weight: formData.weight,
        height: formData.height,
        bmi: formData.bmi,
      };

      let recordId = activeSubmissionId;
      if (!recordId) {
        const result = await submitMedicalRecord(payload);
        recordId = result.recordId;
        setActiveSubmissionId(recordId);
      } else {
        await updateMedicalRecord(recordId, payload);
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
      toast.success('Medical record submitted successfully!');
      setSubmitted(true);
      setActiveSubmissionId(null);
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit medical record');
    } finally {
      setUploading(false);
    }
  }, [formData, uploading, activeSubmissionId]);

  return {
    step,
    setStep,
    totalSteps: TOTAL_STEPS,
    formData,
    uploading,
    submitted,
    canProceed,
    canSubmit,
    previewRecord,
    updateField,
    updateEmergencyContact,
    updateMedicalCondition,
    updateMeasurement,
    handleFileChange,
    getBmiCategory,
    submit,
  };
}
