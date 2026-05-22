import type { AuthMe } from './api';

export type StudentSubmissionCategory = 'regular' | 'returning' | 'repeater_irregular';

export type StudentSubmissionProfile = {
  category: StudentSubmissionCategory;
  targetYearLevel: number | null;
};

const STORAGE_KEY_PREFIX = 'gc_student_submission_profile_';

function normalizeCategory(value: unknown): StudentSubmissionCategory {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'returning') return 'returning';
  if (normalized === 'repeater_irregular') return 'repeater_irregular';
  return 'regular';
}

function normalizeYearLevel(value: unknown): number | null {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) return null;
  return parsed;
}

export function toCategoryLabel(value: StudentSubmissionCategory) {
  if (value === 'returning') return 'Returning';
  if (value === 'repeater_irregular') return 'Irregular/Repeater';
  return 'Regular';
}

export function readStudentSubmissionProfile(studentId?: string | null): StudentSubmissionProfile {
  const normalizedStudentId = String(studentId || '').trim();
  if (typeof window !== 'undefined' && normalizedStudentId) {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${normalizedStudentId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return {
          category: normalizeCategory(parsed.category),
          targetYearLevel: normalizeYearLevel(parsed.targetYearLevel),
        };
      }
    } catch {
      // Fallback below
    }
  }
  return { category: 'regular', targetYearLevel: null };
}

export function writeStudentSubmissionProfile(studentId: string, profile: StudentSubmissionProfile) {
  if (typeof window === 'undefined') return;
  const normalizedStudentId = String(studentId || '').trim();
  if (!normalizedStudentId) return;
  window.localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${normalizedStudentId}`,
    JSON.stringify({
      category: normalizeCategory(profile.category),
      targetYearLevel: normalizeYearLevel(profile.targetYearLevel),
    }),
  );
}

export function resolveStudentSubmissionProfile(me?: AuthMe | null): StudentSubmissionProfile {
  const studentId = me?.student?.student_id || me?.profile?.student_id || '';
  const localProfile = readStudentSubmissionProfile(studentId);
  const dbCategory = normalizeCategory((me?.student as any)?.submission_category);
  const dbYear = normalizeYearLevel((me?.student as any)?.submission_target_year_level);
  return {
    category: dbCategory !== 'regular' ? dbCategory : localProfile.category,
    targetYearLevel: dbYear ?? localProfile.targetYearLevel,
  };
}
