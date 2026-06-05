import { QueryClient } from '@tanstack/react-query';

const DEFAULT_QUERY_STALE_TIME_MS = 90_000;
const DEFAULT_QUERY_GC_TIME_MS = 10 * 60_000;

export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: DEFAULT_QUERY_STALE_TIME_MS,
      gcTime: DEFAULT_QUERY_GC_TIME_MS,
      retry: 1,
    },
  },
});
