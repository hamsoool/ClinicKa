import { queryOptions, useQuery } from '@tanstack/react-query';
import { getActiveAcademicYearSettings } from './api';

const ACTIVE_ACADEMIC_YEAR_STALE_TIME_MS = 5 * 60_000;

export function activeAcademicYearQueryOptions() {
  return queryOptions({
    queryKey: ['activeAcademicYearSettings'] as const,
    queryFn: getActiveAcademicYearSettings,
    staleTime: ACTIVE_ACADEMIC_YEAR_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

export function useActiveAcademicYearSettingsQuery() {
  return useQuery(activeAcademicYearQueryOptions());
}
