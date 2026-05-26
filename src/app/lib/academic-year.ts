import type { SubmissionRecord } from './record-types';

const ACADEMIC_YEAR_PATTERN = /^(\d{4})\s*-\s*(\d{4})$/;
const SUBMISSION_SLOT_LABELS = ['Year I', 'Year II', 'Year III', 'Year IV'] as const;

export function getDefaultAcademicYear(referenceDate = new Date()) {
  const startYear = referenceDate.getMonth() >= 6 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

export function normalizeAcademicYear(value: unknown, fallback = getDefaultAcademicYear()) {
  const match = String(value || '').trim().match(ACADEMIC_YEAR_PATTERN);
  if (!match) return fallback;

  const startYear = Number.parseInt(match[1], 10);
  const endYear = Number.parseInt(match[2], 10);
  if (!Number.isFinite(startYear) || endYear - startYear !== 1) return fallback;

  return `${startYear}-${endYear}`;
}

export function getAcademicYearRange(academicYear: unknown) {
  const normalized = normalizeAcademicYear(academicYear);
  const startYear = Number.parseInt(normalized.slice(0, 4), 10);
  const endYear = Number.parseInt(normalized.slice(5, 9), 10);

  return {
    academicYear: normalized,
    start: new Date(Date.UTC(startYear, 6, 1)),
    end: new Date(Date.UTC(endYear, 6, 1)),
  };
}

export function inferAcademicYearFromDate(value?: string | Date | null) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return getDefaultAcademicYear(date);
}

export function getRecordAcademicYear(record?: Pick<SubmissionRecord, 'academicYear' | 'submittedAt'> | null, fallback = '') {
  const explicitAcademicYear = String(record?.academicYear || '').trim();
  if (explicitAcademicYear) {
    return normalizeAcademicYear(explicitAcademicYear, explicitAcademicYear);
  }

  return inferAcademicYearFromDate(record?.submittedAt) || fallback;
}

export function formatAcademicYearLabel(value?: string | null) {
  const academicYear = String(value || '').trim();
  return academicYear ? `SY ${academicYear.replace(/\s*-\s*/, '-')}` : 'School Year';
}

export function normalizeSubmissionSlot(value: unknown) {
  const slot = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isInteger(slot) || slot < 1 || slot > 4) return null;
  return slot;
}

export function getSubmissionSlotLabel(value: unknown) {
  const slot = normalizeSubmissionSlot(value);
  return slot ? SUBMISSION_SLOT_LABELS[slot - 1] : 'Year Slot';
}

export function getLatestRecordForAcademicYear(records: SubmissionRecord[], academicYear: string) {
  const normalizedAcademicYear = normalizeAcademicYear(academicYear);

  return [...records]
    .filter((record) => getRecordAcademicYear(record) === normalizedAcademicYear)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.submittedAt || 0).getTime() -
        new Date(a.updatedAt || a.submittedAt || 0).getTime(),
    )[0] || null;
}

export function getNextSubmissionSlot(records: SubmissionRecord[], academicYear: string) {
  const currentAcademicYearRecord = getLatestRecordForAcademicYear(records, academicYear);
  const currentSlot = normalizeSubmissionSlot(currentAcademicYearRecord?.year);
  if (currentSlot) return currentSlot;

  const maxSubmittedSlot = records.reduce((max, record) => {
    const slot = normalizeSubmissionSlot(record?.year);
    return slot ? Math.max(max, slot) : max;
  }, 0);

  if (maxSubmittedSlot >= 4) return null;
  return (maxSubmittedSlot + 1) as 1 | 2 | 3 | 4;
}

export function isCurrentAcademicYearBlocked(record?: SubmissionRecord | null) {
  const status = String(record?.status || '').toLowerCase();
  return Boolean(status && status !== 'returned');
}
