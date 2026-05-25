import {
  queryOptions,
  useQuery,
} from '@tanstack/react-query';
import { getStudentProfileAssets, type StudentProfileAssets } from '../../lib/api';

const STUDENT_PROFILE_ASSETS_STALE_TIME_MS = 60_000;

const EMPTY_STUDENT_PROFILE_ASSETS: StudentProfileAssets = {
  photoUrl: null,
  signatureUrl: null,
  photoFileName: null,
  signatureFileName: null,
};

function normalizeId(value?: string | null) {
  return String(value || '').trim();
}

export function studentProfileAssetsQueryKey(studentId?: string | null, profileId?: string | null) {
  return ['studentProfileAssets', normalizeId(studentId), normalizeId(profileId)] as const;
}

export function studentProfileAssetsQueryOptions(studentId?: string | null, profileId?: string | null) {
  const normalizedStudentId = normalizeId(studentId);
  const normalizedProfileId = normalizeId(profileId);

  return queryOptions({
    queryKey: studentProfileAssetsQueryKey(normalizedStudentId, normalizedProfileId),
    queryFn: async () => {
      if (!normalizedStudentId || !normalizedProfileId) return EMPTY_STUDENT_PROFILE_ASSETS;
      return getStudentProfileAssets(normalizedStudentId, normalizedProfileId);
    },
    enabled: Boolean(normalizedStudentId && normalizedProfileId),
    staleTime: STUDENT_PROFILE_ASSETS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useStudentProfileAssetsQuery(studentId?: string | null, profileId?: string | null) {
  return useQuery(studentProfileAssetsQueryOptions(studentId, profileId));
}
