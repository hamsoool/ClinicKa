import {
  queryOptions,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import {
  getAnalytics,
  getStaffApprovedStudents,
  getStaffCertificateRecords,
  getStaffDashboardOverview,
  getStaffSubmissionSummaries,
  getSubmission,
  type StaffApprovedStudentFilters,
  type StaffSubmissionSummaryFilters,
} from '../../lib/api';
import { getActiveAjaxRefetchInterval } from '../../lib/ajax-refresh';

const STAFF_DASHBOARD_REFRESH_INTERVAL_MS = 30_000;
const STAFF_SUMMARIES_REFRESH_INTERVAL_MS = 30_000;
const STAFF_ANALYTICS_REFRESH_INTERVAL_MS = 90_000;
const STAFF_QUERY_STALE_TIME_MS = 45_000;
const STAFF_QUERY_GC_TIME_MS = 8 * 60_000;
const STAFF_DETAIL_STALE_TIME_MS = 15_000;

function normalizeSubmissionId(submissionId?: string | null) {
  return String(submissionId || '').trim();
}

function normalizeSummaryFilters(filters: StaffSubmissionSummaryFilters = {}) {
  return {
    searchQuery: String(filters.searchQuery || '').trim(),
    statusFilter: String(filters.statusFilter || 'action_needed').trim() || 'action_needed',
    departmentFilter: String(filters.departmentFilter || '').trim(),
    yearFilter: String(filters.yearFilter || '').trim(),
    sortOrder: filters.sortOrder === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Number(filters.page || 1) || 1),
    pageSize: Math.max(1, Number(filters.pageSize || 25) || 25),
  } as const;
}

function normalizeApprovedStudentFilters(filters: StaffApprovedStudentFilters = {}) {
  return {
    searchQuery: String(filters.searchQuery || '').trim(),
    departmentFilter: String(filters.departmentFilter || '').trim(),
    yearFilter: String(filters.yearFilter || '').trim(),
    courseFilter: String(filters.courseFilter || '').trim(),
    fromDate: String(filters.fromDate || '').trim(),
    toDate: String(filters.toDate || '').trim(),
    page: Math.max(1, Number(filters.page || 1) || 1),
    pageSize: Math.max(1, Number(filters.pageSize || 20) || 20),
  } as const;
}

export function staffDashboardOverviewQueryKey() {
  return ['staffDashboardOverview'] as const;
}

export function staffSubmissionSummariesQueryKey(filters: StaffSubmissionSummaryFilters = {}) {
  return ['staffSubmissionSummaries', normalizeSummaryFilters(filters)] as const;
}

export function staffApprovedStudentsQueryKey(filters: StaffApprovedStudentFilters = {}) {
  return ['staffApprovedStudents', normalizeApprovedStudentFilters(filters)] as const;
}

export function staffAnalyticsQueryKey() {
  return ['staffAnalytics'] as const;
}

export function staffSubmissionDetailQueryKey(submissionId?: string | null) {
  return ['staffSubmission', normalizeSubmissionId(submissionId)] as const;
}

export function staffStudentCertificateRecordsQueryKey(studentId?: string | null) {
  return ['staffStudentCertificateRecords', normalizeSubmissionId(studentId)] as const;
}

export function staffDashboardOverviewQueryOptions() {
  return queryOptions({
    queryKey: staffDashboardOverviewQueryKey(),
    queryFn: getStaffDashboardOverview,
    staleTime: STAFF_QUERY_STALE_TIME_MS,
    gcTime: STAFF_QUERY_GC_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(STAFF_DASHBOARD_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function staffSubmissionSummariesQueryOptions(filters: StaffSubmissionSummaryFilters = {}) {
  const normalizedFilters = normalizeSummaryFilters(filters);

  return queryOptions({
    queryKey: staffSubmissionSummariesQueryKey(normalizedFilters),
    queryFn: () => getStaffSubmissionSummaries(normalizedFilters),
    staleTime: STAFF_QUERY_STALE_TIME_MS,
    gcTime: STAFF_QUERY_GC_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(STAFF_SUMMARIES_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function staffApprovedStudentsQueryOptions(filters: StaffApprovedStudentFilters = {}) {
  const normalizedFilters = normalizeApprovedStudentFilters(filters);

  return queryOptions({
    queryKey: staffApprovedStudentsQueryKey(normalizedFilters),
    queryFn: () => getStaffApprovedStudents(normalizedFilters),
    staleTime: STAFF_QUERY_STALE_TIME_MS,
    gcTime: STAFF_QUERY_GC_TIME_MS,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function staffAnalyticsQueryOptions() {
  return queryOptions({
    queryKey: staffAnalyticsQueryKey(),
    queryFn: () => getAnalytics(),
    staleTime: STAFF_QUERY_STALE_TIME_MS,
    gcTime: STAFF_QUERY_GC_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(STAFF_ANALYTICS_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
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
    staleTime: STAFF_DETAIL_STALE_TIME_MS,
    gcTime: STAFF_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function staffStudentCertificateRecordsQueryOptions(studentId?: string | null) {
  const normalizedStudentId = normalizeSubmissionId(studentId);

  return queryOptions({
    queryKey: staffStudentCertificateRecordsQueryKey(normalizedStudentId),
    queryFn: async () => {
      if (!normalizedStudentId) return [];
      const response = await getStaffCertificateRecords(normalizedStudentId);
      return Array.isArray(response?.records) ? response.records : [];
    },
    enabled: Boolean(normalizedStudentId),
    staleTime: STAFF_QUERY_STALE_TIME_MS,
    gcTime: STAFF_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function useStaffDashboardOverviewQuery() {
  return useQuery(staffDashboardOverviewQueryOptions());
}

export function useStaffSubmissionSummariesQuery(filters: StaffSubmissionSummaryFilters = {}) {
  return useQuery(staffSubmissionSummariesQueryOptions(filters));
}

export function useStaffApprovedStudentsQuery(filters: StaffApprovedStudentFilters = {}) {
  return useQuery(staffApprovedStudentsQueryOptions(filters));
}

export function useStaffAnalyticsQuery() {
  return useQuery(staffAnalyticsQueryOptions());
}

export function useStaffSubmissionDetailQuery(submissionId?: string | null) {
  return useQuery(staffSubmissionDetailQueryOptions(submissionId));
}

export function useStaffStudentCertificateRecordsQuery(studentId?: string | null) {
  return useQuery(staffStudentCertificateRecordsQueryOptions(studentId));
}

export async function invalidateStaffWorkflowQueries(
  queryClient: QueryClient,
  submissionId?: string | null,
  studentId?: string | null,
) {
  const normalizedSubmissionId = normalizeSubmissionId(submissionId);
  const normalizedStudentId = normalizeSubmissionId(studentId);

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: staffDashboardOverviewQueryKey() }),
    queryClient.invalidateQueries({ queryKey: ['staffSubmissionSummaries'] }),
    queryClient.invalidateQueries({ queryKey: ['staffApprovedStudents'] }),
    queryClient.invalidateQueries({ queryKey: staffAnalyticsQueryKey() }),
    normalizedSubmissionId
      ? queryClient.invalidateQueries({
          queryKey: staffSubmissionDetailQueryKey(normalizedSubmissionId),
        })
      : Promise.resolve(),
    normalizedStudentId
      ? queryClient.invalidateQueries({
          queryKey: staffStudentCertificateRecordsQueryKey(normalizedStudentId),
        })
      : Promise.resolve(),
  ]);
}
