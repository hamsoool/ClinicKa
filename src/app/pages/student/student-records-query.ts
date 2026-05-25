import {
  queryOptions,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { getActiveAjaxRefetchInterval } from '../../lib/ajax-refresh';
import { getStudentRecordSummaries, getStudentRecords } from '../../lib/api';
import type { SubmissionRecord } from '../../lib/record-types';

const STUDENT_RECORDS_REFRESH_INTERVAL_MS = 60_000;
const STUDENT_RECORDS_STALE_TIME_MS = 60_000;

type StudentRecordsQueryMode = 'full' | 'summary';

function normalizeStudentId(studentId?: string | null) {
  return String(studentId || '').trim();
}

export function studentRecordsQueryKey(studentId?: string | null, mode: StudentRecordsQueryMode = 'full') {
  return ['studentRecords', normalizeStudentId(studentId), mode] as const;
}

export function studentRecordsQueryOptions(studentId?: string | null, mode: StudentRecordsQueryMode = 'full') {
  const normalizedStudentId = normalizeStudentId(studentId);

  return queryOptions({
    queryKey: studentRecordsQueryKey(normalizedStudentId, mode),
    queryFn: async () => {
      if (!normalizedStudentId) return [] as SubmissionRecord[];
      const response = mode === 'summary'
        ? await getStudentRecordSummaries(normalizedStudentId)
        : await getStudentRecords(normalizedStudentId);
      return Array.isArray(response?.records) ? (response.records as SubmissionRecord[]) : [];
    },
    enabled: Boolean(normalizedStudentId),
    staleTime: STUDENT_RECORDS_STALE_TIME_MS,
    refetchInterval: normalizedStudentId
      ? () => getActiveAjaxRefetchInterval(STUDENT_RECORDS_REFRESH_INTERVAL_MS)
      : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function useStudentRecordsQuery(studentId?: string | null, mode: StudentRecordsQueryMode = 'full') {
  return useQuery(studentRecordsQueryOptions(studentId, mode));
}

export async function invalidateStudentRecordsQuery(
  queryClient: QueryClient,
  studentId?: string | null,
) {
  const normalizedStudentId = normalizeStudentId(studentId);
  if (!normalizedStudentId) return;

  await queryClient.invalidateQueries({
    queryKey: ['studentRecords', normalizedStudentId] as const,
  });
}
