import type { MedicalHistoryState } from './types';
import { getYearLevelLabel, MAX_ACADEMIC_YEAR_LEVEL } from '../../../lib/student-year';

export const DEPARTMENT_OPTIONS = [
  {
    value: 'CAHS',
    label: 'College of Allied Health Studies (CAHS)',
    programs: [
      'Bachelor of Science in Nursing (BSN)',
      'Bachelor of Science in Midwifery (BSM)',
    ],
  },
  {
    value: 'CBA',
    label: 'College of Business and Accountancy (CBA)',
    programs: [
      'Bachelor of Science in Accountancy (BSA)',
      'Bachelor of Science in Business Administration major in Financial Management',
      'Bachelor of Science in Business Administration major in Human Resource Management',
      'Bachelor of Science in Business Administration major in Marketing Management',
      'Bachelor of Science in Customs Administration (BSCA)',
    ],
  },
  {
    value: 'CCS',
    label: 'College of Computer Studies (CCS)',
    programs: [
      'Bachelor of Science in Computer Science (BSCS)',
      'Bachelor of Science in Information Technology (BSIT)',
      'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)',
    ],
  },
  {
    value: 'CEAS',
    label: 'College of Education, Arts, and Sciences (CEAS)',
    programs: [
      'Bachelor of Arts in Communication (BA Comm)',
      'Bachelor of Early Childhood Education (BECEd)',
      'Bachelor of Culture and Arts Education',
      'Bachelor of Physical Education (BPEd)',
      'Bachelor of Elementary Education (BEEd)',
      'Bachelor of Secondary Education major in English',
      'Bachelor of Secondary Education major in Filipino',
      'Bachelor of Secondary Education major in Mathematics',
      'Bachelor of Secondary Education major in Social Studies',
      'Bachelor of Secondary Education major in Science',
      'Teacher Certificate Program (TCP)',
    ],
  },
  {
    value: 'CHTM',
    label: 'College of Hospitality and Tourism Management (CHTM)',
    programs: [
      'Bachelor of Science in Hospitality Management (BSHM)',
      'Bachelor of Science in Tourism Management (BSTM)',
    ],
  },
] as const;

export const DEPARTMENTS = DEPARTMENT_OPTIONS.map((department) => department.value);

const PROGRAM_ALIASES: Record<string, Record<string, string>> = {
  CAHS: {
    'bs nursing': 'Bachelor of Science in Nursing (BSN)',
    'bsn': 'Bachelor of Science in Nursing (BSN)',
    'bs midwifery': 'Bachelor of Science in Midwifery (BSM)',
    'bsm': 'Bachelor of Science in Midwifery (BSM)',
  },
  CBA: {
    'bs accountancy': 'Bachelor of Science in Accountancy (BSA)',
    'bsa': 'Bachelor of Science in Accountancy (BSA)',
    'bs customs administration': 'Bachelor of Science in Customs Administration (BSCA)',
    'bsca': 'Bachelor of Science in Customs Administration (BSCA)',
    'bsba financial management': 'Bachelor of Science in Business Administration major in Financial Management',
    'bsba human resource management': 'Bachelor of Science in Business Administration major in Human Resource Management',
    'bsba marketing management': 'Bachelor of Science in Business Administration major in Marketing Management',
  },
  CCS: {
    'bs computer science': 'Bachelor of Science in Computer Science (BSCS)',
    'bscs': 'Bachelor of Science in Computer Science (BSCS)',
    'bs entertainment and multimedia computing': 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)',
    'bsemc': 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)',
    'bs information technology': 'Bachelor of Science in Information Technology (BSIT)',
    'bsit': 'Bachelor of Science in Information Technology (BSIT)',
  },
  CEAS: {
    'ba communication': 'Bachelor of Arts in Communication (BA Comm)',
    'ba comm': 'Bachelor of Arts in Communication (BA Comm)',
    'early childhood education': 'Bachelor of Early Childhood Education (BECEd)',
    'beced': 'Bachelor of Early Childhood Education (BECEd)',
    'culture and arts education': 'Bachelor of Culture and Arts Education',
    'physical education': 'Bachelor of Physical Education (BPEd)',
    'bped': 'Bachelor of Physical Education (BPEd)',
    'elementary education': 'Bachelor of Elementary Education (BEEd)',
    'beed': 'Bachelor of Elementary Education (BEEd)',
    'teacher certificate program': 'Teacher Certificate Program (TCP)',
    'tcp': 'Teacher Certificate Program (TCP)',
  },
  CHTM: {
    'bs hospitality management': 'Bachelor of Science in Hospitality Management (BSHM)',
    'bshm': 'Bachelor of Science in Hospitality Management (BSHM)',
    'bs tourism management': 'Bachelor of Science in Tourism Management (BSTM)',
    'bstm': 'Bachelor of Science in Tourism Management (BSTM)',
  },
};

export function abbreviateCourseDept(value?: string | null): string {
  const text = String(value || '').trim();
  if (!text) return '';

  // 1. If ending with abbreviation in parentheses, e.g. "... (BSIT)"
  const parenMatch = text.match(/\(([A-Za-z0-9&.\- ]+)\)\s*$/);
  if (parenMatch?.[1]) {
    return parenMatch[1].trim();
  }

  // 2. Exact match against known full program names or lowercase equivalents
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const knownMap: Record<string, string> = {
    'bachelor of science in information technology': 'BSIT',
    'bs information technology': 'BSIT',
    'bsit': 'BSIT',
    'bachelor of science in computer science': 'BSCS',
    'bs computer science': 'BSCS',
    'bscs': 'BSCS',
    'bachelor of science in entertainment and multimedia computing': 'BSEMC',
    'bs entertainment and multimedia computing': 'BSEMC',
    'bsemc': 'BSEMC',
    'bachelor of science in nursing': 'BSN',
    'bs nursing': 'BSN',
    'bsn': 'BSN',
    'bachelor of science in midwifery': 'BSM',
    'bs midwifery': 'BSM',
    'bsm': 'BSM',
    'bachelor of science in accountancy': 'BSA',
    'bs accountancy': 'BSA',
    'bsa': 'BSA',
    'bachelor of science in customs administration': 'BSCA',
    'bs customs administration': 'BSCA',
    'bsca': 'BSCA',
    'bachelor of science in hospitality management': 'BSHM',
    'bs hospitality management': 'BSHM',
    'bshm': 'BSHM',
    'bachelor of science in tourism management': 'BSTM',
    'bs tourism management': 'BSTM',
    'bstm': 'BSTM',
    'bachelor of science in business administration major in financial management': 'BSBA-FM',
    'bachelor of science in business administration major in human resource management': 'BSBA-HRM',
    'bachelor of science in business administration major in marketing management': 'BSBA-MM',
    'bachelor of science in business administration': 'BSBA',
    'bs business administration': 'BSBA',
    'bsba': 'BSBA',
    'bachelor of science in psychology': 'BSPsych',
    'bs psychology': 'BSPsych',
    'bspsych': 'BSPsych',
    'bachelor of arts in communication': 'BA Comm',
    'ba communication': 'BA Comm',
    'ba comm': 'BA Comm',
    'bachelor of early childhood education': 'BECEd',
    'beced': 'BECEd',
    'bachelor of culture and arts education': 'BCAEd',
    'bcaed': 'BCAEd',
    'bachelor of physical education': 'BPEd',
    'bped': 'BPEd',
    'bachelor of elementary education': 'BEEd',
    'beed': 'BEEd',
    'bachelor of secondary education major in english': 'BSEd-Eng',
    'bachelor of secondary education major in filipino': 'BSEd-Fil',
    'bachelor of secondary education major in mathematics': 'BSEd-Math',
    'bachelor of secondary education major in social studies': 'BSEd-Soc',
    'bachelor of secondary education major in science': 'BSEd-Sci',
    'bachelor of secondary education': 'BSEd',
    'bsed': 'BSEd',
    'teacher certificate program': 'TCP',
    'tcp': 'TCP',
  };

  if (knownMap[normalized]) {
    return knownMap[normalized];
  }

  // 3. If it's already an uppercase/hyphenated code (e.g., "BSIT", "BSBA-FM")
  if (/^[A-Za-z0-9\-./]{2,10}$/.test(text)) {
    return text.toUpperCase();
  }

  // 4. "Bachelor of Science in X" heuristic
  const bsInMatch = normalized.match(/^bachelor of science in\s+(.+)$/i);
  if (bsInMatch?.[1]) {
    const majorWords = bsInMatch[1]
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !['and', 'of', 'the', 'in'].includes(w));
    const majorAcronym = majorWords.map((w) => w[0]).join('').toUpperCase();
    if (majorAcronym) return `BS${majorAcronym}`;
  }

  // 5. General acronym of capitalized words or initial letters if still long
  if (text.length > 10) {
    const acronym = text
      .split(/\s+/)
      .filter(Boolean)
      .filter((part) => !['of', 'in', 'and', 'the', 'major'].includes(part.toLowerCase()))
      .map((part) => part[0])
      .join('')
      .toUpperCase();
    if (acronym.length >= 2 && acronym.length <= 8) {
      return acronym;
    }
  }

  return text;
}

const PHILIPPINE_MOBILE_REGEX = /^09\d{9}$/;

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

export function getProgramsForDepartment(department: string): string[] {
  const resolved = resolveDepartmentValue(department);
  const matchedPrograms = DEPARTMENT_OPTIONS.find((item) => item.value === resolved)?.programs;
  return matchedPrograms ? [...matchedPrograms] : [];
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
  if (normalizedDigits.startsWith('9')) {
    normalizedDigits = `0${normalizedDigits}`;
  }

  return normalizedDigits.slice(0, 11);
}

export function isValidPhilippinePhoneNumber(value: string) {
  return PHILIPPINE_MOBILE_REGEX.test(formatPhilippinePhoneInput(value));
}

export const YEAR_LEVELS = Array.from({ length: MAX_ACADEMIC_YEAR_LEVEL }, (_, index) => {
  const level = index + 1;
  return {
    value: String(level),
    label: getYearLevelLabel(level),
  };
});

export const LAB_TEST_SITE_OPTIONS = [
  'Hi-Precision Diagnostics Plus - Subic Bay Branch',
  'Lab1 Diagnostic Center',
  'MEDHUB Multispecialty Clinic and Diagnostic Laboratory',
  'Bioline Diagnostic Laboratory & Medical Clinic',
  'Health Scan Laboratory And Diagnostic Center',
  'Olongapo HealthCare Specialists',
  'Laceda Medical Clinic',
  'Ulticare Medical Center',
  'Tubban-Lab Ob Gyne And Medical Diagnostic Center',
  'ZMMG COOP Hospital',
  'Holy Infant Clinic',
  'James L. Gordon Memorial Hospital',
] as const;

export const EMERGENCY_CONTACT_RELATIONSHIPS = [
  'Parent',
  'Sibling',
  'Guardian',
  'Grandparent',
  'Spouse',
  'Relative',
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
  { key: 'others', label: 'Others' },
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
  others: false,
};

export const DATA_PRIVACY_CONSENT_BODY =
  'Under the Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations, I voluntarily consent to the collection, use, storage, and processing of my personal and health-related information by the Gordon College Clinic for medical record submission, evaluation, clinic record management, and related student health services. I understand that my information will be accessed only by authorized Gordon College personnel, may be retained in physical or electronic systems in accordance with school policy and lawful requirements, and will be protected through reasonable organizational, physical, and technical safeguards.';

export const DATA_PRIVACY_RIGHTS_NOTICE =
  'I understand that, subject to applicable law and Gordon College procedures, I may request to be informed about, access, correct, or raise concerns regarding my personal data through the appropriate Gordon College office or Data Privacy Office.';

export const DATA_PRIVACY_CONSENT_ACKNOWLEDGEMENT =
  'I have read and understood this Data Privacy Consent pursuant to Republic Act No. 10173, and I agree to the collection and processing of my personal and medical information for clinic record processing and related health services.';

export const DATA_PRIVACY_PREVIEW_TEXT =
  'Data Privacy Waiver: I am willing to disclose my personal information with the GC clinic. I have the right to access my personal data in a timely manner (5days request). The clinic respect patients privacy and accountable to protect my personal information.';
