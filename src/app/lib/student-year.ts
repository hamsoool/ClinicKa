type StudentYearSource = {
  student?: {
    year_level?: number | null;
    student_id?: string | null;
  } | null;
  profile?: {
    student_id?: string | null;
  } | null;
};

export function normalizeYearLevel(value: unknown) {
  const normalized = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 4) {
    return null;
  }

  return normalized;
}

export function getYearLevelLabel(value: unknown) {
  const yearLevel = normalizeYearLevel(value);
  if (yearLevel === 1) return '1st Year';
  if (yearLevel === 2) return '2nd Year';
  if (yearLevel === 3) return '3rd Year';
  if (yearLevel === 4) return '4th Year';
  return `Year ${String(value || '').trim()}`.trim();
}

export function inferStudentYearLevel(studentId?: string | null, referenceDate = new Date()) {
  const trimmedStudentId = String(studentId || '').trim();
  const enrollmentYear = trimmedStudentId ? Number.parseInt(trimmedStudentId.slice(0, 4), 10) : referenceDate.getFullYear();
  const academicYearOffset = referenceDate.getMonth() >= 6 ? 1 : 0;

  if (Number.isNaN(enrollmentYear)) {
    return 1;
  }

  return Math.min(4, Math.max(1, referenceDate.getFullYear() - enrollmentYear + academicYearOffset));
}

export function resolveStudentYearLevel(source?: StudentYearSource | null, referenceDate = new Date()) {
  const explicitYearLevel = normalizeYearLevel(source?.student?.year_level);
  if (explicitYearLevel) {
    return explicitYearLevel;
  }

  return inferStudentYearLevel(source?.student?.student_id || source?.profile?.student_id, referenceDate);
}

export function isCurrentSubmissionYear(
  source: StudentYearSource | null | undefined,
  requestedYearLevel: unknown,
  referenceDate = new Date(),
) {
  const currentYearLevel = resolveStudentYearLevel(source, referenceDate);
  const requestedYear = normalizeYearLevel(requestedYearLevel);

  if (!requestedYear) {
    return false;
  }

  return currentYearLevel === requestedYear;
}
