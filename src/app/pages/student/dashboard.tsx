import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  FileText,
  Megaphone,
  Plus,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import StudentPageIntro from '../../components/student-page-intro';
import { toast } from 'sonner';
import { useAuth } from '../../lib/auth';
import { getStudentAnnouncements } from '../../lib/api';
import { useStudentRecordsQuery } from './student-records-query';
import { useStudentProfileAssetsQuery } from './student-profile-assets-query';
import type { SubmissionRecord } from '../../lib/record-types';
import {
  formatAcademicYearLabel,
  getLatestRecordForAcademicYear,
  getNextSubmissionSlot,
  getRecordAcademicYear,
  getSubmissionSlotLabel,
} from '../../lib/academic-year';
import { useAcademicYear } from '../../lib/academic-year-query';
const dashboardDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

type CompletionReminder = {
  title: string;
  detail: string;
  actionLabel: string;
  actionPath: string;
};

function hasValue(value?: string | number | null) {
  return String(value ?? '').trim().length > 0;
}

function joinMissingItems(items: string[]) {
  if (items.length <= 3) return items.join(', ');
  return `${items.slice(0, 3).join(', ')} and ${items.length - 3} more`;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const { academicYear: activeAcademicYear, academicYearLabel } = useAcademicYear();
  const { displayName, studentId, profileId } = useMemo(() => {
    const name = [
      me?.student?.first_name || me?.profile.first_name || '',
      me?.student?.last_name || me?.profile.last_name || '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    return {
      displayName: name || 'Student',
      studentId: me?.student?.student_id || me?.profile.student_id || '',
      profileId: me?.student?.profile_id || me?.profile.id || '',
    };
  }, [me]);
  const { data = [], isLoading: loading, isError, error } = useStudentRecordsQuery(studentId, 'summary');
  const records = data;
  const {
    data: profileAssets,
    isLoading: profileAssetsLoading,
    isError: profileAssetsError,
  } = useStudentProfileAssetsQuery(studentId, profileId);
  const {
    data: announcementsData,
    isLoading: announcementsLoading,
    isError: announcementsError,
  } = useQuery({
    queryKey: ['studentAnnouncements'],
    queryFn: getStudentAnnouncements,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  const announcements = useMemo(() => announcementsData?.announcements || [], [announcementsData?.announcements]);
  const featuredAnnouncements = useMemo(() => announcements.slice(0, 2), [announcements]);

  useEffect(() => {
    if (isError && error) {
      const message = error instanceof Error ? error.message : 'Failed to load records';
      if (message.toLowerCase().includes('profile not found')) {
        toast.error('Your account is not fully set up yet. Please sign out and sign in again.');
      } else {
        toast.error(message);
      }
    }
  }, [isError, error]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'in_review':
        return 'Pending';
      case 'resubmitted':
        return 'Resubmitted';
      case 'approved':
        return 'Approved';
      case 'returned':
        return 'Returned';
      default:
        return 'Not Started';
    }
  };

  const getStatusStyles = (status?: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium';
      case 'pending':
      case 'in_review':
        return 'bg-amber-50 border border-amber-200 text-amber-800 font-medium';
      case 'resubmitted':
        return 'bg-orange-50 border border-orange-200 text-orange-800 font-medium';
      case 'returned':
        return 'bg-red-50 border border-red-200 text-red-800 font-medium';
      default:
        return 'bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium';
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return dashboardDateFormatter.format(date);
  };

  const getRecordReferenceDate = (record?: SubmissionRecord) =>
    record?.status === 'approved'
      ? record.clearanceInfo?.issuedDate || record.updatedAt || record.submittedAt
      : record?.submittedAt;

  const calculateAgeAtDate = (birthday?: string, referenceDate?: string) => {
    if (!birthday || !referenceDate) return null;

    const birth = new Date(birthday);
    const reference = new Date(referenceDate);

    if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime())) {
      return null;
    }

    let age = reference.getFullYear() - birth.getFullYear();
    const monthDiff = reference.getMonth() - birth.getMonth();
    const dayDiff = reference.getDate() - birth.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }

    return age >= 0 ? age : null;
  };

  const getRecordAge = (record?: SubmissionRecord) => {
    if (!record) return '--';
    const calculatedAge = calculateAgeAtDate(record.birthday, getRecordReferenceDate(record));
    if (calculatedAge !== null) return String(calculatedAge);
    return record.age || '--';
  };

  const getRecordAgeSummary = (record?: SubmissionRecord) => {
    if (!record) return null;
    const age = getRecordAge(record);
    if (!age || age === '--') return null;
    return `Age ${age}`;
  };

  const { latestRecord, cycleRecords } = useMemo(() => {
    const sorted = [...records].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.submittedAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.submittedAt || 0).getTime();
      return bTime - aTime;
    });
    const recordsByCycle = new Map<number, SubmissionRecord>();
    for (const item of sorted) {
      const slot = Number.parseInt(String(item.year || ''), 10);
      if (!Number.isFinite(slot) || slot < 1 || recordsByCycle.has(slot)) continue;
      recordsByCycle.set(slot, item);
    }

    const latest =
      sorted.find((item) => String(item.status || '').toLowerCase() !== 'returned') ||
      sorted[0];

    return {
      latestRecord: latest,
      cycleRecords: [...recordsByCycle.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([slot, record]) => ({
          slot,
          label: getSubmissionSlotLabel(slot),
          record,
        })),
    };
  }, [records]);

  const currentAcademicYearRecord = useMemo(
    () => getLatestRecordForAcademicYear(records, activeAcademicYear),
    [activeAcademicYear, records],
  );
  const nextSlot = useMemo(
    () => getNextSubmissionSlot(records, activeAcademicYear),
    [activeAcademicYear, records],
  );
  const canStartSubmission = Boolean(!currentAcademicYearRecord && nextSlot);
  const editPath = latestRecord
    ? `/student/privacy-waiver/${latestRecord.year || '1'}?edit=${encodeURIComponent(latestRecord.id)}`
    : '';
  const completionReminders = useMemo<CompletionReminder[]>(() => {
    const reminders: CompletionReminder[] = [];
    const student = me?.student;
    const profile = me?.profile;
    const missingProfileFields = [
      !hasValue(student?.student_id || profile?.student_id) ? 'student ID' : '',
      !hasValue(student?.first_name || profile?.first_name) ? 'first name' : '',
      !hasValue(student?.last_name || profile?.last_name) ? 'last name' : '',
      !hasValue(student?.middle_initial) ? 'middle initial' : '',
      !hasValue(student?.department || profile?.department) ? 'department' : '',
      !hasValue(student?.course || profile?.course) ? 'course' : '',
      !hasValue(student?.year_level) ? 'year level' : '',
      !hasValue(student?.age) ? 'age' : '',
      !hasValue(student?.sex) ? 'sex' : '',
      !hasValue(student?.birthday) ? 'birthday' : '',
      !hasValue(student?.civil_status) ? 'civil status' : '',
      !hasValue(student?.contact_number) ? 'contact number' : '',
      !hasValue(student?.address) ? 'address' : '',
    ].filter(Boolean);

    if (missingProfileFields.length > 0) {
      reminders.push({
        title: 'Complete student profile',
        detail: `Missing ${joinMissingItems(missingProfileFields)}.`,
        actionLabel: 'Update profile',
        actionPath: '/student/profile',
      });
    }

    if (studentId && profileId && !profileAssetsLoading && !profileAssetsError) {
      const missingAssets = [
        !profileAssets?.photoUrl ? '1x1 photo' : '',
        !profileAssets?.signatureUrl ? 'signature' : '',
      ].filter(Boolean);

      if (missingAssets.length > 0) {
        reminders.push({
          title: 'Upload profile assets',
          detail: `Missing ${joinMissingItems(missingAssets)}.`,
          actionLabel: 'Upload assets',
          actionPath: '/student/profile',
        });
      }
    }

    if (!latestRecord) {
      reminders.push({
        title: 'Submit medical record',
        detail: 'No medical record has been started yet.',
        actionLabel: 'Start submission',
        actionPath: '/student/year-selection',
      });
      return reminders;
    }

    const latestRecordStatus = String(latestRecord.status || '').toLowerCase();
    const shouldCheckLatestSubmission = latestRecordStatus !== 'approved';
    const isLegacyJlghSubmission = String(latestRecord.labTestLocation || '').trim().toLowerCase() === 'jlgh';
    const editPath = `/student/privacy-waiver/${latestRecord.year || '1'}?edit=${encodeURIComponent(latestRecord.id)}`;

    if (shouldCheckLatestSubmission) {
      const missingSubmissionInfo = [
        !hasValue(latestRecord.hadOperation) ? 'operation history' : '',
        !hasValue(latestRecord.emergencyContact?.name) ||
          !hasValue(latestRecord.emergencyContact?.relationship) ||
          !hasValue(latestRecord.emergencyContact?.phone) ||
          !hasValue(latestRecord.emergencyContact?.address)
          ? 'emergency contact'
          : '',
        !isLegacyJlghSubmission && !hasValue(latestRecord.cbcTestClinic) ? 'CBC test clinic/lab' : '',
        !isLegacyJlghSubmission && !hasValue(latestRecord.urinalysisTestClinic) ? 'Urinalysis test clinic/lab' : '',
        !isLegacyJlghSubmission && !hasValue(latestRecord.xrayTestClinic) ? 'X-Ray test clinic/lab' : '',
      ].filter(Boolean);

      if (missingSubmissionInfo.length > 0) {
        reminders.push({
          title: 'Complete latest submission',
          detail: `Missing ${joinMissingItems(missingSubmissionInfo)}.`,
          actionLabel: 'Continue record',
          actionPath: editPath,
        });
      }
    }

    return reminders;
  }, [latestRecord, me, profileAssets, profileAssetsError, profileAssetsLoading, profileId, studentId]);
  const isCheckingCompletion = Boolean(studentId && profileId && profileAssetsLoading);

  if (loading && records.length === 0) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  return (
    <div className="w-full min-w-0 space-y-6 sm:space-y-8">
      <StudentPageIntro
        className="border-none bg-transparent p-0 sm:p-0 shadow-none"
        title={`Welcome to ClinicKa! ${displayName}.`}
        description="Health Services Unit clearance and medical record portal."
        actions={
          (!latestRecord || canStartSubmission) ? (
            <Button
              size="lg"
              className="h-11 px-6 gap-2 font-bold shadow-md"
              onClick={() => navigate('/student/year-selection')}
            >
              <Plus className="h-4 w-4" />
              Submit Medical Record
            </Button>
          ) : latestRecord?.status === 'returned' ? (
            <Button
              size="lg"
              className="h-11 px-6 gap-2 font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-md"
              onClick={() => navigate(editPath)}
            >
              <ArrowRight className="h-4 w-4" />
              Fix & Resubmit
            </Button>
          ) : latestRecord?.status === 'approved' ? (
            <Button
              size="lg"
              className="h-11 px-6 gap-2 font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-md"
              onClick={() => navigate('/student/clearance?tab=medical-clearance')}
            >
              <FileCheck className="h-4 w-4" />
              View Certificate
            </Button>
          ) : null
        }
      />

      {/* ── Call To Action Hero Banner ── */}
      {(!latestRecord || canStartSubmission) ? (
        <div className="relative overflow-hidden rounded-[20px] border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-surface-container-lowest p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-0.5 text-xs font-semibold text-primary">
                  Ready to Submit
                </span>
                <span className="rounded-full bg-neutral-100 border border-neutral-200/80 px-2.5 py-0.5 text-xs font-medium text-neutral-700">{academicYearLabel}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                Submit Your Medical Record Clearance
              </h2>
              <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-neutral-600">
                Complete your health questionnaire and upload required laboratory test results (Chest X-Ray, CBC, Urinalysis) to receive official clearance from the College Health Services Unit.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button
                size="lg"
                className="h-11 px-6 gap-2 text-sm sm:text-base font-semibold shadow-sm"
                onClick={() => navigate('/student/year-selection')}
              >
                <Plus className="h-5 w-5" />
                Start Clearance Submission
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      ) : latestRecord?.status === 'returned' ? (
        <div className="relative overflow-hidden rounded-[20px] border border-amber-300 bg-gradient-to-br from-amber-100/70 via-amber-50 to-surface-container-lowest p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200/80 border border-amber-300 px-3 py-0.5 text-xs font-semibold text-amber-900">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-800" />
                  Action Required
                </span>
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-900">{getSubmissionSlotLabel(latestRecord.year)}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-amber-950">
                Medical Record Returned for Correction
              </h2>
              <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-amber-900/90">
                The clinic staff requested updates to your medical clearance submission. Please check the note below, correct the needed details, and resubmit.
              </p>
              {latestRecord.staffNotes && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-white/90 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">Clinic Staff Note:</p>
                  <p className="mt-1 text-sm italic text-amber-900">"{latestRecord.staffNotes}"</p>
                </div>
              )}
            </div>
            <div className="flex shrink-0">
              <Button
                size="lg"
                className="h-11 px-6 gap-2 text-sm sm:text-base font-semibold bg-amber-700 hover:bg-amber-800 text-white shadow-sm"
                onClick={() => navigate(editPath)}
              >
                <ArrowRight className="h-5 w-5" />
                Fix & Resubmit Record
              </Button>
            </div>
          </div>
        </div>
      ) : latestRecord?.status === 'approved' ? (
        <div className="relative overflow-hidden rounded-[20px] border border-emerald-300/80 bg-gradient-to-br from-emerald-50/90 via-emerald-50/30 to-surface-container-lowest p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-0.5 text-xs font-semibold text-emerald-900">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-800" />
                  Clearance Approved
                </span>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                  {formatAcademicYearLabel(getRecordAcademicYear(latestRecord))}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                You Are Officially Medically Cleared!
              </h2>
              <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-neutral-600">
                Your medical clearance has been approved by the college physician. You can view or download your official certificate for enrolment and school activities.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button
                size="lg"
                className="h-11 px-6 gap-2 text-sm sm:text-base font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
                onClick={() => navigate('/student/clearance?tab=medical-clearance')}
              >
                <FileCheck className="h-5 w-5" />
                View Medical Certificate
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-11 px-5 text-sm sm:text-base font-medium border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                onClick={() => navigate('/student/clearance?tab=form')}
              >
                View Record
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[20px] border border-amber-300/70 bg-gradient-to-br from-amber-50/80 via-white to-surface-container-lowest p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300/70 px-3 py-0.5 text-xs font-semibold text-amber-900">
                  <Clock className="h-3.5 w-3.5 text-amber-800" />
                  Under Review
                </span>
                <span className="rounded-full bg-neutral-100 border border-neutral-200/80 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                  {formatAcademicYearLabel(getRecordAcademicYear(latestRecord))}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                Your Medical Clearance Is Under Review
              </h2>
              <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-neutral-600">
                Your health questionnaire and lab test results have been submitted to the clinic team.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button
                size="lg"
                className="h-11 px-6 gap-2 text-sm sm:text-base font-semibold shadow-sm"
                onClick={() => navigate('/student/clearance?tab=form')}
              >
                <Eye className="h-4 w-4" />
                View Submitted Form
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-11 px-5 text-sm sm:text-base font-medium border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                onClick={() => navigate('/student/clearance?tab=history')}
              >
                Clearance History
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.8fr)] xl:items-start">
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-neutral-900">Current Submission</h3>
              {records.length > 0 ? (
                <button
                  className="shrink-0 text-xs sm:text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                  onClick={() => navigate('/student/clearance?tab=history')}
                >
                  View records
                </button>
              ) : null}
            </div>

            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center sm:py-10">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-outline">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <h4 className="text-base font-semibold text-neutral-900">No Active Submissions</h4>
                <p className="mt-2 max-w-[260px] text-sm text-neutral-600">
                  You do not have any medical documents currently under review.
                </p>
                <button
                  className="mt-6 inline-flex items-center gap-2 rounded-[18px] bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90"
                  onClick={() => navigate('/student/year-selection')}
                >
                  <Plus className="h-4 w-4" />
                  Submit Document
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[18px] border border-outline-variant/20 bg-surface-container-low p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-neutral-500">Latest submission</p>
                      <p className="text-sm sm:text-base font-semibold text-neutral-900">
                        {latestRecord ? formatAcademicYearLabel(getRecordAcademicYear(latestRecord)) : academicYearLabel} Medical Record
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusStyles(latestRecord?.status)}`}
                    >
                      {getStatusBadge(latestRecord?.status)}
                    </span>
                  </div>
                  <div className="mt-3 text-xs sm:text-sm text-neutral-600">
                    <p>Submitted on {formatDate(latestRecord?.submittedAt)}</p>
                  </div>
                </div>

                <div className="pt-2">
                  {latestRecord?.status === 'returned' ? (
                    <Button
                      className="w-full justify-center gap-2 font-semibold text-sm bg-amber-700 hover:bg-amber-800 text-white shadow-sm"
                      onClick={() => navigate(editPath)}
                    >
                      <ArrowRight className="h-4 w-4" />
                      Update and Resubmit
                    </Button>
                  ) : latestRecord?.status === 'approved' ? (
                    <div className="flex flex-col gap-2">
                      <Button
                        className="w-full justify-center gap-2 font-semibold text-sm bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
                        onClick={() => navigate('/student/clearance?tab=medical-clearance')}
                      >
                        <FileCheck className="h-4 w-4" />
                        View Medical Certificate
                      </Button>
                      {canStartSubmission && (
                        <Button
                          variant="outline"
                          className="w-full justify-center gap-2 font-medium text-sm border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                          onClick={() => navigate('/student/year-selection')}
                        >
                          <Plus className="h-4 w-4" />
                          Submit for Next Cycle
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest">
            <div className="border-b border-outline-variant/30 bg-surface-container-lowest px-4 py-4 sm:px-6">
              <h3 className="text-base sm:text-lg font-semibold text-neutral-900">Record Cycle Overview</h3>
            </div>
            {cycleRecords.length === 0 ? (
              <div className="px-4 py-8 text-sm font-normal text-neutral-600 sm:px-6">
                No submission cycles have been started yet.
              </div>
            ) : (
              <>
                <div className="sm:hidden divide-y divide-neutral-100">
                  {cycleRecords.map(({ label, record }) => (
                    <div
                      key={`mobile-${label}`}
                      className="px-4 py-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${record ? 'text-neutral-900' : 'text-neutral-400'}`}>{label}</p>
                          {record ? (
                            <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                              {getRecordAgeSummary(record)}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusStyles(record?.status)}`}
                          >
                            {getStatusBadge(record?.status)}
                          </span>
                        </div>
                      </div>
                      <p className={`mt-1 text-xs font-normal ${record ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        {record ? `${formatAcademicYearLabel(getRecordAcademicYear(record))} • ` : ''}
                        Last action: {formatDate(record?.updatedAt || record?.submittedAt)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-xs uppercase tracking-wider text-neutral-600 font-semibold">
                        <th className="px-4 py-3 font-semibold sm:px-6">Record Slot</th>
                        <th className="px-4 py-3 font-semibold sm:px-6">Status</th>
                        <th className="px-4 py-3 font-semibold sm:px-6">Academic Year</th>
                        <th className="px-4 py-3 font-semibold sm:px-6">Last Action Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {cycleRecords.map(({ label, record }) => (
                        <tr key={label} className="transition-colors hover:bg-neutral-50/60">
                          <td className={`px-4 py-3.5 text-sm sm:px-6 ${record ? 'text-neutral-900 font-medium' : 'text-neutral-400 font-normal'}`}>
                            <div className="min-w-0">
                              <span className="block">{label}</span>
                              {record ? (
                                <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                                  {getRecordAgeSummary(record)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 sm:px-6">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusStyles(record?.status)}`}
                            >
                              {getStatusBadge(record?.status)}
                            </span>
                          </td>
                          <td className={`px-4 py-3.5 text-sm sm:px-6 font-normal ${record ? 'text-neutral-700' : 'text-neutral-400'}`}>
                            {record ? formatAcademicYearLabel(getRecordAcademicYear(record)) : '--'}
                          </td>
                          <td
                            className={`px-4 py-3.5 text-sm sm:px-6 font-normal ${record ? 'text-neutral-700' : 'text-neutral-400'}`}
                          >
                            {formatDate(record?.updatedAt || record?.submittedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Clearance Checklist
                </p>
                <p className="mt-1 text-sm sm:text-base font-semibold text-neutral-900">
                  {completionReminders.length > 0
                    ? `${completionReminders.length} item${completionReminders.length === 1 ? '' : 's'} need attention`
                    : isCheckingCompletion
                      ? 'Checking saved requirements'
                      : 'Requirements look complete'}
                </p>
              </div>
            </div>

            {completionReminders.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {completionReminders.slice(0, 4).map((item) => (
                  <button
                    key={`${item.title}-${item.actionPath}`}
                    type="button"
                    onClick={() => navigate(item.actionPath)}
                    className="group relative flex min-h-[5.5rem] w-full items-start gap-4 rounded-[18px] border border-amber-200 bg-amber-50/60 p-4 text-left transition-all duration-200 hover:border-amber-300 hover:bg-amber-100/60"
                  >
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 transition-colors group-hover:bg-amber-200">
                      <AlertCircle className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1 flex flex-col h-full justify-between">
                      <div>
                        <span className="block text-sm sm:text-base font-semibold text-amber-950">{item.title}</span>
                        <span className="mt-1 line-clamp-2 block text-xs sm:text-sm leading-relaxed text-amber-900/80">{item.detail}</span>
                      </div>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary transition-all group-hover:text-primary-hover">
                        {item.actionLabel}
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : isCheckingCompletion ? (
              <div className="mt-4 grid gap-3">
                {[0, 1].map((item) => (
                  <div
                    key={item}
                    className="flex min-h-[5.5rem] items-start gap-4 rounded-[18px] border border-amber-200 bg-amber-50/40 p-4"
                  >
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-amber-100" />
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="h-4 w-32 animate-pulse rounded bg-amber-200/50" />
                      <div className="h-3.5 w-full animate-pulse rounded bg-amber-100/60" />
                      <div className="h-3 w-24 animate-pulse rounded bg-amber-100/60" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3 sm:gap-4 rounded-[18px] border border-emerald-200 bg-emerald-50/70 p-4">
                <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <p className="text-sm sm:text-base font-semibold text-emerald-950">All requirements look good!</p>
              </div>
            )}
          </div>

          <div className="rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-neutral-900">Announcements</h3>
              <button
                className="shrink-0 text-xs sm:text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                onClick={() => navigate('/student/announcements')}
              >
                View All
              </button>
            </div>

            {announcementsLoading ? (
              <div className="space-y-3">
                {[0, 1].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[18px] border border-outline-variant/20 bg-surface-container-lowest p-3"
                  >
                    <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-surface-container" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3 w-24 animate-pulse rounded bg-surface-container" />
                      <div className="h-4 w-3/4 animate-pulse rounded bg-surface-container" />
                      <div className="h-3 w-full animate-pulse rounded bg-surface-container" />
                    </div>
                  </div>
                ))}
              </div>
            ) : announcementsError ? (
              <div className="flex flex-col items-center justify-center rounded-[18px] border border-outline-variant/20 bg-surface-container-low px-4 py-10 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-outline">
                  <Megaphone className="h-5 w-5" />
                </div>
                <p className="text-sm text-neutral-600">Announcements could not be loaded right now.</p>
              </div>
            ) : featuredAnnouncements.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[18px] border border-outline-variant/20 bg-surface-container-low px-4 py-10 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-outline">
                  <Megaphone className="h-5 w-5" />
                </div>
                <p className="text-sm text-neutral-600">No announcements posted yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {featuredAnnouncements.map((announcement) => (
                  <button
                    key={announcement.id}
                    type="button"
                    onClick={() => navigate('/student/announcements')}
                    className="flex w-full items-start gap-3 rounded-[18px] border border-outline-variant/20 bg-surface-container-lowest p-3 text-left transition-colors hover:bg-surface-container-low sm:gap-4"
                  >
                    {announcement.imageUrl ? (
                      <img
                        src={announcement.imageUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg border border-outline-variant/20 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary">
                        <Megaphone className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-xs font-normal text-neutral-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(announcement.datePosted)}
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm font-semibold text-neutral-900">{announcement.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 font-normal text-neutral-600">
                        {announcement.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
