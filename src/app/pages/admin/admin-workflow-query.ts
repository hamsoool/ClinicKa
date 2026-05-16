import {
  queryOptions,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { getActiveAjaxRefetchInterval } from '../../lib/ajax-refresh';
import {
  getAdminSystemSettings,
  getAnalytics,
  getArchivedUserAccounts,
  getStaffUsers,
  getSubmissions,
  getUserAccounts,
} from '../../lib/api';

const ADMIN_QUERY_STALE_TIME_MS = 60_000;
const ADMIN_ANALYTICS_REFRESH_INTERVAL_MS = 90_000;
const ADMIN_SUBMISSIONS_REFRESH_INTERVAL_MS = 60_000;
const ADMIN_ACCOUNTS_REFRESH_INTERVAL_MS = 120_000;
const ADMIN_SETTINGS_REFRESH_INTERVAL_MS = 180_000;

export function adminAnalyticsQueryKey() {
  return ['adminAnalytics'] as const;
}

export function adminSubmissionsQueryKey() {
  return ['adminSubmissions'] as const;
}

export function adminStaffUsersQueryKey() {
  return ['adminStaffUsers'] as const;
}

export function adminUserAccountsQueryKey() {
  return ['adminUserAccounts'] as const;
}

export function adminArchivedAccountsQueryKey() {
  return ['adminArchivedAccounts'] as const;
}

export function adminSystemSettingsQueryKey() {
  return ['adminSystemSettings'] as const;
}

export function adminAnalyticsQueryOptions() {
  return queryOptions({
    queryKey: adminAnalyticsQueryKey(),
    queryFn: getAnalytics,
    staleTime: ADMIN_QUERY_STALE_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(ADMIN_ANALYTICS_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function adminSubmissionsQueryOptions() {
  return queryOptions({
    queryKey: adminSubmissionsQueryKey(),
    queryFn: async () => {
      const data = await getSubmissions();
      return data.submissions || [];
    },
    staleTime: ADMIN_QUERY_STALE_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(ADMIN_SUBMISSIONS_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function adminStaffUsersQueryOptions() {
  return queryOptions({
    queryKey: adminStaffUsersQueryKey(),
    queryFn: getStaffUsers,
    staleTime: ADMIN_QUERY_STALE_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(ADMIN_ACCOUNTS_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function adminUserAccountsQueryOptions() {
  return queryOptions({
    queryKey: adminUserAccountsQueryKey(),
    queryFn: getUserAccounts,
    staleTime: ADMIN_QUERY_STALE_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(ADMIN_ACCOUNTS_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function adminArchivedAccountsQueryOptions() {
  return queryOptions({
    queryKey: adminArchivedAccountsQueryKey(),
    queryFn: getArchivedUserAccounts,
    staleTime: ADMIN_QUERY_STALE_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(ADMIN_ACCOUNTS_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function adminSystemSettingsQueryOptions() {
  return queryOptions({
    queryKey: adminSystemSettingsQueryKey(),
    queryFn: getAdminSystemSettings,
    staleTime: ADMIN_QUERY_STALE_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(ADMIN_SETTINGS_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function useAdminAnalyticsQuery() {
  return useQuery(adminAnalyticsQueryOptions());
}

export function useAdminSubmissionsQuery() {
  return useQuery(adminSubmissionsQueryOptions());
}

export function useAdminStaffUsersQuery() {
  return useQuery(adminStaffUsersQueryOptions());
}

export function useAdminUserAccountsQuery() {
  return useQuery(adminUserAccountsQueryOptions());
}

export function useAdminArchivedAccountsQuery() {
  return useQuery(adminArchivedAccountsQueryOptions());
}

export function useAdminSystemSettingsQuery() {
  return useQuery(adminSystemSettingsQueryOptions());
}

export async function invalidateAdminWorkflowQueries(
  queryClient: QueryClient,
  options?: { includeSettings?: boolean },
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: adminAnalyticsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: adminSubmissionsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: adminStaffUsersQueryKey() }),
    queryClient.invalidateQueries({ queryKey: adminUserAccountsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: adminArchivedAccountsQueryKey() }),
    options?.includeSettings
      ? queryClient.invalidateQueries({ queryKey: adminSystemSettingsQueryKey() })
      : Promise.resolve(),
  ]);
}
