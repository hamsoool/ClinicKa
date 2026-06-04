import { queryOptions, useQuery } from '@tanstack/react-query';
import { formatAcademicYearLabel, getDefaultAcademicYear, normalizeAcademicYear } from './academic-year';
import { getAcademicYearSetting } from './api';

const ACADEMIC_YEAR_STALE_TIME_MS = 12 * 60 * 60_000;

export function academicYearQueryKey() {
  return ['academicYearSetting'] as const;
}

export function academicYearQueryOptions() {
  return queryOptions({
    queryKey: academicYearQueryKey(),
    queryFn: getAcademicYearSetting,
    staleTime: ACADEMIC_YEAR_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function activeAcademicYearQueryOptions() {
  return queryOptions({
    ...academicYearQueryOptions(),
    select: (setting: Awaited<ReturnType<typeof getAcademicYearSetting>>) => ({
      academicYear: setting.academicYear,
    }),
  });
}

export function useAcademicYear() {
  const query = useQuery(academicYearQueryOptions());
  const academicYear = normalizeAcademicYear(query.data?.academicYear || getDefaultAcademicYear());

  return {
    ...query,
    academicYear,
    academicYearLabel: formatAcademicYearLabel(academicYear),
    settingValue: query.data?.value || formatAcademicYearLabel(academicYear),
  };
}

export function useActiveAcademicYearSettingsQuery() {
  return useQuery(activeAcademicYearQueryOptions());
}
