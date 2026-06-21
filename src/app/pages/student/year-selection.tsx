import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, CalendarDays, CheckCircle2, FileText, Lock } from 'lucide-react';
import StudentPageIntro from '../../components/student-page-intro';
import { useAuth } from '../../lib/auth';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  formatAcademicYearLabel,
  getLatestRecordForAcademicYear,
  getNextSubmissionSlot,
  getSubmissionSlotLabel,
  MAX_SUBMISSION_CYCLE,
  isCurrentAcademicYearBlocked,
} from '../../lib/academic-year';
import { useAcademicYear } from '../../lib/academic-year-query';
import { useStudentRecordsQuery } from './student-records-query';

export default function StudentYearSelection() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const { data = [], isLoading: recordsLoading } = useStudentRecordsQuery(studentId, 'summary');
  const {
    academicYear: activeAcademicYear,
    academicYearLabel,
    isLoading: academicYearLoading,
  } = useAcademicYear();
  const records = data;

  const currentAcademicYearRecord = useMemo(
    () => getLatestRecordForAcademicYear(records, activeAcademicYear),
    [activeAcademicYear, records],
  );
  const nextSlot = useMemo(
    () => getNextSubmissionSlot(records, activeAcademicYear),
    [activeAcademicYear, records],
  );
  const selectedSlot = currentAcademicYearRecord?.year || (nextSlot ? String(nextSlot) : '');
  const selectedSlotLabel = getSubmissionSlotLabel(selectedSlot);
  const latestStatus = String(currentAcademicYearRecord?.status || '').toLowerCase();
  const isApproved = latestStatus === 'approved';
  const isReturned = latestStatus === 'returned';
  const isBlocked = isCurrentAcademicYearBlocked(currentAcademicYearRecord);
  const isPending = isBlocked && !isApproved;
  const canStartSubmission = Boolean(!currentAcademicYearRecord && nextSlot);
  const canOpen = Boolean(isApproved || isReturned || canStartSubmission || isPending);
  const destination = isApproved
    ? `/student/clearance?tab=medical-clearance&year=${selectedSlot || '1'}`
    : isReturned
      ? `/student/privacy-waiver/${selectedSlot || '1'}?edit=${encodeURIComponent(currentAcademicYearRecord?.id || '')}`
      : isPending
        ? `/student/medical-form/${selectedSlot || '1'}?edit=${encodeURIComponent(currentAcademicYearRecord?.id || '')}&review=1`
        : selectedSlot
          ? `/student/privacy-waiver/${selectedSlot}`
          : '/student/clearance?tab=history';

  if ((recordsLoading && studentId) || academicYearLoading) {
    return <PortalPageSkeleton variant="year-selection" />;
  }

  const statusLabel = currentAcademicYearRecord
    ? isApproved
      ? 'Approved'
      : isReturned
        ? 'Returned'
        : 'In Review'
    : nextSlot
      ? 'Open'
      : 'Complete';
  const actionLabel = isApproved
    ? 'Open medical certificate'
    : isReturned
      ? 'Edit returned record'
      : canStartSubmission
        ? 'Start medical record'
        : isPending
          ? 'Review Submission'
          : 'View records';
  const isActionable = canOpen;
  const introCopy = currentAcademicYearRecord
    ? isApproved
      ? 'Your submission for this school year is already approved. Open your medical certificate to review or download it.'
      : isReturned
        ? 'Your latest medical record needs updates. Open it to review the clinic feedback and resubmit.'
        : 'Your current school year submission is already in progress. You can continue once the clinic requests changes.'
    : nextSlot
      ? `Begin your clinic submission for ${academicYearLabel}. This will be filed under ${selectedSlotLabel}.`
      : `You have already used all ${MAX_SUBMISSION_CYCLE} record cycles.`;
  const summaryCardStyles = isActionable
    ? 'border-primary/10 bg-primary-container/10'
    : 'border-outline-variant/20 bg-surface-container-low';
  const pageDescription = nextSlot
    ? `Start or continue your clinic submission for ${academicYearLabel}.`
    : `All ${MAX_SUBMISSION_CYCLE} submission cycles have already been used.`;

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Approved</Badge>;
      case 'returned':
        return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Returned</Badge>;
      case 'in review':
      case 'in_review':
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">In Review</Badge>;
      case 'open':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Open</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100">{status}</Badge>;
    }
  };

  const summaryInnerBoxStyles = isActionable
    ? 'bg-primary-container/20 text-on-primary-container'
    : 'bg-surface-container-lowest text-on-surface-variant';

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-5 sm:space-y-8">
      <StudentPageIntro
        title="Submit Medical Record"
        description={pageDescription}
        className="max-w-[78rem]"
      />

      <div className="mx-auto max-w-[78rem]">
        <Card className="border-outline-variant/30 bg-surface-container-lowest shadow-sm">
          <CardContent className="p-5 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)] lg:items-stretch">
              <div className="min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-transparent hover:bg-primary/15 font-semibold">
                      {selectedSlotLabel}
                    </Badge>
                    {getStatusBadge(statusLabel)}
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CalendarDays className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                        {academicYearLabel}
                      </p>
                    </div>
                  </div>

                  <h2 className="mt-4 text-xl font-bold text-on-surface sm:text-2xl leading-tight">
                    {isApproved
                      ? 'Open your medical certificate'
                      : isReturned
                        ? 'Continue your returned submission'
                        : canStartSubmission
                          ? 'Start your medical record submission'
                          : 'Submission under review'}
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                    {introCopy}
                  </p>
                </div>

                <div className="mt-8">
                  <Button
                    onClick={() => navigate(destination)}
                    className="gap-2"
                  >
                    {isApproved ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isPending ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {actionLabel}
                  </Button>
                </div>
              </div>

              <div className={`rounded-[18px] border p-5 sm:p-6 flex flex-col justify-between ${summaryCardStyles}`}>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                    Submission Details
                  </h3>
                  <dl className="mt-4 space-y-3">
                    <div className="flex justify-between border-b border-outline-variant/10 pb-2">
                      <dt className="text-sm text-on-surface-variant">School Year</dt>
                      <dd className="text-sm font-semibold text-on-surface">{academicYearLabel}</dd>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/10 pb-2">
                      <dt className="text-sm text-on-surface-variant">Record Slot</dt>
                      <dd className="text-sm font-semibold text-on-surface">{selectedSlotLabel || 'Unavailable'}</dd>
                    </div>
                    <div className="flex justify-between pb-1">
                      <dt className="text-sm text-on-surface-variant">Status</dt>
                      <dd className="text-sm font-semibold text-on-surface">{statusLabel}</dd>
                    </div>
                  </dl>
                </div>

                <div className={`mt-5 rounded-lg px-4 py-3 text-xs leading-relaxed ${summaryInnerBoxStyles}`}>
                  {nextSlot ? 'You can submit relevant requirements again next year.' : 'No additional record cycles are available.'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
