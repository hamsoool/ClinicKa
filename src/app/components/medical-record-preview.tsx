import { forwardRef, memo } from 'react';
import type { ForwardedRef } from 'react';
import { formatAcademicYearLabel, getRecordAcademicYear, getSubmissionSlotLabel, normalizeSubmissionSlot } from '../lib/academic-year';
import type { SubmissionRecord } from '../lib/record-types';
import { DATA_PRIVACY_PREVIEW_TEXT } from '../pages/student/medical-form/constants';

const EXAM_ROWS = [
  'BP', 'CR', 'RR', 'Temp.', 'Weight', 'Height', 'BMI',
  'Visual Acuity', 'Skin', 'HEENT', 'Chest/Lungs', 'Heart',
  'Abdomen', 'Extremities', 'Others, specify',
];

const EXAM_FIELD_MAP: Record<string, string> = {
  BP: 'bloodPressure',
  CR: 'cardiacRate',
  RR: 'respiratoryRate',
  'Temp.': 'temperature',
  Weight: 'weight',
  Height: 'height',
  BMI: 'bmi',
  'Visual Acuity': 'visualAcuity',
  Skin: 'skin',
  HEENT: 'heent',
  'Chest/Lungs': 'chestLungs',
  Heart: 'heart',
  Abdomen: 'abdomen',
  Extremities: 'extremities',
  'Others, specify': 'others',
};

const CLEARANCE_SIGNATORY_NAMES = ['GERALD S. BERNAL, MD', 'ARMANDO TAMAYO, MD'] as const;
const RECORD_COLUMNS_PER_PAGE = 4;
const RECORD_TABLE_WIDTH = '764px';
const EXAM_FIRST_COLUMN_WIDTH = '168px';
const EXAM_YEAR_COLUMN_WIDTH = '149px';
const LAB_FIRST_COLUMN_WIDTH = '68px';
const LAB_YEAR_COLUMN_WIDTH = '174px';

const MEDICAL_HISTORY_ROWS: { key: string; label: string }[][] = [
  [
    { key: 'allergy', label: 'Allergy' },
    { key: 'epilepsySeizure', label: 'Epilepsy/Seizure' },
    { key: 'mumps', label: 'Mumps' },
    { key: 'typhoidFever', label: 'Typhoid Fever' },
  ],
  [
    { key: 'asthma', label: 'Asthma' },
    { key: 'heartDisorder', label: 'Heart disorder' },
    { key: 'anxietyDisorder', label: 'Anxiety disorder' },
    { key: 'covid19', label: 'COVID-19' },
  ],
  [
    { key: 'chickenPox', label: 'Chicken Pox' },
    { key: 'hepatitis', label: 'Hepatitis' },
    { key: 'panicAttack', label: 'Panic attack/Hyperventilation' },
    { key: 'uti', label: 'Urinary Tract Infection' },
  ],
  [
    { key: 'diabetes', label: 'Diabetes' },
    { key: 'hypertension', label: 'Hypertension' },
    { key: 'pneumonia', label: 'Pneumonia' },
    { key: '_blank_1', label: '' },
  ],
  [
    { key: 'dysmenorrhea', label: 'Dysmenorrhea' },
    { key: 'measles', label: 'Measles' },
    { key: 'ptbPrimaryComplex', label: 'PTB/Primary Complex' },
    { key: '_blank_2', label: '' },
  ],
];

const S = {
  page: {
    fontFamily: 'Arial, sans-serif',
    fontSize: '10.5px',
    color: '#000',
    background: '#fff',
    width: '816px',
    margin: '0 auto',
    padding: '18px 22px 16px 22px',
    display: 'flex',
    flexDirection: 'column' as const,
    boxSizing: 'border-box' as const,
  },
  logoCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: '2px solid #555',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '7px',
    textAlign: 'center' as const,
    color: '#333',
    background: '#f5f5f5',
    overflow: 'hidden',
    flexShrink: 0,
  },
  fieldLabel: {
    fontWeight: 'bold' as const,
    whiteSpace: 'nowrap' as const,
    fontSize: '10.5px',
  },
  line: {
    borderBottom: '1px solid #000',
    minWidth: '30px',
    height: '19px',
    display: 'inline-flex',
    alignItems: 'flex-end',
    lineHeight: '1.15',
    padding: '0 2px 4px 2px',
    boxSizing: 'border-box' as const,
    overflow: 'hidden',
  },
  checkbox: (checked: boolean) => ({
    display: 'inline-block',
    width: '10px',
    height: '10px',
    border: '1px solid #000',
    verticalAlign: 'middle' as const,
    marginRight: '2px',
    background: checked ? '#000' : '#fff',
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    tableLayout: 'fixed' as const,
    marginBottom: '6px',
    fontSize: '10px',
    border: '1px solid #000',
  },
  th: {
    border: '1px solid #000',
    padding: '2px 4px 4px 4px',
    verticalAlign: 'middle' as const,
    fontWeight: 'bold' as const,
    background: '#fff',
    textAlign: 'left' as const,
    lineHeight: '1.15',
  },
  td: {
    border: '1px solid #000',
    padding: '2px 4px 4px 4px',
    verticalAlign: 'middle' as const,
    lineHeight: '1.15',
  },
};

function GordonCollegeLogo({ size = 64 }: { size?: number }) {
  return (
    <img
      src="/gordon-college-logo.png"
      alt="Gordon College logo"
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}
function AcademicAffairsLogo({ size = 64 }: { size?: number }) {
  return (
    <img
      src="/gordon_college_academicaffairs.png"
      alt="Academic Affairs logo"
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}
function HSULogo({ size = 64 }: { size?: number }) {
  return (
    <img
      src="/gordonhsc.png"
      alt="Health Services Unit logo"
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}

interface Props {
  record: SubmissionRecord;
  records?: SubmissionRecord[];
  academicYearLabel?: string;
}

function abbreviateCourseDept(value: string) {
  const text = String(value || '').trim();
  if (!text) return '';
  const acronymInParens = text.match(/\(([A-Za-z0-9&.\- ]+)\)\s*$/);
  if (acronymInParens?.[1]) return acronymInParens[1].trim();
  const upperCode = text.match(/\b([A-Z]{2,}(?:[-/][A-Z]{2,})?)\b/);
  if (upperCode?.[1]) return upperCode[1].trim();
  return text;
}

function formatLocalPhone(value: string) {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  let normalized = digitsOnly;
  if (normalized.startsWith('63')) normalized = normalized.slice(2);
  if (normalized.startsWith('0')) normalized = normalized.slice(1);
  normalized = normalized.slice(0, 10);
  if (normalized.length === 10 && normalized.startsWith('9')) return `0${normalized}`;
  return String(value || '').trim();
}

function normalizeExaminerName(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b(m\.?\s*d\.?|doctor|dr\.?|rn|r\.?\s*n\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isClearanceSignatoryName(value?: string | null) {
  const normalized = normalizeExaminerName(value);
  return Boolean(
    normalized &&
    CLEARANCE_SIGNATORY_NAMES.some((name) => normalizeExaminerName(name) === normalized),
  );
}

function formatXrayResult(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'normal') return 'Normal';
  if (normalized === 'abnormal') return 'Abnormal';
  return '';
}

function getExamCompletenessScore(record: SubmissionRecord) {
  const exam = record.staffMeasurements || {};
  const values = [
    exam.bloodPressure,
    exam.cardiacRate,
    exam.respiratoryRate,
    exam.temperature,
    exam.weight,
    exam.height,
    exam.bmi,
    exam.visualAcuity,
    exam.skin,
    exam.heent,
    exam.chestLungs,
    exam.heart,
    exam.abdomen,
    exam.extremities,
    exam.others,
    exam.examinedBy,
    exam.examinedBySignatureUrl,
    record.bloodPressure,
    record.weight,
    record.height,
    record.bmi,
  ];

  return values.filter((value) => String(value || '').trim().length > 0).length;
}

function buildBestRecordBySlot(records: SubmissionRecord[]) {
  const recordsBySlot = new Map<number, SubmissionRecord>();

  for (const item of records) {
    const slot = normalizeSubmissionSlot(item.year);
    if (!slot) continue;

    const current = recordsBySlot.get(slot);
    if (!current) {
      recordsBySlot.set(slot, item);
      continue;
    }

    const currentScore = getExamCompletenessScore(current);
    const nextScore = getExamCompletenessScore(item);
    if (nextScore > currentScore) {
      recordsBySlot.set(slot, item);
      continue;
    }
    if (currentScore > nextScore) {
      continue;
    }

    const currentTs = new Date(current.updatedAt || current.submittedAt || 0).getTime();
    const nextTs = new Date(item.updatedAt || item.submittedAt || 0).getTime();
    if (nextTs >= currentTs) {
      recordsBySlot.set(slot, item);
    }
  }

  return recordsBySlot;
}

function buildSlotPages(recordsBySlot: Map<number, SubmissionRecord>, fallbackSlot: number) {
  const highestSlot = Math.max(fallbackSlot, ...recordsBySlot.keys());
  const totalPages = Math.max(1, Math.ceil(highestSlot / RECORD_COLUMNS_PER_PAGE));

  return Array.from({ length: totalPages }, (_, pageIndex) => {
    const pageStart = pageIndex * RECORD_COLUMNS_PER_PAGE + 1;
    return Array.from({ length: RECORD_COLUMNS_PER_PAGE }, (_, columnIndex) => pageStart + columnIndex);
  });
}

const MedicalRecordPreviewBase = forwardRef(function MedicalRecordPreviewBase(
  { record, records = [], academicYearLabel }: Props,
  ref: ForwardedRef<HTMLDivElement>
) {
    const history = record.medicalHistory || {};
    const civilStatusNormalized = String(record.civilStatus || '').trim().toLowerCase();
    const photoUrl = record.photoUrl;
    const signatureUrl = record.signatureUrl;
    const dedupedRecords = Array.from(
      new Map(
        [...records, record]
          .filter((item): item is SubmissionRecord => Boolean(item?.id))
          .map((item) => [item.id, item]),
      ).values(),
    );
    const fallbackSlot = normalizeSubmissionSlot(record.year) || 1;
    const recordsBySlot = buildBestRecordBySlot(dedupedRecords);
    const slotPages = buildSlotPages(recordsBySlot, fallbackSlot);
    const resolvedAcademicYearLabel = academicYearLabel || formatAcademicYearLabel(getRecordAcademicYear(record));

    const getExamFieldValue = (
      sourceRecord: SubmissionRecord | undefined,
      field: string
    ) => {
      if (!sourceRecord) return '';
      const sourceExam = sourceRecord.staffMeasurements || {};
      const direct = (sourceExam as any)?.[field];
      if (String(direct || '').trim()) return direct;
      if (field === 'bloodPressure') return sourceRecord.bloodPressure || '';
      if (field === 'weight') return sourceRecord.weight || '';
      if (field === 'height') return sourceRecord.height || '';
      if (field === 'bmi') return sourceRecord.bmi || '';
      return '';
    };

    const getSlotRecord = (slot: number) => recordsBySlot.get(slot);

    const getSlotExamValue = (slot: number, row: string) => {
      const field = EXAM_FIELD_MAP[row];
      if (!field) return '';
      const sourceRecord = getSlotRecord(slot);
      if (!sourceRecord) return '';
      return getExamFieldValue(sourceRecord, field);
    };

    const getSlotLab = (slot: number) => getSlotRecord(slot)?.labResults || {};

    const getSlotExaminer = (slot: number) => {
      const sourceExam = getSlotRecord(slot)?.staffMeasurements || {};
      return {
        name: String(sourceExam?.examinedBy || '').trim(),
        signatureUrl: String(sourceExam?.examinedBySignatureUrl || '').trim(),
      };
    };

    const formatExamDate = (sourceRecord?: SubmissionRecord) => {
      if (!sourceRecord) return '';
      const rawDate =
        sourceRecord.staffMeasurements?.updatedAt ||
        sourceRecord.updatedAt ||
        sourceRecord.submittedAt;
      if (!rawDate) return '';
      const parsed = new Date(rawDate);
      if (Number.isNaN(parsed.getTime())) return '';
      return parsed.toLocaleDateString();
    };

    const getSlotExamDate = (slot: number) => formatExamDate(getSlotRecord(slot));

    const renderExaminer = (slot: number) => {
      const examiner = getSlotExaminer(slot);
      const displayName = examiner.name;
      if (!examiner.signatureUrl && !displayName) return null;

      return (
        <div
          className="relative flex min-h-[52px] w-full items-start justify-start text-left"
          style={{
            width: '100%',
            minHeight: '52px',
            overflow: 'hidden',
          }}
        >
          {examiner.signatureUrl ? (
            <img
              src={examiner.signatureUrl}
              alt="Examiner signature"
              crossOrigin="anonymous"
              style={{
                position: 'absolute',
                left: '0',
                top: '2px',
                maxWidth: '100%',
                width: '100%',
                height: '30px',
                objectFit: 'contain',
                objectPosition: 'left center',
                display: 'block',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          ) : null}
          {displayName ? (
            <span
              style={{
                position: 'absolute',
                left: '0',
                right: '0',
                bottom: '1px',
                fontSize: '8.75px',
                lineHeight: '1.15',
                wordBreak: 'break-word',
                zIndex: 1,
              }}
            >
              {displayName}
            </span>
          ) : null}
        </div>
      );
    };

    const inlineField = (value: unknown, minWidth = '44px') => {
      const text = String(value || '').trim();
      return (
        <span
          className="relative inline-block whitespace-nowrap align-baseline print:align-baseline"
          style={{
            position: 'relative',
            display: 'inline-block',
            minWidth,
            height: '16px',
            lineHeight: '10px',
            padding: '0 1px 5px 1px',
            verticalAlign: 'baseline',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ position: 'relative', zIndex: 1, display: 'inline-block', transform: 'translateY(-2px)' }}>
            {text || '\u00A0'}
          </span>
          <span
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -1,
              borderBottom: '1px solid #000',
              zIndex: 0,
            }}
          />
        </span>
      );
    };

    const renderCheckbox = (checked: boolean) => (
      <span
        className="pdf-print-exact relative inline-block h-[10px] w-[10px] shrink-0 align-middle print:shrink-0"
        style={S.checkbox(checked)}
      />
    );

    const wrappedField = (value: unknown) => {
      const text = String(value || '').trim();
      return (
        <span
          style={{
            display: 'inline',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            lineHeight: '1.25',
          }}
        >
          {text}
        </span>
      );
    };

    const getSlotHeaderLabel = (slot: number) => getSubmissionSlotLabel(slot).replace('Year ', 'Yr. ');

    const getSlotReceivedDate = (slot: number) => {
      const sourceRecord = getSlotRecord(slot);
      if (!sourceRecord?.updatedAt) return '';

      const parsed = new Date(sourceRecord.updatedAt);
      if (Number.isNaN(parsed.getTime())) return '';
      return parsed.toLocaleDateString();
    };

    return (
      <div ref={ref} className="pdf-print-exact flex flex-col gap-4 bg-white print:gap-0">
        {slotPages.map((slots, pageIndex) => (
          <div
            key={`medical-record-page-${slots[0]}`}
            className="pdf-print-exact flex flex-col bg-white print:flex print:flex-col"
            style={{
              ...S.page,
              marginBottom: pageIndex === slotPages.length - 1 ? '0' : '16px',
              breakAfter: pageIndex === slotPages.length - 1 ? 'auto' : 'page',
              pageBreakAfter: pageIndex === slotPages.length - 1 ? 'auto' : 'always',
            }}
          >

        {/* ── HEADER ── */}
        <div
          className="flex items-center justify-between print:flex print:flex-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          {/* Logos */}
          <div className="flex items-center gap-[6px] print:flex print:flex-row" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={S.logoCircle}>
              <GordonCollegeLogo size={64} />
            </div>
            <div style={S.logoCircle}>
              <AcademicAffairsLogo size={64} />
            </div>
            <div style={S.logoCircle}>
              <HSULogo size={64} />
            </div>
          </div>

          {/* Center text */}
          <div style={{ textAlign: 'center', flex: 1, padding: '0 10px' }}>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 900,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                marginBottom: '3px',
              }}
            >
              Gordon College
            </div>
            <p style={{ fontSize: '9px', lineHeight: '1.7' }}>
              Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City
            </p>
            <p style={{ fontSize: '9px', lineHeight: '1.7' }}>
              Tel. No.: (047) 222-2089 / (047) 603-7175
            </p>
            <p style={{ fontSize: '9px', lineHeight: '1.7' }}>
              Website: www.gordoncollege.edu.ph
            </p>
          </div>

          {/* Photo box */}
          <div
            style={{
              border: '1px solid #000',
              width: '78px',
              height: '78px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 'bold',
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="1x1 photo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <>1 x 1<br />photo</>
            )}
          </div>
        </div>

        {/* ── STUDENT # + UNIT TITLE ── */}
        <div
          className="flex items-center justify-between print:flex print:flex-row"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: '8px 0 6px 0',
          }}
        >
          <div
            style={{
              border: '1px solid #000',
              padding: '4px 10px',
              fontWeight: 'bold',
              fontSize: '10.5px',
              minWidth: '150px',
            }}
          >
            Student #: {record.studentId || ''}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', flex: 1 }}>
            Health Services Unit
          </div>
          <div style={{ minWidth: '120px', textAlign: 'right', fontSize: '9px', fontWeight: 'bold', lineHeight: '1.35' }}>
            <div>School Year</div>
            <div>{resolvedAcademicYearLabel}</div>
          </div>
        </div>

        {/* ── NAME ROWS ── */}
        <div
          className="flex items-stretch print:flex print:flex-row print:items-stretch"
          style={{ display: 'flex', alignItems: 'stretch', marginTop: '7px' }}
        >
          {/* Last Name */}
          <div className="w-[130px] min-w-[130px] shrink-0 print:min-w-[130px]" style={{ width: '130px', flexShrink: 0 }}>
            <div
              className="flex h-[20px] items-end gap-1 print:flex print:flex-row print:items-end"
              style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '20px' }}
            >
              <span style={S.fieldLabel}>Name:</span>
              <div style={{ ...S.line, flex: 1 }}>{record.lastName || ''}</div>
            </div>
            <div style={{ fontWeight: 'bold', fontSize: '10.5px', marginTop: '2px' }}>
              Last Name
            </div>
          </div>

          {/* First Name */}
          <div className="ml-[6px] min-w-[220px] flex-[2] print:min-w-[220px]" style={{ flex: 2, marginLeft: '6px' }}>
            <div className="flex h-[20px] items-end print:flex print:flex-row print:items-end" style={{ height: '20px', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ ...S.line, flex: 1, justifyContent: 'center' }}>
                {record.firstName || ''}
              </div>
            </div>
            <div
              style={{
                fontWeight: 'bold',
                fontSize: '10.5px',
                textAlign: 'center',
                marginTop: '2px',
              }}
            >
              First Name
            </div>
          </div>

          {/* M.I. */}
          <div className="ml-[8px] w-[42px] min-w-[42px] shrink-0 print:min-w-[42px]" style={{ width: '42px', flexShrink: 0, marginLeft: '8px' }}>
            <div className="flex h-[20px] items-end print:flex print:flex-row print:items-end" style={{ height: '20px', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ ...S.line, flex: 1, justifyContent: 'center' }}>
                {record.middleInitial || ''}
              </div>
            </div>
            <div
              style={{
                fontWeight: 'bold',
                fontSize: '10.5px',
                textAlign: 'center',
                marginTop: '2px',
              }}
            >
              M. I.
            </div>
          </div>

          {/* Course / Age / Sex */}
          <div className="ml-[8px] min-w-[250px] flex-[1.2] print:min-w-[250px]" style={{ flex: 1.2, marginLeft: '8px' }}>
            <div
              className="flex h-[20px] items-end gap-1 print:flex print:flex-row print:items-end"
              style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '20px' }}
            >
              <span style={S.fieldLabel}>Course/Dept.</span>
              <div style={{ ...S.line, flex: 1 }}>
                {abbreviateCourseDept(record.course || '')}
              </div>
            </div>
            <div
              className="flex items-center gap-2 print:flex print:flex-row print:items-center"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}
            >
              <span style={S.fieldLabel}>Age:</span>
              <div
                style={{
                  ...S.line,
                  width: '32px',
                  flex: 'none',
                  justifyContent: 'center',
                }}
              >
                {record.age || ''}
              </div>
              <span style={{ ...S.fieldLabel, marginLeft: '4px' }}>Sex: F</span>
              {renderCheckbox(record.sex === 'female')}
              <span style={S.fieldLabel}>M</span>
              {renderCheckbox(record.sex === 'male')}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '7px' }} />

        {/* ── BIRTHDAY ROW ── */}
        <div
          className="flex flex-nowrap items-end gap-[6px] print:flex print:flex-row print:flex-nowrap"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '6px',
            marginBottom: '8px',
            flexWrap: 'nowrap',
          }}
        >
          <span style={S.fieldLabel}>Birthday:</span>
          <div style={{ ...S.line, minWidth: '140px' }}>{record.birthday || ''}</div>
          <span style={{ ...S.fieldLabel, marginLeft: '10px' }}>Civil Status: Single</span>
          {renderCheckbox(civilStatusNormalized === 'single' || !civilStatusNormalized)}
          <span style={S.fieldLabel}>Married</span>
          {renderCheckbox(civilStatusNormalized === 'married')}
          <span style={{ ...S.fieldLabel, marginLeft: '14px' }}>Tel. /CPR:</span>
          <div style={{ ...S.line, minWidth: '140px' }}>
            {formatLocalPhone(record.contactNumber || '')}
          </div>
        </div>

        {/* ── PRESENT ADDRESS ── */}
        <div
          className="flex flex-nowrap items-end gap-[6px] print:flex print:flex-row print:flex-nowrap"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '6px',
            marginBottom: '8px',
            flexWrap: 'nowrap',
          }}
        >
          <span style={S.fieldLabel}>Present Address:</span>
          <div className="min-w-[620px] flex-1 print:min-w-[620px]" style={{ ...S.line, flex: 1 }}>
            {record.address || ''}
          </div>
        </div>

        {/* ── MEDICAL HISTORY ── */}
        <div style={{ fontWeight: 'bold', margin: '8px 0 5px 0', fontSize: '10.5px' }}>
          • MEDICAL HISTORY: place a CHECK (✔) if you have or had.
        </div>
        <div
          style={{
            border: '1px solid #000',
            padding: '7px 9px',
            marginBottom: '8px',
          }}
        >
          {MEDICAL_HISTORY_ROWS.map((row, i) => (
            <div
              className="flex print:flex print:flex-row"
              key={i}
              style={{
                display: 'flex',
                marginBottom: i === MEDICAL_HISTORY_ROWS.length - 1 ? '0' : '6px',
              }}
            >
              {row.map((item, j) => (
                <div
                  className="flex flex-1 items-center gap-1 print:flex print:flex-row print:items-center"
                  key={`${item.key}-${j}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flex: 1,
                    fontSize: '10.5px',
                  }}
                >
                  {item.key.startsWith('_blank_') ? null : (
                    <>
                      {renderCheckbox(!!history[item.key as keyof typeof history])}
                      {item.label}
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── OPERATION ── */}
        <div
          className="flex items-end gap-1 print:flex print:flex-row print:items-end"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            marginBottom: '8px',
            gap: '4px',
          }}
        >
          <span style={S.fieldLabel}>
            • Have you had any operation in the past?&nbsp; YES
          </span>
          {renderCheckbox(record.hadOperation === 'yes')}
          <span style={S.fieldLabel}>&nbsp;NO</span>
          {renderCheckbox(record.hadOperation === 'no')}
        </div>
        <div
          className="flex items-end gap-1 print:flex print:flex-row print:items-end"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            marginBottom: '8px',
            gap: '4px',
          }}
        >
          <span style={S.fieldLabel}>
            • If yes, state the nature of the operation and date/year
          </span>
          <div style={{ ...S.line, flex: 1 }}>
            {record.hadOperation === 'yes' ? record.operationDetails || '' : ''}
          </div>
        </div>
        <div style={{ height: '8px' }} />

        {/* ── EMERGENCY CONTACT ── */}
        <div
          className="flex items-end gap-1 print:flex print:flex-row print:items-end"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            marginBottom: '8px',
            gap: '4px',
          }}
        >
          <span style={S.fieldLabel}>• Emergency Contact Person Name:</span>
          <div style={{ ...S.line, minWidth: '160px' }}>
            {record.emergencyContact?.name || ''}
          </div>
          <span style={{ ...S.fieldLabel, marginLeft: '95px' }}>Relationship:</span>
          <div style={{ ...S.line, minWidth: '140px' }}>
            {record.emergencyContact?.relationship || ''}
          </div>
        </div>
        <div
          className="flex items-end gap-1 print:flex print:flex-row print:items-end"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            marginBottom: '8px',
            gap: '4px',
          }}
        >
          <span style={S.fieldLabel}>Address:</span>
          <div style={{ ...S.line, minWidth: '250px' }}>
            {record.emergencyContact?.address || ''}
          </div>
          <span style={{ ...S.fieldLabel, marginLeft: '140px' }}>Tel. phone No. CP:</span>
          <div style={{ ...S.line, minWidth: '160px' }}>
            {formatLocalPhone(record.emergencyContact?.phone || '')}
          </div>
        </div>
        <div style={{ height: '8px' }} />

        {/* ── PRIVACY WAIVER ── */}
        <div
          style={{ fontSize: '9.5px', lineHeight: '1.7', margin: '9px 0 6px 0' }}
        >
          • {DATA_PRIVACY_PREVIEW_TEXT}
        </div>

        {/* ── SIGNATURE ── */}
        <div
          style={{ textAlign: 'right', marginBottom: '9px', fontSize: '10.5px' }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px', marginRight: '20px' }}>
            Signature of Student
          </div>
          <div
            style={{
              display: 'inline-block',
              borderBottom: '1px solid #000',
              minWidth: '180px',
              minHeight: '26px',
              textAlign: 'center',
            }}
          >
            {signatureUrl ? (
              <img
                src={signatureUrl}
                alt="Student signature"
                style={{
                  maxWidth: '170px',
                  maxHeight: '24px',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  verticalAlign: 'middle',
                  display: 'inline-block',
                }}
              />
            ) : (
              ''
            )}
          </div>
        </div>

        {/* ── PHYSICAL EXAMINATION TABLE ── */}
        <div className="w-full min-w-[764px] print:min-w-[764px]">
        <table className="w-full min-w-[764px] table-fixed border-collapse print:min-w-[764px]" style={S.table}>
          <colgroup>
            <col style={{ width: EXAM_FIRST_COLUMN_WIDTH, minWidth: EXAM_FIRST_COLUMN_WIDTH }} />
            {slots.map((slot) => (
              <col key={slot} style={{ width: EXAM_YEAR_COLUMN_WIDTH, minWidth: EXAM_YEAR_COLUMN_WIDTH }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...S.th, width: EXAM_FIRST_COLUMN_WIDTH, minWidth: EXAM_FIRST_COLUMN_WIDTH }}>Physical Examination</th>
              {slots.map((slot) => (
                <th
                  key={slot}
                  style={{ ...S.th, width: EXAM_YEAR_COLUMN_WIDTH, minWidth: EXAM_YEAR_COLUMN_WIDTH }}
                >
                  <div className="flex flex-col gap-[2px] print:flex print:flex-col" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>{`${getSlotHeaderLabel(slot)} / Date:`}</span>
                    <span style={{ fontWeight: 'normal' }}>{getSlotExamDate(slot)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXAM_ROWS.map((row) => (
              <tr key={row}>
                <td style={{ ...S.td, fontWeight: 'bold', height: '22px' }}>{row}</td>
                {slots.map((slot) => (
                  <td key={slot} style={{ ...S.td, height: '22px' }}>
                    {getSlotExamValue(slot, row)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td style={{ ...S.td, fontWeight: 'bold', height: '56px' }}>Examined by:</td>
              {slots.map((slot) => (
                <td key={slot} style={{ ...S.td, height: '56px', padding: '2px 4px' }}>
                  {renderExaminer(slot)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        </div>

        {/* ── LABS TABLE ── */}
        <div className="w-full min-w-[764px] print:min-w-[764px]">
        <table
          className="w-full min-w-[764px] table-fixed border-collapse print:min-w-[764px]"
          style={{ ...S.table, fontSize: '9.5px', minWidth: RECORD_TABLE_WIDTH }}
        >
          <colgroup>
            <col style={{ width: LAB_FIRST_COLUMN_WIDTH, minWidth: LAB_FIRST_COLUMN_WIDTH }} />
            {slots.map((slot) => (
              <col key={slot} style={{ width: LAB_YEAR_COLUMN_WIDTH, minWidth: LAB_YEAR_COLUMN_WIDTH }} />
            ))}
          </colgroup>
          <tbody>
            {/* Chest X-ray */}
            <tr>
              <td
                style={{
                  ...S.td,
                  width: LAB_FIRST_COLUMN_WIDTH,
                  minWidth: LAB_FIRST_COLUMN_WIDTH,
                  verticalAlign: 'middle',
                  fontWeight: 'bold',
                }}
              >
                Chest :<br />x-ray
              </td>
              {slots.map((slot) => {
                const y = getSlotLab(slot);
                return (
                  <td
                    key={slot}
                    style={{
                      ...S.td,
                      width: LAB_YEAR_COLUMN_WIDTH,
                      minWidth: LAB_YEAR_COLUMN_WIDTH,
                      verticalAlign: 'top',
                      lineHeight: '1.8',
                      padding: '5px 5px',
                    }}
                  >
                    <div className="min-w-[164px] print:min-w-[164px]">Date: {inlineField(y.xrayDate, '52px')}</div>
                    <div
                      className="flex items-baseline justify-between gap-1 print:flex print:flex-row print:items-baseline"
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: '4px',
                      }}
                    >
                      <span>Abnormal findings</span>
                      <span>Result: {inlineField(formatXrayResult(y.xrayResult), '42px')}</span>
                    </div>
                    <div>{wrappedField(y.xrayFindings)}</div>
                  </td>
                );
              })}
            </tr>

            {/* CBC */}
            <tr>
              <td
                style={{ ...S.td, verticalAlign: 'middle', fontWeight: 'bold' }}
              >
                CBC:
              </td>
              {slots.map((slot) => {
                const y = getSlotLab(slot);
                return (
                  <td
                    key={slot}
                    style={{
                      ...S.td,
                      width: LAB_YEAR_COLUMN_WIDTH,
                      minWidth: LAB_YEAR_COLUMN_WIDTH,
                      verticalAlign: 'top',
                      lineHeight: '1.8',
                      padding: '5px 5px',
                    }}
                  >
                    <div className="min-w-[164px] print:min-w-[164px]">Date: {inlineField(y.cbcDate, '52px')}</div>
                    <div className="min-w-[164px] print:min-w-[164px]">
                      Hgb. {inlineField(y.hemoglobin, '36px')} Hct.{' '}
                      {inlineField(y.hematocrit, '36px')}
                    </div>
                    <div className="min-w-[164px] print:min-w-[164px]">WBC {inlineField(y.wbc, '42px')} &lt;</div>
                    <div className="min-w-[164px] print:min-w-[164px]">Plt. Ct. {inlineField(y.plateletCount, '42px')}</div>
                    <div className="min-w-[164px] print:min-w-[164px]">Bld. Type {inlineField(y.bloodType, '42px')}</div>
                  </td>
                );
              })}
            </tr>

            {/* U/A */}
            <tr>
              <td
                style={{ ...S.td, verticalAlign: 'middle', fontWeight: 'bold' }}
              >
                U/A:
              </td>
              {slots.map((slot) => {
                const y = getSlotLab(slot);
                return (
                  <td
                    key={slot}
                    style={{
                      ...S.td,
                      width: LAB_YEAR_COLUMN_WIDTH,
                      minWidth: LAB_YEAR_COLUMN_WIDTH,
                      verticalAlign: 'top',
                      lineHeight: '1.8',
                      padding: '5px 5px',
                    }}
                  >
                    <div>Date: {inlineField(y.urinalysisDate, '52px')}</div>
                    <div>•Glucose/Sugar {inlineField(y.urinalysisGlucose, '56px')}</div>
                    <div>•Protein {inlineField(y.urinalysisProtein, '56px')}</div>
                  </td>
                );
              })}
            </tr>

            {/* OTHERS */}
            <tr>
              <td style={{ ...S.td, verticalAlign: 'top', fontWeight: 'bold' }}>
                OTHERS:
              </td>
              {slots.map((slot) => (
                <td key={slot} style={S.td}>
                  {getSlotLab(slot).others || ''}
                </td>
              ))}
            </tr>

            {/* Date Received */}
            <tr>
              <td style={{ ...S.td, verticalAlign: 'top', fontWeight: 'bold' }}>
                Date<br />Received:
              </td>
              {slots.map((slot) => (
                <td key={slot} style={S.td}>
                  {getSlotReceivedDate(slot)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            fontSize: '9px',
            marginTop: '8px',
            color: '#333',
          }}
        >
          Revision#4 &nbsp;&nbsp; 05/2024 qbb
        </div>

      </div>
        ))}
      </div>
    );
  }
);

MedicalRecordPreviewBase.displayName = 'MedicalRecordPreviewBase';
const MedicalRecordPreview = memo(MedicalRecordPreviewBase);
MedicalRecordPreview.displayName = 'MedicalRecordPreview';
export default MedicalRecordPreview;
