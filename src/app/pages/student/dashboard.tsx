import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Megaphone, Plus } from 'lucide-react';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import StudentPageIntro from '../../components/student-page-intro';
import { toast } from 'sonner';
import { useAuth } from '../../lib/auth';
import { getStudentAnnouncements } from '../../lib/api';
import { useStudentRecordsQuery } from './student-records-query';
import { useStudentProfileAssetsQuery } from './student-profile-assets-query';
import type { SubmissionRecord } from '../../lib/record-types';
import { formatAcademicYearLabel, getRecordAcademicYear, getSubmissionSlotLabel } from '../../lib/academic-year';
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
  const { academicYearLabel } = useAcademicYear();
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
        return 'bg-primary-container/20 text-on-primary-container';
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'in_review':
        return 'bg-amber-100 text-amber-800';
      case 'resubmitted':
        return 'bg-orange-100 text-orange-800';
      case 'returned':
        return 'bg-error-container/70 text-on-error-container';
      default:
        return 'bg-surface-variant text-on-surface-variant';
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
    const shouldCheckLatestSubmission = latestRecordStatus !== 'approved' && latestRecordStatus !== 'physical_exam_done';
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
    <div className="mx-auto w-full max-w-[100rem] space-y-4 sm:space-y-6 lg:space-y-8">
      <StudentPageIntro
        title={`Welcome, ${displayName}`}
      />

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.8fr)] xl:items-start">
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:rounded-[1.75rem] sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Clearance Checklist
            </p>
            <p className="mt-1 text-sm font-semibold text-on-surface">
              {completionReminders.length > 0
                ? `${completionReminders.length} item${completionReminders.length === 1 ? '' : 's'} need attention`
                : isCheckingCompletion
                ? 'Checking saved requirements'
                : 'Requirements look complete'}
            </p>
          </div>
        </div>

        {completionReminders.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {completionReminders.slice(0, 4).map((item) => (
              <button
                key={`${item.title}-${item.actionPath}`}
                type="button"
                onClick={() => navigate(item.actionPath)}
                className="flex min-h-[5.25rem] w-full items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/80 p-3 text-left transition-colors hover:bg-amber-100/80"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-amber-950">{item.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-amber-800">{item.detail}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    {item.actionLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : isCheckingCompletion ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="flex min-h-[5.25rem] items-start gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3"
              >
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-container" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-surface-container" />
                  <div className="h-3 w-full animate-pulse rounded bg-surface-container" />
                  <div className="h-3 w-24 animate-pulse rounded bg-surface-container" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary-container/10 p-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container/30 text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-on-surface">No missing profile information or required uploads found.</p>
              <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">
                Keep an eye on clinic updates if your submission is still under review.
              </p>
            </div>
          </div>
        )}
      </div>
      
      {latestRecord?.status === 'returned' && (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-base font-bold tracking-tight text-amber-900 sm:text-lg">Action Required: Correction Needed</h3>
                <p className="mt-1 text-xs text-on-surface-variant sm:text-sm">
                  Your medical record submission for <span className="font-semibold">{getSubmissionSlotLabel(latestRecord.year)}</span> has been returned by the clinic staff.
                </p>
              </div>
              
              {latestRecord.staffNotes && (
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900">Note from Clinic Staff:</p>
                  <p className="text-sm italic leading-relaxed text-amber-800">"{latestRecord.staffNotes}"</p>
                </div>
              )}
              
              <div className="flex pt-1">
                <button
                  onClick={() =>
                    navigate(
                      `/student/privacy-waiver/${latestRecord?.year || '1'}?edit=${encodeURIComponent(
                        latestRecord?.id || '',
                      )}`,
                    )
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 sm:w-auto"
                >
                  Update and Resubmit
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
        <div className="border-b border-outline-variant/30 bg-surface-container-lowest px-4 py-4 sm:px-6">
          <h3 className="text-lg font-semibold text-on-surface">Record Cycle Overview</h3>
        </div>
        {cycleRecords.length === 0 ? (
          <div className="px-4 py-8 text-sm text-on-surface-variant sm:px-6">
            No submission cycles have been started yet.
          </div>
        ) : (
          <>
        <div className="sm:hidden">
          {cycleRecords.map(({ label, record }) => (
            <div
              key={`mobile-${label}`}
              className="border-b border-outline-variant/20 px-4 py-3 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${record ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>{label}</p>
                  {record ? (
                    <span className="mt-1 block text-[10px] font-normal tracking-normal text-on-surface-variant/80">
                      {getRecordAgeSummary(record)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${getStatusStyles(record?.status)}`}
                  >
                    {getStatusBadge(record?.status)}
                  </span>
                </div>
              </div>
              <p className={`mt-1 text-xs ${record ? 'text-on-surface-variant' : 'text-on-surface-variant/60'}`}>
                {record ? `${formatAcademicYearLabel(getRecordAcademicYear(record))} - ` : ''}
                Last action: {formatDate(record?.updatedAt || record?.submittedAt)}
              </p>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low text-xs uppercase tracking-[0.16em] text-on-surface-variant">
                <th className="px-4 py-3 font-semibold sm:px-6">Record Slot</th>
                <th className="px-4 py-3 font-semibold sm:px-6">Status</th>
                <th className="px-4 py-3 font-semibold sm:px-6">Academic Year</th>
                <th className="px-4 py-3 font-semibold sm:px-6">Last Action Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {cycleRecords.map(({ label, record }) => (
                <tr key={label} className="transition-colors hover:bg-surface-container-lowest">
                  <td className={`px-4 py-4 text-sm sm:px-6 ${record ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>
                    <div className="min-w-0">
                      <span className="block">{label}</span>
                      {record ? (
                        <span className="mt-1 block text-[11px] font-normal text-on-surface-variant/80">
                          {getRecordAgeSummary(record)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold sm:px-2.5 sm:text-xs ${getStatusStyles(record?.status)}`}
                    >
                      {getStatusBadge(record?.status)}
                    </span>
                  </td>
                  <td className={`px-4 py-4 text-sm sm:px-6 ${record ? 'text-on-surface-variant' : 'text-on-surface-variant/60'}`}>
                    {record ? formatAcademicYearLabel(getRecordAcademicYear(record)) : '--'}
                  </td>
                  <td
                    className={`px-4 py-4 text-sm sm:px-6 ${
                      record ? 'text-on-surface-variant' : 'text-on-surface-variant/60'
                    }`}
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
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
            <h3 className="text-lg font-semibold text-on-surface">Current Submission</h3>
            {records.length > 0 ? (
              <button
                className="shrink-0 text-xs font-semibold text-primary transition-colors hover:text-primary/80 sm:text-sm"
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
              <h4 className="text-lg font-semibold text-on-surface">No Active Submissions</h4>
              <p className="mt-2 max-w-[260px] text-sm text-on-surface-variant">
                You do not have any medical documents currently under review.
              </p>
              <button
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary/90"
                onClick={() => navigate('/student/year-selection')}
              >
                <Plus className="h-4 w-4" />
                Submit Document
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-on-surface-variant">Latest submission</p>
                    <p className="text-base font-semibold text-on-surface sm:text-lg">
                      {latestRecord ? formatAcademicYearLabel(getRecordAcademicYear(latestRecord)) : academicYearLabel} Medical Record
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyles(latestRecord?.status)}`}
                  >
                    {getStatusBadge(latestRecord?.status)}
                  </span>
                </div>
                <div className="mt-4 space-y-1 text-sm text-on-surface-variant">
                  <p>Submitted on {formatDate(latestRecord?.submittedAt)}</p>
                  {latestRecord?.updatedAt && latestRecord?.status !== 'pending' ? (
                    <p>
                      Last updated on <span className="font-medium text-on-surface">{formatDate(latestRecord.updatedAt)}</span>
                    </p>
                  ) : null}
                </div>
              </div>

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-container sm:w-auto"
                onClick={() => navigate('/student/year-selection')}
              >
                <Plus className="h-4 w-4" />
                {`Submit for ${academicYearLabel}`}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
            <h3 className="text-lg font-semibold text-on-surface">Announcements</h3>
            <button
              className="shrink-0 text-xs font-semibold text-primary transition-colors hover:text-primary/80 sm:text-sm"
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
                  className="flex items-start gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3"
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
            <div className="flex flex-col items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-10 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-outline">
                <Megaphone className="h-5 w-5" />
              </div>
              <p className="text-sm text-on-surface-variant">Announcements could not be loaded right now.</p>
            </div>
          ) : featuredAnnouncements.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-10 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-outline">
                <Megaphone className="h-5 w-5" />
              </div>
              <p className="text-sm text-on-surface-variant">No announcements posted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {featuredAnnouncements.map((announcement) => (
                <button
                  key={announcement.id}
                  type="button"
                  onClick={() => navigate('/student/announcements')}
                  className="flex w-full items-start gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 text-left transition-colors hover:bg-surface-container-low sm:gap-4"
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
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(announcement.datePosted)}
                    </p>
                    <p className="mt-1 line-clamp-1 text-sm font-semibold text-on-surface">{announcement.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
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
