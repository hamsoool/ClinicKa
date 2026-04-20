import { forwardRef } from 'react';
import type { MockSubmission } from '../lib/mock-data';

/* ───────── medical history: exact column layout from physical form ───────── */
// Col1 | Col2 | Col3 | Col4
const MEDICAL_HISTORY_COLS: { key: string; label: string }[][] = [
  [
    { key: 'allergy', label: 'Allergy' },
    { key: 'asthma', label: 'Asthma' },
    { key: 'chickenPox', label: 'Chicken Pox' },
    { key: 'diabetes', label: 'Diabetes' },
    { key: 'dysmenorrhea', label: 'Dysmenorrhea' },
  ],
  [
    { key: 'epilepsySeizure', label: 'Epilepsy/Seizure' },
    { key: 'heartDisorder', label: 'Heart disorder' },
    { key: 'hepatitis', label: 'Hepatitis' },
    { key: 'hypertension', label: 'Hypertension' },
    { key: 'measles', label: 'Measles' },
  ],
  [
    { key: 'mumps', label: 'Mumps' },
    { key: 'anxietyDisorder', label: 'Anxiety disorder' },
    { key: 'panicAttack', label: 'Panic attack/Hyperventilation' },
    { key: 'pneumonia', label: 'Pneumonia' },
    { key: 'ptbPrimaryComplex', label: 'PTB/Primary Complex' },
  ],
  [
    { key: 'typhoidFever', label: 'Typhoid Fever' },
    { key: 'covid19', label: 'COVID-19' },
    { key: 'uti', label: 'Urinary Tract Infection' },
  ],
];

const EXAM_ROWS = [
  'BP', 'CR', 'RR', 'Temp.', 'Weight', 'Height', 'BMI',
  'Visual Acuity', 'Skin', 'HEENT', 'Chest/Lungs', 'Heart',
  'Abdomen', 'Extremities', 'Others, specify',
];

const EXAM_FIELD_MAP: Record<string, string> = {
  'BP': 'bloodPressure',
  'CR': 'cardiacRate',
  'RR': 'respiratoryRate',
  'Temp.': 'temperature',
  'Weight': 'weight',
  'Height': 'height',
  'BMI': 'bmi',
  'Visual Acuity': 'visualAcuity',
  'Skin': 'skin',
  'HEENT': 'heent',
  'Chest/Lungs': 'chestLungs',
  'Heart': 'heart',
  'Abdomen': 'abdomen',
  'Extremities': 'extremities',
  'Others, specify': 'others',
};

/* ───────── inline styles ───────── */
const S = {
  page: {
    fontFamily: "'Arial', 'Helvetica', sans-serif",
    fontSize: '10px',
    lineHeight: '1.35',
    color: '#000',
    background: '#fff',
    width: '100%',
    maxWidth: '816px',
    margin: '0 auto',
    padding: '18px 24px',
    boxSizing: 'border-box' as const,
  },
  checkbox: (checked: boolean) => ({
    display: 'inline-block' as const,
    width: '9px',
    height: '9px',
    border: '1px solid #000',
    marginRight: '2px',
    verticalAlign: 'middle' as const,
    background: checked ? '#000' : '#fff',
    fontSize: '6px',
    textAlign: 'center' as const,
    lineHeight: '9px',
    color: '#fff',
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '9px',
  },
  th: {
    border: '1px solid #000',
    padding: '2px 3px',
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    background: '#f0f0f0',
    fontSize: '9px',
  },
  td: {
    border: '1px solid #000',
    padding: '2px 3px',
    fontSize: '9px',
    minHeight: '14px',
  },
  tdLabel: {
    border: '1px solid #000',
    padding: '2px 4px',
    fontWeight: 'bold' as const,
    fontSize: '9px',
    width: '100px',
    whiteSpace: 'nowrap' as const,
  },
  fieldLabel: {
    fontWeight: 'bold' as const,
    fontSize: '9px',
    whiteSpace: 'nowrap' as const,
  },
  fieldValue: {
    borderBottom: '1px solid #000',
    display: 'inline-block' as const,
    minWidth: '60px',
    paddingBottom: '1px',
    fontSize: '9px',
    textAlign: 'center' as const,
  },
};

/* ───────── SVG Seals ───────── */
function GCSeal({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
      <circle cx="18" cy="18" r="17" fill="none" stroke="#333" strokeWidth="1.2" />
      <circle cx="18" cy="18" r="14" fill="none" stroke="#333" strokeWidth="0.5" />
      <text x="18" y="15" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#333">GORDON</text>
      <text x="18" y="20" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#333">COLLEGE</text>
      <text x="18" y="26" textAnchor="middle" fontSize="3.5" fill="#333">OLONGAPO CITY</text>
    </svg>
  );
}

function CaduceusSeal({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
      <circle cx="18" cy="18" r="17" fill="none" stroke="#333" strokeWidth="1.2" />
      <circle cx="18" cy="18" r="14" fill="none" stroke="#333" strokeWidth="0.5" />
      <line x1="18" y1="8" x2="18" y2="28" stroke="#333" strokeWidth="1" />
      <path d="M18,10 Q13,13 18,16 Q13,19 18,22" fill="none" stroke="#333" strokeWidth="0.8" />
      <path d="M18,10 Q23,13 18,16 Q23,19 18,22" fill="none" stroke="#333" strokeWidth="0.8" />
      <path d="M18,9 Q12,7 10,9" fill="none" stroke="#333" strokeWidth="0.8" />
      <path d="M18,9 Q24,7 26,9" fill="none" stroke="#333" strokeWidth="0.8" />
      <text x="18" y="31" textAnchor="middle" fontSize="3" fill="#333">HEALTH SERVICES</text>
    </svg>
  );
}

/* ───────── component ───────── */
interface Props {
  record: MockSubmission;
}

const MedicalRecordPreview = forwardRef<HTMLDivElement, Props>(({ record }, ref) => {
  const exam = record.staffMeasurements || {};
  const lab = record.labResults || {};
  const history = record.medicalHistory || {};
  const yr = record.year || '1';
  const yrIndex = parseInt(yr, 10) - 1; // 0-based

  const getExamValue = (row: string) => {
    const field = EXAM_FIELD_MAP[row];
    return field ? (exam as any)[field] || '' : '';
  };

  return (
    <div ref={ref} style={S.page}>

      {/* ====== HEADER: 3 seals top-left | school info center | 1x1 photo box top-right ====== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        {/* Left: 3 seals */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
          <GCSeal size={34} />
          <GCSeal size={34} />
          <CaduceusSeal size={34} />
        </div>

        {/* Center: school info */}
        <div style={{ textAlign: 'center', flex: 1, padding: '0 10px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '1px' }}>GORDON COLLEGE</div>
          <div style={{ fontSize: '8px', color: '#222' }}>Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City</div>
          <div style={{ fontSize: '8px', color: '#222' }}>Tpl. Nos.: (047) 224-2089/ (047) 603-7175</div>
          <div style={{ fontSize: '8px', color: '#222' }}>Website: www.gordoncollege.edu.ph</div>
          <div style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '2px' }}>Health Services Unit</div>
        </div>

        {/* Right: 1x1 photo box */}
        <div style={{
          width: '60px',
          height: '60px',
          border: '1px solid #000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '8px',
          color: '#555',
          flexShrink: 0,
          textAlign: 'center',
        }}>
          1×1<br />photo
        </div>
      </div>

      {/* ====== STUDENT # ====== */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', border: '1px solid #000', padding: '2px 6px', width: 'fit-content' }}>
        <span style={S.fieldLabel}>Student #:</span>
        <span style={{ ...S.fieldValue, minWidth: '140px' }}>{record.studentId}</span>
      </div>

      {/* ====== NAME ROW ====== */}
      <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '1px' }}>Name:</div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '3px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1.2 }}>
          <div style={{ borderBottom: '1px solid #000', paddingBottom: '1px', fontSize: '9px', minHeight: '12px' }}>{record.lastName}</div>
          <div style={{ fontSize: '7.5px', color: '#555', textAlign: 'center' }}>Last Name</div>
        </div>
        <div style={{ flex: 1.2 }}>
          <div style={{ borderBottom: '1px solid #000', paddingBottom: '1px', fontSize: '9px', minHeight: '12px' }}>{record.firstName}</div>
          <div style={{ fontSize: '7.5px', color: '#555', textAlign: 'center' }}>First name</div>
        </div>
        <div style={{ width: '36px' }}>
          <div style={{ borderBottom: '1px solid #000', paddingBottom: '1px', fontSize: '9px', minHeight: '12px', textAlign: 'center' }}>{record.middleInitial || ''}</div>
          <div style={{ fontSize: '7.5px', color: '#555', textAlign: 'center' }}>M. I.</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ borderBottom: '1px solid #000', paddingBottom: '1px', fontSize: '9px', minHeight: '12px' }}>{record.course}</div>
          <div style={{ fontSize: '7.5px', color: '#555', textAlign: 'center' }}>Course/Dept.</div>
        </div>
      </div>

      {/* ====== BIRTHDAY / CIVIL STATUS / AGE / SEX / TEL ====== */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '3px', alignItems: 'center', fontSize: '9px' }}>
        <span style={S.fieldLabel}>Birthday:</span>
        <span style={{ ...S.fieldValue, minWidth: '80px' }}>{record.birthday || ''}</span>
        <span style={S.fieldLabel}>Civil Status:</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <span style={S.checkbox(record.civilStatus === 'single' || !record.civilStatus)}>{(record.civilStatus === 'single' || !record.civilStatus) ? '✓' : ''}</span>
          Single
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <span style={S.checkbox(record.civilStatus === 'married')}>{record.civilStatus === 'married' ? '✓' : ''}</span>
          Married
        </span>
        <span style={{ marginLeft: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <span style={S.fieldLabel}>M.I.</span>
          <span style={{ ...S.fieldValue, minWidth: '20px' }}>{record.middleInitial || ''}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <span style={S.fieldLabel}>Age:</span>
          <span style={{ ...S.fieldValue, minWidth: '24px' }}>{record.age}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <span style={S.fieldLabel}>Sex:</span>
          <span style={S.checkbox(record.sex === 'female')}>{record.sex === 'female' ? '✓' : ''}</span> F
          <span style={{ marginLeft: '4px' }}></span>
          <span style={S.checkbox(record.sex === 'male')}>{record.sex === 'male' ? '✓' : ''}</span> M
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <span style={S.fieldLabel}>Tel. /CP#:</span>
          <span style={{ ...S.fieldValue, minWidth: '80px' }}>{record.contactNumber || ''}</span>
        </span>
      </div>

      {/* ====== PRESENT ADDRESS ====== */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', alignItems: 'center', fontSize: '9px' }}>
        <span style={S.fieldLabel}>Present Address:</span>
        <span style={{ ...S.fieldValue, flex: 1, minWidth: '200px', textAlign: 'left' }}>{record.address || ''}</span>
      </div>

      {/* ====== MEDICAL HISTORY ====== */}
      <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '3px' }}>
        • MEDICAL HISTORY: place a CHECK (✓) if you have or had:
      </div>
      {/* 4 columns matching the real form */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 6px', marginBottom: '5px' }}>
        {MEDICAL_HISTORY_COLS.map((col, colIdx) => (
          <div key={colIdx}>
            {col.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', fontSize: '8.5px', gap: '2px', marginBottom: '1px' }}>
                <span style={S.checkbox(!!history[key as keyof typeof history])}>
                  {history[key as keyof typeof history] ? '✓' : ''}
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ====== OPERATIONS ====== */}
      <div style={{ fontSize: '9px', marginBottom: '2px' }}>
        <span style={{ fontWeight: 'bold' }}>• Have you had any operation in the past?</span>
        {' '}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <span style={S.checkbox(record.hadOperation === 'yes')}>{record.hadOperation === 'yes' ? '✓' : ''}</span> YES
        </span>
        {' '}
        <span style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <span style={S.checkbox(record.hadOperation === 'no')}>{record.hadOperation === 'no' ? '✓' : ''}</span> NO
        </span>
      </div>
      <div style={{ fontSize: '9px', marginBottom: '4px' }}>
        • If yes, state the nature of the operation and date/year:
        <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '200px', marginLeft: '4px' }}>
          {record.hadOperation === 'yes' ? record.operationDetails || '' : ''}
        </span>
      </div>

      {/* ====== EMERGENCY CONTACT ====== */}
      <div style={{ display: 'flex', gap: '6px', fontSize: '9px', marginBottom: '2px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold' }}>• Emergency Contact Person Name:</span>
        <span style={{ ...S.fieldValue, minWidth: '120px' }}>{record.emergencyContact?.name || ''}</span>
        <span style={{ fontWeight: 'bold' }}>Relationship:</span>
        <span style={{ ...S.fieldValue, minWidth: '80px' }}>{record.emergencyContact?.relationship || ''}</span>
      </div>
      <div style={{ display: 'flex', gap: '6px', fontSize: '9px', marginBottom: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold' }}>Address:</span>
        <span style={{ ...S.fieldValue, minWidth: '160px' }}>{record.emergencyContact?.address || ''}</span>
        <span style={{ fontWeight: 'bold' }}>Tel. phone No. CP:</span>
        <span style={{ ...S.fieldValue, minWidth: '100px' }}>{record.emergencyContact?.phone || ''}</span>
      </div>

      {/* ====== DATA PRIVACY ====== */}
      <div style={{ fontSize: '8px', color: '#333', marginBottom: '2px', borderTop: '1px solid #aaa', paddingTop: '3px' }}>
        *Data Privacy Waiver: I am willing to disclose my personal information with the GC clinic. I have the right to access my personal data in a timely manner (5days request). The clinic respect patient's privacy and accountable to protect my personal information.
      </div>
      <div style={{ textAlign: 'right', fontSize: '9px', marginBottom: '6px' }}>
        <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '160px', textAlign: 'center' }}>
          &nbsp;
        </span>
        <div style={{ fontSize: '8px', color: '#555' }}>Signature of Student</div>
      </div>

      {/* ====== PHYSICAL EXAMINATION TABLE ====== */}
      <table style={{ ...S.table, marginBottom: '0' }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: '100px', textAlign: 'left' }}>Physical Examination</th>
            {['Yr. I / Date:', 'Yr. II / Date:', 'Yr. III / Date:', 'Yr. IV / Date:'].map((h, i) => (
              <th key={i} style={{
                ...S.th,
                fontWeight: i === yrIndex ? 'bold' : 'normal',
                background: i === yrIndex ? '#ddeeff' : '#f0f0f0',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {EXAM_ROWS.map((row) => (
            <tr key={row}>
              <td style={S.tdLabel}>{row}</td>
              {[0, 1, 2, 3].map((i) => (
                <td key={i} style={{ ...S.td, background: i === yrIndex ? '#f5faff' : 'transparent' }}>
                  {i === yrIndex ? getExamValue(row) : ''}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td style={S.tdLabel}>Examined by:</td>
            {[0, 1, 2, 3].map((i) => (
              <td key={i} style={{ ...S.td, background: i === yrIndex ? '#f5faff' : 'transparent' }}>
                {i === yrIndex ? (exam.examinedBy || '') : ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* ====== LAB RESULTS — 4-column structure matching physical form ====== */}
      <table style={{ ...S.table, marginTop: '0' }}>
        <tbody>
          {/* ── Chest X-Ray row ── */}
          <tr>
            <td style={{ ...S.tdLabel, fontWeight: 'bold', verticalAlign: 'top', width: '100px' }}>
              Chest :<br />x-ray
            </td>
            {/* Yr I */}
            <td style={{ ...S.td, verticalAlign: 'top', fontSize: '8px' }}>
              <div>Date: <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '50px' }}>{yrIndex === 0 ? lab.xrayDate || '' : ''}</span></div>
              <div>Normal ( {yrIndex === 0 && lab.xrayResult === 'normal' ? '✓' : ' '} )</div>
              <div>Abnormal findings <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '40px' }}>{yrIndex === 0 ? lab.xrayFindings || '' : ''}</span></div>
            </td>
            {/* Yr II */}
            <td style={{ ...S.td, verticalAlign: 'top', fontSize: '8px' }}>
              <div>Date: <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '50px' }}>{yrIndex === 1 ? lab.xrayDate || '' : ''}</span></div>
              <div>Normal ( {yrIndex === 1 && lab.xrayResult === 'normal' ? '✓' : ' '} )</div>
              <div>Abnormal findings <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '40px' }}>{yrIndex === 1 ? lab.xrayFindings || '' : ''}</span></div>
            </td>
            {/* Yr III */}
            <td style={{ ...S.td, verticalAlign: 'top', fontSize: '8px' }}>
              <div>Date: <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '50px' }}>{yrIndex === 2 ? lab.xrayDate || '' : ''}</span></div>
              <div>Normal ( {yrIndex === 2 && lab.xrayResult === 'normal' ? '✓' : ' '} )</div>
              <div>Abnormal findings <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '40px' }}>{yrIndex === 2 ? lab.xrayFindings || '' : ''}</span></div>
            </td>
            {/* Yr IV */}
            <td style={{ ...S.td, verticalAlign: 'top', fontSize: '8px' }}>
              <div>Date: <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '50px' }}>{yrIndex === 3 ? lab.xrayDate || '' : ''}</span></div>
              <div>Normal ( {yrIndex === 3 && lab.xrayResult === 'normal' ? '✓' : ' '} )</div>
              <div>Abnormal findings <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '40px' }}>{yrIndex === 3 ? lab.xrayFindings || '' : ''}</span></div>
            </td>
          </tr>

          {/* ── CBC row ── */}
          <tr>
            <td style={{ ...S.tdLabel, fontWeight: 'bold', verticalAlign: 'top' }}>CBC:</td>
            {[0, 1, 2, 3].map((i) => {
              const isActive = i === yrIndex;
              return (
                <td key={i} style={{ ...S.td, verticalAlign: 'top', fontSize: '8px' }}>
                  <div>Date: <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '44px' }}>{isActive ? lab.cbcDate || '' : ''}</span></div>
                  <div>
                    Hgb. <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '28px' }}>{isActive ? lab.hemoglobin || '' : ''}</span>
                    &nbsp;Hct. <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '28px' }}>{isActive ? lab.hematocrit || '' : ''}</span>
                  </div>
                  <div>
                    WBC <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '30px' }}>{isActive ? lab.wbc || '' : ''}</span> &lt;
                  </div>
                  <div>
                    Plt. Ct. <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '28px' }}>{isActive ? lab.plateletCount || '' : ''}</span>
                  </div>
                  <div>
                    Bld. Type <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '24px' }}>{isActive ? lab.bloodType || '' : ''}</span>
                  </div>
                </td>
              );
            })}
          </tr>

          {/* ── U/A row ── */}
          <tr>
            <td style={{ ...S.tdLabel, fontWeight: 'bold', verticalAlign: 'top' }}>U/A:</td>
            {[0, 1, 2, 3].map((i) => {
              const isActive = i === yrIndex;
              return (
                <td key={i} style={{ ...S.td, verticalAlign: 'top', fontSize: '8px' }}>
                  <div>Date: <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '44px' }}>{isActive ? lab.urinalysisDate || '' : ''}</span></div>
                  <div>
                    •Glucose/Sugar <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '30px' }}>{isActive ? lab.urinalysisGlucose || '' : ''}</span>
                  </div>
                  <div>
                    •Protein <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '40px' }}>{isActive ? lab.urinalysisProtein || '' : ''}</span>
                  </div>
                </td>
              );
            })}
          </tr>

          {/* ── OTHERS row — full width ── */}
          <tr>
            <td style={{ ...S.tdLabel, fontWeight: 'bold', verticalAlign: 'top' }}>OTHERS:</td>
            <td colSpan={4} style={{ ...S.td, minHeight: '48px', verticalAlign: 'top' }}>
              {lab.others || ''}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ====== FOOTER ====== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: '8px' }}>
        <div style={{ fontWeight: 'bold' }}>
          Date<br />Received:
          <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '100px', marginLeft: '6px', fontWeight: 'normal' }}>
            {record.updatedAt ? new Date(record.updatedAt).toLocaleDateString() : ''}
          </span>
        </div>
        <div style={{ fontSize: '8px', color: '#666', alignSelf: 'flex-end' }}>
          Revision:#4 &nbsp; 05/2024 gbb
        </div>
      </div>

    </div>
  );
});

MedicalRecordPreview.displayName = 'MedicalRecordPreview';
export default MedicalRecordPreview;