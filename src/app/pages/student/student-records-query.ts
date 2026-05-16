import {
  queryOptions,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { getStudentRecords } from '../../lib/api';
import type { SubmissionRecord } from '../../lib/record-types';

const STUDENT_RECORDS_REFRESH_INTERVAL_MS = 20_000;
const STUDENT_RECORDS_STALE_TIME_MS = 10_000;

function normalizeStudentId(studentId?: string | null) {
  return String(studentId || '').trim();
}

export function studentRecordsQueryKey(studentId?: string | null) {
  return ['studentRecords', normalizeStudentId(studentId)] as const;
}

export function studentRecordsQueryOptions(studentId?: string | null) {
  const normalizedStudentId = normalizeStudentId(studentId);

  return queryOptions({
    queryKey: studentRecordsQueryKey(normalizedStudentId),
    queryFn: async () => {
      if (!normalizedStudentId) return [] as SubmissionRecord[];
      const response = await getStudentRecords(normalizedStudentId);
      return Array.isArray(response?.records) ? (response.records as SubmissionRecord[]) : [];
    },
    enabled: Boolean(normalizedStudentId),
    staleTime: STUDENT_RECORDS_STALE_TIME_MS,
    refetchInterval: normalizedStudentId ? STUDENT_RECORDS_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
  });
}

export function useStudentRecordsQuery(studentId?: string | null) {
  return useQuery(studentRecordsQueryOptions(studentId));
}

export async function invalidateStudentRecordsQuery(
  queryClient: QueryClient,
  studentId?: string | null,
) {
  const normalizedStudentId = normalizeStudentId(studentId);
  if (!normalizedStudentId) return;

  await queryClient.invalidateQueries({
    queryKey: studentRecordsQueryKey(normalizedStudentId),
  });
}
