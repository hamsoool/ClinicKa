import type { MedicalHistoryState } from './types';

export const DEPARTMENT_OPTIONS = [
  {
    value: 'CAHS',
    label: 'College of Allied Health Studies (CAHS)',
    programs: ['Bachelor of Science in Nursing', 'Bachelor of Science in Midwifery'],
  },
  {
    value: 'CBA',
    label: 'College of Business and Accountancy (CBA)',
    programs: [
      'Bachelor of Science in Accountancy *',
      'Bachelor of Science in Business Administration Major in Financial Management',
      'Bachelor of Science in Business Administration Major in Human Resource Management',
      'Bachelor of Science in Business Administration Major in Marketing Management',
      'Bachelor of Science in Customs Administration',
    ],
  },
  {
    value: 'CCS',
    label: 'College of Computer Studies (CCS)',
    programs: [
      'Bachelor of Science in Computer Science',
      'Bachelor of Science in Entertainment and Multimedia Computing',
      'Bachelor of Science in Information Technology',
    ],
  },
  {
    value: 'CEAS',
    label: 'College of Education, Arts, and Sciences (CEAS)',
    programs: [
      'Bachelor of Arts in Communication',
      'Bachelor of Early Childhood Education',
      'Bachelor of Culture and Arts Education',
      'Bachelor of Physical Education',
      'Bachelor of Elementary Education (General Education)',
      'Bachelor of Secondary Education major in English',
      'Bachelor of Secondary Education major in Filipino',
      'Bachelor of Secondary Education major in Mathematics',
      'Bachelor of Secondary Education major in Social Studies',
      'Bachelor of Secondary Education major in Science',
      'Teacher Certificate Program',
    ],
  },
  {
    value: 'CHTM',
    label: 'College of Hospitality and Tourism Management (CHTM)',
    programs: ['Bachelor of Science in Hospitality Management', 'Bachelor of Science in Tourism Management'],
  },
] as const;

export const DEPARTMENTS = DEPARTMENT_OPTIONS.map((department) => department.value);

const PROGRAM_ALIASES: Record<string, Record<string, string>> = {
  CAHS: {
    'bs nursing': 'Bachelor of Science in Nursing',
    'bs midwifery': 'Bachelor of Science in Midwifery',
  },
  CBA: {
    'bs accountancy': 'Bachelor of Science in Accountancy *',
    'bs customs administration': 'Bachelor of Science in Customs Administration',
  },
  CCS: {
    'bs computer science': 'Bachelor of Science in Computer Science',
    'bscs': 'Bachelor of Science in Computer Science',
    'bs entertainment and multimedia computing': 'Bachelor of Science in Entertainment and Multimedia Computing',
    'bsemc': 'Bachelor of Science in Entertainment and Multimedia Computing',
    'bs information technology': 'Bachelor of Science in Information Technology',
    bsit: 'Bachelor of Science in Information Technology',
  },
  CEAS: {
    'ba communication': 'Bachelor of Arts in Communication',
  },
  CHTM: {
    'bs hospitality management': 'Bachelor of Science in Hospitality Management',
    'bs tourism management': 'Bachelor of Science in Tourism Management',
  },
};

const PHILIPPINE_MOBILE_REGEX = /^\(\+63\)\s9\d{9}$/;

function normalizeLookupValue(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

export function resolveDepartmentValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const directMatch = DEPARTMENT_OPTIONS.find(
    (department) => department.value === trimmed || department.label.toLowerCase() === trimmed.toLowerCase(),
  );

  return directMatch?.value || trimmed;
}

export function getDepartmentLabel(value: string) {
  const resolved = resolveDepartmentValue(value);
  return DEPARTMENT_OPTIONS.find((department) => department.value === resolved)?.label || resolved;
}

export function getProgramsForDepartment(department: string) {
  const resolved = resolveDepartmentValue(department);
  return DEPARTMENT_OPTIONS.find((item) => item.value === resolved)?.programs ?? [];
}

export function normalizeProgramForDepartment(department: string, program: string) {
  const resolvedDepartment = resolveDepartmentValue(department);
  const trimmedProgram = program.trim();
  if (!trimmedProgram) return '';

  const programs = getProgramsForDepartment(resolvedDepartment);
  if (programs.includes(trimmedProgram)) {
    return trimmedProgram;
  }

  const lookupValue = normalizeLookupValue(trimmedProgram);
  const aliasMatch = PROGRAM_ALIASES[resolvedDepartment]?.[lookupValue];
  if (aliasMatch) {
    return aliasMatch;
  }

  return trimmedProgram;
}

export function getProgramOptionsForSelect(department: string, currentProgram?: string) {
  const programs = [...getProgramsForDepartment(department)];
  const normalizedCurrentProgram = normalizeProgramForDepartment(department, currentProgram || '');
  if (normalizedCurrentProgram && !programs.includes(normalizedCurrentProgram)) {
    programs.unshift(normalizedCurrentProgram);
  }
  return programs;
}

export function formatPhilippinePhoneInput(value: string) {
  const digitsOnly = value.replace(/\D/g, '');
  let normalizedDigits = digitsOnly;

  if (normalizedDigits.startsWith('63')) {
    normalizedDigits = normalizedDigits.slice(2);
  }
  if (normalizedDigits.startsWith('0')) {
    normalizedDigits = normalizedDigits.slice(1);
  }

  normalizedDigits = normalizedDigits.slice(0, 10);
  if (!normalizedDigits) return '';

  return `(+63) ${normalizedDigits}`;
}

export function isValidPhilippinePhoneNumber(value: string) {
  return PHILIPPINE_MOBILE_REGEX.test(formatPhilippinePhoneInput(value));
}

export const YEAR_LEVELS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
] as const;

export const MEDICAL_CONDITIONS = [
  { key: 'allergy', label: 'Allergy' },
  { key: 'asthma', label: 'Asthma' },
  { key: 'chickenPox', label: 'Chicken Pox' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'dysmenorrhea', label: 'Dysmenorrhea' },
  { key: 'epilepsySeizure', label: 'Epilepsy/Seizure' },
  { key: 'heartDisorder', label: 'Heart Disorder' },
  { key: 'hepatitis', label: 'Hepatitis' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'measles', label: 'Measles' },
  { key: 'mumps', label: 'Mumps' },
  { key: 'anxietyDisorder', label: 'Anxiety Disorder' },
  { key: 'panicAttack', label: 'Panic Attack/Hyperventilation' },
  { key: 'pneumonia', label: 'Pneumonia' },
  { key: 'ptbPrimaryComplex', label: 'PTB/Primary Complex' },
  { key: 'typhoidFever', label: 'Typhoid Fever' },
  { key: 'covid19', label: 'COVID-19' },
  { key: 'uti', label: 'Urinary Tract Infection' },
] as const;

export const DEFAULT_MEDICAL_HISTORY: MedicalHistoryState = {
  allergy: false,
  asthma: false,
  chickenPox: false,
  diabetes: false,
  dysmenorrhea: false,
  epilepsySeizure: false,
  heartDisorder: false,
  hepatitis: false,
  hypertension: false,
  measles: false,
  mumps: false,
  anxietyDisorder: false,
  panicAttack: false,
  pneumonia: false,
  ptbPrimaryComplex: false,
  typhoidFever: false,
  covid19: false,
  uti: false,
};
