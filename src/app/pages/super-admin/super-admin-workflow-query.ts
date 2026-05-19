import {
  queryOptions,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { getActiveAjaxRefetchInterval } from '../../lib/ajax-refresh';
import { getSuperAdminAdministrators } from '../../lib/api';

const SUPER_ADMIN_QUERY_STALE_TIME_MS = 60_000;
const SUPER_ADMIN_ACCOUNTS_REFRESH_INTERVAL_MS = 120_000;

export function superAdminAdministratorsQueryKey() {
  return ['superAdminAdministrators'] as const;
}

export function superAdminAdministratorsQueryOptions() {
  return queryOptions({
    queryKey: superAdminAdministratorsQueryKey(),
    queryFn: getSuperAdminAdministrators,
    staleTime: SUPER_ADMIN_QUERY_STALE_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(SUPER_ADMIN_ACCOUNTS_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function useSuperAdminAdministratorsQuery() {
  return useQuery(superAdminAdministratorsQueryOptions());
}

export async function invalidateSuperAdminWorkflowQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: superAdminAdministratorsQueryKey() });
}
