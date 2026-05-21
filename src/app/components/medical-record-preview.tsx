import { forwardRef, memo } from 'react';
import type { ForwardedRef } from 'react';
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
    minHeight: '1344px',
    margin: '0 auto',
    padding: '22px 26px 20px 26px',
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
    borderBottom: '1.2px solid #000',
    minWidth: '30px',
    height: '18px',
    display: 'inline-flex',
    alignItems: 'flex-end',
    lineHeight: '1.3',
    padding: '0 2px 2px 2px',
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
    marginBottom: '8px',
    fontSize: '10px',
    border: '1.5px solid #000',
  },
  th: {
    border: '1.5px solid #000',
    padding: '3px 5px',
    verticalAlign: 'middle' as const,
    fontWeight: 'bold' as const,
    background: '#fff',
    textAlign: 'left' as const,
  },
  td: {
    border: '1.5px solid #000',
    padding: '4px 5px',
    verticalAlign: 'middle' as const,
    lineHeight: '1.35',
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
  yearlyRecords?: Partial<Record<1 | 2 | 3 | 4, SubmissionRecord>>;
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

const MedicalRecordPreviewBase = forwardRef(function MedicalRecordPreviewBase(
  { record, yearlyRecords }: Props,
  ref: ForwardedRef<HTMLDivElement>
) {
    const exam = record.staffMeasurements || {};
    const lab = record.labResults || {};
    const history = record.medicalHistory || {};
    const yr = record.year || '1';
    const yrIndex = parseInt(yr, 10) - 1;
    const civilStatusNormalized = String(record.civilStatus || '').trim().toLowerCase();
    const photoUrl = record.photoUrl;
    const signatureUrl = record.signatureUrl;

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

    const getYearExamValue = (year: number, row: string) => {
      const field = EXAM_FIELD_MAP[row];
      if (!field) return '';
      const yearRecord = yearlyRecords?.[year as 1 | 2 | 3 | 4];
      if (yearRecord) return getExamFieldValue(yearRecord, field);
      return year - 1 === yrIndex ? getExamFieldValue(record, field) : '';
    };

    const getYearLab = (year: number) => {
      const yearRecord = yearlyRecords?.[year as 1 | 2 | 3 | 4];
      if (yearRecord?.labResults) return yearRecord.labResults;
      return year - 1 === yrIndex ? lab : {};
    };

    const inlineField = (value: unknown, minWidth = '44px') => {
      const text = String(value || '').trim();
      return (
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            minWidth,
            height: '14px',
            lineHeight: '10px',
            padding: '0 1px 3px 1px',
            verticalAlign: 'baseline',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ position: 'relative', zIndex: 1 }}>{text || '\u00A0'}</span>
          <span
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -1,
              borderBottom: '1.2px solid #000',
              zIndex: 0,
            }}
          />
        </span>
      );
    };

    return (
      <div ref={ref} style={S.page}>

        {/* ── HEADER ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          {/* Logos */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
              border: '1.5px solid #000',
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
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: '8px 0 6px 0',
          }}
        >
          <div
            style={{
              border: '1.5px solid #000',
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
          <div style={{ minWidth: '78px' }} />
        </div>

        {/* ── NAME ROWS ── */}
        <div style={{ display: 'flex', alignItems: 'stretch', marginTop: '7px' }}>
          {/* Last Name */}
          <div style={{ width: '130px', flexShrink: 0 }}>
            <div
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
          <div style={{ flex: 2, marginLeft: '6px' }}>
            <div style={{ height: '20px', display: 'flex', alignItems: 'flex-end' }}>
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
          <div style={{ width: '42px', flexShrink: 0, marginLeft: '8px' }}>
            <div style={{ height: '20px', display: 'flex', alignItems: 'flex-end' }}>
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
          <div style={{ flex: 1.2, marginLeft: '8px' }}>
            <div
              style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '20px' }}
            >
              <span style={S.fieldLabel}>Course/Dept.</span>
              <div style={{ ...S.line, flex: 1 }}>
                {abbreviateCourseDept(record.course || '')}
              </div>
            </div>
            <div
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
              <span style={S.checkbox(record.sex === 'female')} />
              <span style={S.fieldLabel}>M</span>
              <span style={S.checkbox(record.sex === 'male')} />
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '7px' }} />

        {/* ── BIRTHDAY ROW ── */}
        <div
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
          <span style={S.checkbox(civilStatusNormalized === 'single' || !civilStatusNormalized)} />
          <span style={S.fieldLabel}>Married</span>
          <span style={S.checkbox(civilStatusNormalized === 'married')} />
          <span style={{ ...S.fieldLabel, marginLeft: '14px' }}>Tel. /CPR:</span>
          <div style={{ ...S.line, minWidth: '140px' }}>
            {formatLocalPhone(record.contactNumber || '')}
          </div>
        </div>

        {/* ── PRESENT ADDRESS ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '6px',
            marginBottom: '8px',
            flexWrap: 'nowrap',
          }}
        >
          <span style={S.fieldLabel}>Present Address:</span>
          <div style={{ ...S.line, flex: 1 }}>{record.address || ''}</div>
        </div>

        {/* ── MEDICAL HISTORY ── */}
        <div
          style={{ fontWeight: 'bold', margin: '8px 0 5px 0', fontSize: '10.5px' }}
        >
          • MEDICAL HISTORY: place a CHECK (✔) if you have or had.
        </div>
        <div
          style={{
            border: '1.5px solid #000',
            padding: '8px 10px',
            marginBottom: '10px',
          }}
        >
          {MEDICAL_HISTORY_ROWS.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                marginBottom: i === MEDICAL_HISTORY_ROWS.length - 1 ? '0' : '6px',
              }}
            >
              {row.map((item, j) => (
                <div
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
                      <span
                        style={S.checkbox(
                          !!history[item.key as keyof typeof history]
                        )}
                      />
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
          <span style={S.checkbox(record.hadOperation === 'yes')} />
          <span style={S.fieldLabel}>&nbsp;NO</span>
          <span style={S.checkbox(record.hadOperation === 'no')} />
        </div>
        <div
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
              borderBottom: '1.2px solid #000',
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
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '22%' }}>Physical Examination</th>
              {['Yr. I / Date:', 'Yr. II / Date:', 'Yr. III / Date:', 'Yr. IV / Date:'].map(
                (h, i) => (
                  <th key={i} style={{ ...S.th, width: '19.5%' }}>
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {EXAM_ROWS.map((row) => (
              <tr key={row}>
                <td style={{ ...S.td, fontWeight: 'bold', height: '20px' }}>{row}</td>
                {[0, 1, 2, 3].map((i) => (
                  <td key={i} style={{ ...S.td, height: '20px' }}>
                    {getYearExamValue(i + 1, row)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td style={{ ...S.td, fontWeight: 'bold', height: '20px' }}>Examined by:</td>
              {[0, 1, 2, 3].map((i) => (
                <td key={i} style={{ ...S.td, height: '20px' }}>
                  {yearlyRecords
                    ? yearlyRecords[(i + 1) as 1 | 2 | 3 | 4]?.staffMeasurements
                        ?.examinedBy || ''
                    : i === yrIndex
                    ? exam.examinedBy || ''
                    : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* ── LABS TABLE ── */}
        <table style={{ ...S.table, fontSize: '9.5px' }}>
          <tbody>
            {/* Chest X-ray */}
            <tr>
              <td
                style={{
                  ...S.td,
                  width: '7%',
                  verticalAlign: 'middle',
                  fontWeight: 'bold',
                }}
              >
                Chest :<br />x-ray
              </td>
              {[1, 2, 3, 4].map((year) => {
                const y = getYearLab(year);
                return (
                  <td
                    key={year}
                    style={{
                      ...S.td,
                      verticalAlign: 'top',
                      lineHeight: '1.8',
                      padding: '5px 5px',
                    }}
                  >
                    <div>Date: {inlineField(y.xrayDate, '52px')}</div>
                    <div>Normal ( {y.xrayResult === 'normal' ? 'X' : ' '} )</div>
                    <div>Abnormal findings {inlineField(y.xrayFindings, '56px')}</div>
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
              {[1, 2, 3, 4].map((year) => {
                const y = getYearLab(year);
                return (
                  <td
                    key={year}
                    style={{
                      ...S.td,
                      verticalAlign: 'top',
                      lineHeight: '1.8',
                      padding: '5px 5px',
                    }}
                  >
                    <div>Date: {inlineField(y.cbcDate, '52px')}</div>
                    <div>
                      Hgb. {inlineField(y.hemoglobin, '36px')} Hct.{' '}
                      {inlineField(y.hematocrit, '36px')}
                    </div>
                    <div>WBC {inlineField(y.wbc, '42px')} &lt;</div>
                    <div>Plt. Ct. {inlineField(y.plateletCount, '42px')}</div>
                    <div>Bld. Type {inlineField(y.bloodType, '42px')}</div>
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
              {[1, 2, 3, 4].map((year) => {
                const y = getYearLab(year);
                return (
                  <td
                    key={year}
                    style={{
                      ...S.td,
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
              {[1, 2, 3, 4].map((year) => (
                <td key={year} style={S.td}>
                  {getYearLab(year).others || ''}
                </td>
              ))}
            </tr>

            {/* Date Received */}
            <tr>
              <td style={{ ...S.td, verticalAlign: 'top', fontWeight: 'bold' }}>
                Date<br />Received:
              </td>
              <td style={S.td}>
                {yearlyRecords?.[1]?.updatedAt
                  ? new Date(yearlyRecords[1]!.updatedAt!).toLocaleDateString()
                  : ''}
              </td>
              <td style={S.td}>
                {yearlyRecords?.[2]?.updatedAt
                  ? new Date(yearlyRecords[2]!.updatedAt!).toLocaleDateString()
                  : ''}
              </td>
              <td style={S.td}>
                {yearlyRecords?.[3]?.updatedAt
                  ? new Date(yearlyRecords[3]!.updatedAt!).toLocaleDateString()
                  : ''}
              </td>
              <td style={S.td}>
                {yearlyRecords?.[4]?.updatedAt
                  ? new Date(yearlyRecords[4]!.updatedAt!).toLocaleDateString()
                  : ''}
              </td>
            </tr>
          </tbody>
        </table>

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
    );
  }
);

MedicalRecordPreviewBase.displayName = 'MedicalRecordPreviewBase';
const MedicalRecordPreview = memo(MedicalRecordPreviewBase);
MedicalRecordPreview.displayName = 'MedicalRecordPreview';
export default MedicalRecordPreview;
