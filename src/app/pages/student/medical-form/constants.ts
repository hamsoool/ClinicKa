import type { MedicalHistoryState } from './types';

export const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'] as const;

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
