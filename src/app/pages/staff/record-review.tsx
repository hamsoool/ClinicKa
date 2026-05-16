import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
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
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

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
import { saveSubmissionReview, updateSubmissionStatus } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { MedicalHistory, SubmissionRecord } from '../../lib/record-types';
import { SubmittedFilePreview } from './record-review/submitted-file-preview';
import {
  invalidateStaffWorkflowQueries,
  useStaffSubmissionDetailQuery,
} from './staff-workflow-query';

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
  purpose: 'enrolment' | 'ojt' | 'rle';
  controlNo: string;
  issuedDate: string;
};

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

function createRecordForm(submission?: SubmissionDetails | null): RecordForm {
  return {
    studentId: submission?.studentId || '',
    firstName: submission?.firstName || '',
    lastName: submission?.lastName || '',
    middleInitial: submission?.middleInitial || '',
    department: submission?.department || '',
    course: submission?.course || '',
    year: submission?.year || '',
    age: submission?.age || '',
    sex: submission?.sex || '',
    birthday: submission?.birthday || '',
    civilStatus: submission?.civilStatus || '',
    contactNumber: submission?.contactNumber || '',
    address: submission?.address || '',
    allergyDetails: submission?.allergyDetails || '',
    hadOperation: submission?.hadOperation || 'no',
    operationDetails: submission?.operationDetails || '',
    weight: submission?.weight || '',
    height: submission?.height || '',
    bmi: submission?.bmi || calculateBmi(submission?.weight || '', submission?.height || ''),
    emergencyContact: {
      name: submission?.emergencyContact?.name || '',
      relationship: submission?.emergencyContact?.relationship || '',
      phone: submission?.emergencyContact?.phone || '',
      address: submission?.emergencyContact?.address || '',
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
    examinedBy: submission?.staffMeasurements?.examinedBy || '',
    xrayDate: submission?.labResults?.xrayDate || '',
    xrayResult: submission?.labResults?.xrayResult || 'normal',
    xrayFindings: submission?.labResults?.xrayFindings || '',
    cbcDate: submission?.labResults?.cbcDate || '',
    hemoglobin: submission?.labResults?.hemoglobin || '',
    hematocrit: submission?.labResults?.hematocrit || '',
    wbc: submission?.labResults?.wbc || '',
    plateletCount: submission?.labResults?.plateletCount || '',
    bloodType: submission?.labResults?.bloodType || '',
    glucose: submission?.labResults?.glucose || '',
    protein: submission?.labResults?.protein || '',
    urinalysisDate: submission?.labResults?.urinalysisDate || '',
    urinalysisGlucose: submission?.labResults?.urinalysisGlucose || '',
    urinalysisProtein: submission?.labResults?.urinalysisProtein || '',
  };
}

function createClearanceForm(submission?: SubmissionDetails | null): ClearanceForm {
  return {
    findingsNormal: submission?.clearanceInfo?.findingsNormal ?? true,
    diagnosis: submission?.clearanceInfo?.diagnosis || '',
    remarks: submission?.clearanceInfo?.remarks || '',
    purpose: submission?.clearanceInfo?.purpose || 'enrolment',
    controlNo: submission?.clearanceInfo?.controlNo || '',
    issuedDate: submission?.clearanceInfo?.issuedDate || '',
  };
}

function getStatusBadge(status: ReviewStatus) {
  switch (status) {
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending Review</Badge>;
    case 'in_review':
      return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">In Review</Badge>;
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
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const staffPosition = me?.staff?.position || 'Clinic Staff';
  const currentStaffId = String(me?.staff?.id || '').trim();
  const isDoctor = ['clinic doctor', 'doctor'].includes(staffPosition.trim().toLowerCase()) || me?.profile.role === 'admin';
  const [submission, setSubmission] = useState<SubmissionDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [recordForm, setRecordForm] = useState<RecordForm>(() => createRecordForm());
  const [assessmentForm, setAssessmentForm] = useState<AssessmentForm>(() => createAssessmentForm());
  const [clearanceForm, setClearanceForm] = useState<ClearanceForm>(() => createClearanceForm());
  const [staffNotes, setStaffNotes] = useState('');
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('pending');
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const inReviewTransitionRef = useRef<string | null>(null);
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
        toast.error(errorMessage || 'Could not mark this record as In Review. Please refresh and try again.');
        inReviewTransitionRef.current = null;
      }
    })();

    return () => {
      isActive = false;
    };
  }, [queryClient, submission, submissionId]);

  function updateRecordField<K extends keyof RecordForm>(field: K, value: RecordForm[K]) {
    setRecordForm((prev) => {
      const next = { ...prev, [field]: value };

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
    setRecordForm((prev) => ({
      ...prev,
      emergencyContact: {
        ...prev.emergencyContact,
        [field]: value,
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
      const next = { ...prev, [field]: value };

      if (field === 'weight' || field === 'height') {
        next.bmi = calculateBmi(
          field === 'weight' ? String(value) : prev.weight,
          field === 'height' ? String(value) : prev.height,
        );
      }

      return next;
    });
  }

  function updateClearanceField<K extends keyof ClearanceForm>(field: K, value: ClearanceForm[K]) {
    setClearanceForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function persistReview(nextStatus?: ReviewStatus, customNotes?: string) {
    if (!submissionId || !submission) return;

    setSaving(true);
    try {
      const statusToSave = nextStatus || reviewStatus;
      const notesToSave = customNotes !== undefined ? customNotes : staffNotes;

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
        staffMeasurements: {
          bloodPressure: assessmentForm.bloodPressure,
          cardiacRate: assessmentForm.cardiacRate,
          respiratoryRate: assessmentForm.respiratoryRate,
          temperature: assessmentForm.temperature,
          weight: assessmentForm.weight,
          height: assessmentForm.height,
          bmi: assessmentForm.bmi,
          visualAcuity: assessmentForm.visualAcuity,
          skin: assessmentForm.skin,
          heent: assessmentForm.heent,
          chestLungs: assessmentForm.chestLungs,
          heart: assessmentForm.heart,
          abdomen: assessmentForm.abdomen,
          extremities: assessmentForm.extremities,
          others: assessmentForm.others,
          examinedBy: assessmentForm.examinedBy,
          staff_notes: notesToSave,
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
        clearanceInfo: clearanceForm,
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
        staffMeasurements: {
          bloodPressure: assessmentForm.bloodPressure,
          cardiacRate: assessmentForm.cardiacRate,
          respiratoryRate: assessmentForm.respiratoryRate,
          temperature: assessmentForm.temperature,
          weight: assessmentForm.weight,
          height: assessmentForm.height,
          bmi: assessmentForm.bmi,
          visualAcuity: assessmentForm.visualAcuity,
          skin: assessmentForm.skin,
          heent: assessmentForm.heent,
          chestLungs: assessmentForm.chestLungs,
          heart: assessmentForm.heart,
          abdomen: assessmentForm.abdomen,
          extremities: assessmentForm.extremities,
          others: assessmentForm.others,
          examinedBy: assessmentForm.examinedBy,
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
        clearanceInfo: clearanceForm,
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
  const isApprovedLocked = persistedStatus === 'approved';
  const isAssignedToAnotherReviewer =
    persistedStatus === 'in_review'
    && Boolean(submission.reviewedByStaffId)
    && submission.reviewedByStaffId !== currentStaffId;
  const activeReviewerName = submission.reviewedByName || 'another clinic staff member';
  const physicalExamStatus = persistedStatus === 'approved' || persistedStatus === 'physical_exam_done'
    ? 'Completed'
    : 'Pending';
  const clearanceStatus = persistedStatus === 'approved'
    ? 'Approved'
    : persistedStatus === 'returned'
      ? 'Returned'
      : 'Pending';

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/staff/submissions')}
        className="pl-0 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Submissions
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-primary">{isDoctor ? 'Clinic Doctor Review' : 'Clinic Staff Review'}</h1>
            {getStatusBadge(persistedStatus)}
          </div>
          <p className="text-muted-foreground">
            Review, verify, and update the student medical record before finalizing the clinic decision.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {recordForm.firstName} {recordForm.lastName}
            </span>
            <span>{recordForm.studentId}</span>
            <span>{recordForm.course || 'Course not set'}</span>
          </div>
        </div>

        <div className="rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
          <p className="font-medium text-foreground">Current recommendation</p>
          <p className="mt-1 text-muted-foreground">
            {reviewStatus === 'approved'
              ? 'Ready for clearance release'
              : reviewStatus === 'in_review'
                ? isAssignedToAnotherReviewer
                  ? `${activeReviewerName} is currently the active reviewer for this submission.`
                  : submission.reviewedByStaffId
                    ? 'You are currently the active reviewer for this submission.'
                    : 'Currently being reviewed by the clinic.'
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
      </div>

      {isAssignedToAnotherReviewer ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5">
            <p className="text-sm font-semibold text-amber-900">Another clinic staff member already claimed this review</p>
            <p className="mt-1 text-sm text-amber-800">
              {activeReviewerName} is currently assigned to this submission. You can inspect the record, but coordinate first before making edits.
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
            1) Confirm student record, 2) verify labs, 3) complete assessment, {isDoctor ? '4) finalize decision.' : '4) save notes and status for doctor review.'}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue={isDoctor ? 'assessment' : 'record'} className="space-y-6">
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
            {isDoctor ? 'Final Decision' : 'Notes & Status'}
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
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={recordForm.lastName}
                      onChange={(event) => updateRecordField('lastName', event.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="middleInitial">Middle Initial</Label>
                    <Input
                      id="middleInitial"
                      value={recordForm.middleInitial}
                      onChange={(event) => updateRecordField('middleInitial', event.target.value)}
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
                    <Input
                      id="course"
                      value={recordForm.course}
                      onChange={(event) => updateRecordField('course', event.target.value)}
                      className="mt-2"
                    />
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
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sex">Sex</Label>
                    <Input
                      id="sex"
                      value={recordForm.sex}
                      onChange={(event) => updateRecordField('sex', event.target.value)}
                      className="mt-2"
                    />
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
                    <Input
                      id="civilStatus"
                      value={recordForm.civilStatus}
                      onChange={(event) => updateRecordField('civilStatus', event.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactNumber">Contact Number</Label>
                    <Input
                      id="contactNumber"
                      value={recordForm.contactNumber}
                      onChange={(event) => updateRecordField('contactNumber', event.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div className="md:col-span-2 xl:col-span-3">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={recordForm.address}
                      onChange={(event) => updateRecordField('address', event.target.value)}
                      className="mt-2"
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
                      className="mt-2"
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
                      className="mt-3"
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
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyRelationship">Relationship</Label>
                    <Input
                      id="emergencyRelationship"
                      value={recordForm.emergencyContact.relationship}
                      onChange={(event) => updateEmergencyContact('relationship', event.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone">Phone Number</Label>
                    <Input
                      id="emergencyPhone"
                      value={recordForm.emergencyContact.phone}
                      onChange={(event) => updateEmergencyContact('phone', event.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyAddress">Address</Label>
                    <Textarea
                      id="emergencyAddress"
                      value={recordForm.emergencyContact.address}
                      onChange={(event) => updateEmergencyContact('address', event.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Student-Submitted Measurements</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="submittedWeight">Weight (kg)</Label>
                    <Input
                      id="submittedWeight"
                      value={recordForm.weight}
                      onChange={(event) => updateRecordField('weight', event.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="submittedHeight">Height (cm)</Label>
                    <Input
                      id="submittedHeight"
                      value={recordForm.height}
                      onChange={(event) => updateRecordField('height', event.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="submittedBmi">BMI</Label>
                    <Input id="submittedBmi" value={recordForm.bmi} readOnly className="mt-2 bg-muted/40" />
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
                    className="mt-2"
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
                  <Label htmlFor="hemoglobin">Hemoglobin</Label>
                  <Input
                    id="hemoglobin"
                    value={assessmentForm.hemoglobin}
                    onChange={(event) => updateAssessmentField('hemoglobin', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="hematocrit">Hematocrit</Label>
                  <Input
                    id="hematocrit"
                    value={assessmentForm.hematocrit}
                    onChange={(event) => updateAssessmentField('hematocrit', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="wbc">White Blood Cell Count</Label>
                  <Input
                    id="wbc"
                    value={assessmentForm.wbc}
                    onChange={(event) => updateAssessmentField('wbc', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="plateletCount">Platelet Count</Label>
                  <Input
                    id="plateletCount"
                    value={assessmentForm.plateletCount}
                    onChange={(event) => updateAssessmentField('plateletCount', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bloodType">Blood Type</Label>
                  <Input
                    id="bloodType"
                    value={assessmentForm.bloodType}
                    onChange={(event) => updateAssessmentField('bloodType', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="glucose">Glucose</Label>
                  <Input
                    id="glucose"
                    value={assessmentForm.glucose}
                    onChange={(event) => updateAssessmentField('glucose', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="protein">Protein</Label>
                  <Input
                    id="protein"
                    value={assessmentForm.protein}
                    onChange={(event) => updateAssessmentField('protein', event.target.value)}
                    className="mt-2"
                  />
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
                  <Input
                    id="urinalysisGlucose"
                    value={assessmentForm.urinalysisGlucose}
                    onChange={(event) => updateAssessmentField('urinalysisGlucose', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="urinalysisProtein">Protein</Label>
                  <Input
                    id="urinalysisProtein"
                    value={assessmentForm.urinalysisProtein}
                    onChange={(event) => updateAssessmentField('urinalysisProtein', event.target.value)}
                    className="mt-2"
                  />
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
              {!isDoctor && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <strong>Clinic Staff view:</strong> You can verify measurements (blood pressure, weight, height, BMI, visual acuity) below.
                  Physical examination fields and clearance actions are restricted to Clinic Doctors.
                </div>
              )}
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
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="cardiacRate">Cardiac Rate (bpm)</Label>
                  <Input
                    id="cardiacRate"
                    value={assessmentForm.cardiacRate}
                    onChange={(event) => updateAssessmentField('cardiacRate', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="respiratoryRate">Respiratory Rate</Label>
                  <Input
                    id="respiratoryRate"
                    value={assessmentForm.respiratoryRate}
                    onChange={(event) => updateAssessmentField('respiratoryRate', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="temperature">Temperature (C)</Label>
                  <Input
                    id="temperature"
                    value={assessmentForm.temperature}
                    onChange={(event) => updateAssessmentField('temperature', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="clinicWeight">Weight (kg)</Label>
                  <Input
                    id="clinicWeight"
                    value={assessmentForm.weight}
                    onChange={(event) => updateAssessmentField('weight', event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="clinicHeight">Height (cm)</Label>
                  <Input
                    id="clinicHeight"
                    value={assessmentForm.height}
                    onChange={(event) => updateAssessmentField('height', event.target.value)}
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
                    value={assessmentForm.visualAcuity}
                    onChange={(event) => updateAssessmentField('visualAcuity', event.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Physical Examination Results {!isDoctor && <span className="text-sm font-normal text-muted-foreground">(Doctor Only — Read Only)</span>}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="skin">Skin</Label>
                <Textarea
                  id="skin"
                  value={assessmentForm.skin}
                  onChange={(event) => updateAssessmentField('skin', event.target.value)}
                  className="mt-2"
                  rows={3}
                  disabled={!isDoctor}
                />
              </div>
              <div>
                <Label htmlFor="heent">HEENT</Label>
                <Textarea
                  id="heent"
                  value={assessmentForm.heent}
                  onChange={(event) => updateAssessmentField('heent', event.target.value)}
                  className="mt-2"
                  rows={3}
                  disabled={!isDoctor}
                />
              </div>
              <div>
                <Label htmlFor="chestLungs">Chest / Lungs</Label>
                <Textarea
                  id="chestLungs"
                  value={assessmentForm.chestLungs}
                  onChange={(event) => updateAssessmentField('chestLungs', event.target.value)}
                  className="mt-2"
                  rows={3}
                  disabled={!isDoctor}
                />
              </div>
              <div>
                <Label htmlFor="heart">Heart</Label>
                <Textarea
                  id="heart"
                  value={assessmentForm.heart}
                  onChange={(event) => updateAssessmentField('heart', event.target.value)}
                  className="mt-2"
                  rows={3}
                  disabled={!isDoctor}
                />
              </div>
              <div>
                <Label htmlFor="abdomen">Abdomen</Label>
                <Textarea
                  id="abdomen"
                  value={assessmentForm.abdomen}
                  onChange={(event) => updateAssessmentField('abdomen', event.target.value)}
                  className="mt-2"
                  rows={3}
                  disabled={!isDoctor}
                />
              </div>
              <div>
                <Label htmlFor="extremities">Extremities</Label>
                <Textarea
                  id="extremities"
                  value={assessmentForm.extremities}
                  onChange={(event) => updateAssessmentField('extremities', event.target.value)}
                  className="mt-2"
                  rows={3}
                  disabled={!isDoctor}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="otherFindings">Other Findings / Assessment Notes</Label>
                <Textarea
                  id="otherFindings"
                  value={assessmentForm.others}
                  onChange={(event) => updateAssessmentField('others', event.target.value)}
                  className="mt-2"
                  rows={4}
                  placeholder="Document additional observations, recommendations, or restrictions."
                  disabled={!isDoctor}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="examinedBy">Examined By</Label>
                <Input
                  id="examinedBy"
                  value={assessmentForm.examinedBy}
                  onChange={(event) => updateAssessmentField('examinedBy', event.target.value)}
                  className="mt-2"
                  placeholder="Doctor name"
                  disabled={!isDoctor}
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
                  onChange={(event) => setStaffNotes(event.target.value)}
                  className="mt-2"
                  rows={6}
                  placeholder="Add review notes, feedback to the student, follow-up instructions, or clinic observations."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                {!isDoctor ? (
                <div className="xl:col-span-2">
                  <Label htmlFor="reviewStatus">Medical Clearance Status</Label>
                  <Select value={reviewStatus} onValueChange={(value) => setReviewStatus(value as ReviewStatus)} disabled={isApprovedLocked}>
                    <SelectTrigger id="reviewStatus" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending Review</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="physical_exam_done">Physical Exam Done</SelectItem>
                      <SelectItem value="returned">Returned for Correction</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasUnsavedStatusChange ? (
                    <p className="mt-2 text-xs text-amber-600">This status change will be applied after you save.</p>
                  ) : null}
                  {isApprovedLocked ? (
                    <p className="mt-2 text-xs text-green-700">This record is approved and status changes are locked.</p>
                  ) : null}
                </div>
                ) : null}
                {!isDoctor ? (
                  <div className="md:col-span-1 xl:col-span-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Clinic Staff can update notes and status, but final clearance fields are limited to Clinic Doctors.
                    </div>
                  </div>
                ) : null}

                {isDoctor ? (
                <div className="xl:col-span-2">
                  <Label htmlFor="clearancePurpose">Purpose</Label>
                  <Select
                    value={clearanceForm.purpose}
                    onValueChange={(value) => updateClearanceField('purpose', value as ClearanceForm['purpose'])}
                  >
                    <SelectTrigger id="clearancePurpose" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enrolment">Enrolment</SelectItem>
                      <SelectItem value="ojt">OJT</SelectItem>
                      <SelectItem value="rle">RLE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                ) : null}

                {isDoctor ? (
                <div className="xl:col-span-2">
                  <Label htmlFor="controlNo">Control Number</Label>
                  <Input
                    id="controlNo"
                    value={clearanceForm.controlNo}
                    onChange={(event) => updateClearanceField('controlNo', event.target.value)}
                    className="mt-2"
                  />
                </div>
                ) : null}

                {isDoctor ? (
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

                {isDoctor ? (
                <div className="md:col-span-1 xl:col-span-3">
                  <Label htmlFor="clearanceSignatory">Clearance Signatory</Label>
                  <Input
                    id="clearanceSignatory"
                    value={assessmentForm.examinedBy}
                    onChange={(event) => updateAssessmentField('examinedBy', event.target.value)}
                    className="mt-2"
                    placeholder="Doctor name"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">This name will appear on the medical clearance.</p>
                </div>
                ) : null}

                {isDoctor ? (
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

                {isDoctor ? (
                <div className="md:col-span-1 xl:col-span-3">
                  <Label htmlFor="diagnosis">Diagnosis / Impression</Label>
                  <Textarea
                    id="diagnosis"
                    value={clearanceForm.diagnosis}
                    onChange={(event) => updateClearanceField('diagnosis', event.target.value)}
                    className="mt-2"
                    rows={4}
                  />
                </div>
                ) : null}

                {isDoctor ? (
                <div className="md:col-span-1 xl:col-span-3">
                  <Label htmlFor="remarks">Clearance Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={clearanceForm.remarks}
                    onChange={(event) => updateClearanceField('remarks', event.target.value)}
                    className="mt-2"
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

      <Card className="border-primary/20">
        <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Finalize the clinic review</p>
            <p className="text-sm text-muted-foreground">
              {isApprovedLocked
                ? 'This submission is already approved. Actions are locked to prevent accidental changes.'
                : isDoctor
                  ? 'Save draft edits at any time, return the record for correction when needed, or approve the clearance once everything is complete.'
                  : 'Save draft edits at any time or return the record for correction when updates are needed.'}
            </p>
          </div>

          {!isApprovedLocked ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button variant="outline" onClick={() => void persistReview()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Review'}
            </Button>
            <Button variant="destructive" onClick={() => {
              setReturnReason(staffNotes);
              setShowReturnDialog(true);
            }} disabled={saving}>
              Return for Correction
            </Button>
            {isDoctor ? (
              <Button
                onClick={() => void persistReview('approved')}
                disabled={saving}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve Clearance
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
            <DialogTitle>Return for Correction</DialogTitle>
            <DialogDescription>
              Provide clear instructions or reasons for returning this medical record. The student will see this note on their dashboard.
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
              {saving ? 'Returning...' : 'Confirm Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
