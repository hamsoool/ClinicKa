import {
  queryOptions,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { getAnalytics, getSubmission, getSubmissions } from '../../lib/api';

const STAFF_SUBMISSIONS_REFRESH_INTERVAL_MS = 15_000;
const STAFF_ANALYTICS_REFRESH_INTERVAL_MS = 20_000;
const STAFF_QUERY_STALE_TIME_MS = 10_000;

function normalizeSubmissionId(submissionId?: string | null) {
  return String(submissionId || '').trim();
}

export function staffSubmissionsQueryKey() {
  return ['staffSubmissions'] as const;
}

export function staffAnalyticsQueryKey() {
  return ['staffAnalytics'] as const;
}

export function staffSubmissionDetailQueryKey(submissionId?: string | null) {
  return ['staffSubmission', normalizeSubmissionId(submissionId)] as const;
}

export function staffSubmissionsQueryOptions() {
  return queryOptions({
    queryKey: staffSubmissionsQueryKey(),
    queryFn: async () => {
      const data = await getSubmissions();
      return data.submissions || [];
    },
    staleTime: STAFF_QUERY_STALE_TIME_MS,
    refetchInterval: STAFF_SUBMISSIONS_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
  });
}

export function staffAnalyticsQueryOptions() {
  return queryOptions({
    queryKey: staffAnalyticsQueryKey(),
    queryFn: () => getAnalytics(),
    staleTime: STAFF_QUERY_STALE_TIME_MS,
    refetchInterval: STAFF_ANALYTICS_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
  });
}

export function staffSubmissionDetailQueryOptions(submissionId?: string | null) {
  const normalizedSubmissionId = normalizeSubmissionId(submissionId);

  return queryOptions({
    queryKey: staffSubmissionDetailQueryKey(normalizedSubmissionId),
    queryFn: async () => {
      if (!normalizedSubmissionId) return null;
      const data = await getSubmission(normalizedSubmissionId);
      return data.submission || null;
    },
    enabled: Boolean(normalizedSubmissionId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useStaffSubmissionsQuery() {
  return useQuery(staffSubmissionsQueryOptions());
}

export function useStaffAnalyticsQuery() {
  return useQuery(staffAnalyticsQueryOptions());
}

export function useStaffSubmissionDetailQuery(submissionId?: string | null) {
  return useQuery(staffSubmissionDetailQueryOptions(submissionId));
}

export async function invalidateStaffWorkflowQueries(
  queryClient: QueryClient,
  submissionId?: string | null,
) {
  const normalizedSubmissionId = normalizeSubmissionId(submissionId);

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: staffAnalyticsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: staffSubmissionsQueryKey() }),
    normalizedSubmissionId
      ? queryClient.invalidateQueries({
          queryKey: staffSubmissionDetailQueryKey(normalizedSubmissionId),
        })
      : Promise.resolve(),
  ]);
}
