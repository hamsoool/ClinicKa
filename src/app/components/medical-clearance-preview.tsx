import { forwardRef } from 'react';
import type { MockSubmission } from '../lib/mock-data';

/* ───────── inline styles ───────── */
const S = {
  page: {
    fontFamily: "'Arial', 'Helvetica', sans-serif",
    fontSize: '10px',
    lineHeight: '1.3',
    color: '#000',
    background: '#fff',
    width: '100%',
    maxWidth: '794px',
    margin: '0 auto',
    padding: '12px 24px',
    boxSizing: 'border-box' as const,
  },
  copy: {
    border: '1px solid #555',
    padding: '10px 14px',
    marginBottom: '8px',
    position: 'relative' as const,
    pageBreakInside: 'avoid' as const,
  },
  schoolName: {
    fontSize: '15px',
    fontWeight: 'bold' as const,
    letterSpacing: '2px',
    marginBottom: '1px',
  },
  schoolAddr: {
    fontSize: '7.5px',
    color: '#222',
    marginBottom: '1px',
  },
  bodyText: {
    fontSize: '9px',
    lineHeight: '1.7',
    marginBottom: '3px',
  },
  underlineField: (minW = '100px') => ({
    borderBottom: '1px solid #000',
    display: 'inline-block' as const,
    minWidth: minW,
    textAlign: 'center' as const,
    paddingBottom: '1px',
    fontSize: '9px',
  }),
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
    flexShrink: 0,
  }),
  sigBlock: {
    textAlign: 'right' as const,
    fontSize: '9px',
  },
  sigName: {
    fontWeight: 'bold' as const,
    fontSize: '10px',
  },
};

const COPY_TYPES = ["STUDENT'S COPY", "COORDINATOR'S COPY", "REGISTRAR'S COPY"] as const;

/* ───────── SVG Seals ───────── */
function GCSeal({ size = 36 }: { size?: number }) {
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

function CaduceusSeal({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
      <circle cx="18" cy="18" r="17" fill="none" stroke="#333" strokeWidth="1.2" />
      <circle cx="18" cy="18" r="14" fill="none" stroke="#333" strokeWidth="0.5" />
      {/* Staff */}
      <line x1="18" y1="8" x2="18" y2="28" stroke="#333" strokeWidth="1" />
      {/* Snake left */}
      <path d="M18,10 Q13,13 18,16 Q13,19 18,22" fill="none" stroke="#333" strokeWidth="0.8" />
      {/* Snake right */}
      <path d="M18,10 Q23,13 18,16 Q23,19 18,22" fill="none" stroke="#333" strokeWidth="0.8" />
      {/* Wings */}
      <path d="M18,9 Q12,7 10,9" fill="none" stroke="#333" strokeWidth="0.8" />
      <path d="M18,9 Q24,7 26,9" fill="none" stroke="#333" strokeWidth="0.8" />
      <text x="18" y="31" textAnchor="middle" fontSize="3" fill="#333">HEALTH SERVICES</text>
    </svg>
  );
}

/* ───────── single copy ───────── */
function ClearanceCopy({ record, copyType }: { record: MockSubmission; copyType: string }) {
  const cl = record.clearanceInfo || {};
  const purpose = cl.purpose || 'enrolment';
  // Student's copy ends with "at the College Clinic." only; others add "for Enrolment purposes only."
  const isStudentCopy = copyType === "STUDENT'S COPY";
  const remarksEnding = isStudentCopy
    ? 'at the College Clinic.'
    : 'at the College Clinic for Enrolment purposes only.';

  return (
    <div style={S.copy}>

      {/* ── HEADER ── */}
      <div style={{ position: 'relative' as const, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0, paddingTop: '2px' }}>
          <GCSeal size={34} />
          <GCSeal size={34} />
        </div>
        <div style={{ flex: 1, textAlign: 'center' as const }}>
          <div style={S.schoolName}>GORDON COLLEGE</div>
          <div style={S.schoolAddr}>Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City</div>
          <div style={S.schoolAddr}>Tel. No.: (047) 222-4080</div>
          <div style={{ marginTop: '3px' }}>
            <div style={{ fontSize: '8.5px', fontWeight: 'bold' as const }}>Office of Student Welfare and Services</div>
            <div style={{ fontSize: '8.5px', fontWeight: 'bold' as const }}>Health Services Unit</div>
          </div>
        </div>
        <div style={{ flexShrink: 0, paddingTop: '2px' }}>
          <CaduceusSeal size={34} />
        </div>
        {/* Copy badge — absolute so it never shifts the center text */}
        <div style={{
          position: 'absolute' as const,
          top: '26px',
          right: '42px',
          border: '1.5px solid #000',
          padding: '2px 6px',
          fontSize: '7.5px',
          fontWeight: 'bold' as const,
          whiteSpace: 'nowrap' as const,
          background: '#fff',
        }}>
          {copyType}
        </div>
      </div>

      {/* ── TITLE: centered, each letter underlined ── */}
      <div style={{ textAlign: 'center' as const, margin: '5px 0 4px' }}>
        {'MEDICALCERTIFICATE'.split('').map((ch, i) => (
          <span key={i} style={{
            display: 'inline-block',
            fontSize: '11.5px',
            fontWeight: 'bold' as const,
            borderBottom: '1.5px solid #000',
            paddingBottom: '1px',
            marginRight: '2px',
            minWidth: '8px',
            textAlign: 'center' as const,
          }}>{ch}</span>
        ))}
      </div>

      {/* ── NAME / AGE / SEX ── */}
      <div style={S.bodyText}>
        This is to certify that Mr/ Ms{' '}
        <span style={S.underlineField('140px')}>
          {record.firstName} {record.middleInitial ? record.middleInitial + '. ' : ''}{record.lastName}
        </span>
        {' '}Age{' '}
        <span style={S.underlineField('28px')}>{record.age || ''}</span>
        {' '}Sex{' '}
        <span style={S.underlineField('18px')}>{record.sex === 'female' ? 'F' : 'M'}</span>
        {' '}has submitted all required medical requirements and upon physical examination.
      </div>

      {/* ── FINDINGS ── */}
      <div style={{ ...S.bodyText, display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
        <span style={{ fontWeight: 'bold' as const, whiteSpace: 'nowrap' as const, marginRight: '4px' }}>Findings:</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <span style={S.checkbox(cl.findingsNormal === true)}>{cl.findingsNormal ? '✓' : ''}</span>
            <span>Essentially normal physical findings at the time of evaluation</span>
            <span style={{ borderBottom: '1px solid #000', flex: 1, display: 'inline-block' as const }}></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={S.checkbox(!!cl.diagnosis)}>{cl.diagnosis ? '✓' : ''}</span>
            <span>Diagnosis:</span>
            <span style={{ ...S.underlineField('1px'), flex: 1 }}>{cl.diagnosis || ''}</span>
          </div>
        </div>
      </div>

      {/* ── REMARKS / ISSUED / PURPOSE + PHYSICIAN — two-column row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '2px' }}>

        {/* LEFT: Remarks, Issued, Purpose, then Control/Student No */}
        <div style={{ flex: 1, fontSize: '9px' }}>

          {/* Row 1: Remarks */}
          <div style={{ marginBottom: '2px' }}>
            <span style={{ fontWeight: 'bold' as const }}>Remarks: </span>
            <span style={S.underlineField('90px')}>{cl.remarks || ''}</span>
            {' '}{remarksEnding}
          </div>

          {/* Row 2: This was issued on ___ | Purpose checkboxes — SAME LINE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px', flexWrap: 'wrap' as const }}>
            <span>
              This was issued on{' '}
              <span style={S.underlineField('90px')}>
                {cl.issuedDate
                  ? new Date(cl.issuedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                  : ''}
              </span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 'bold' as const }}>Purpose:</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                <span style={S.checkbox(purpose === 'enrolment')}>{purpose === 'enrolment' ? '✓' : ''}</span>
                Enrolment
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                <span style={S.checkbox(purpose === 'ojt')}>{purpose === 'ojt' ? '✓' : ''}</span>
                OJT / Internship
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                <span style={S.checkbox(purpose === 'rle')}>{purpose === 'rle' ? '✓' : ''}</span>
                R.L.E
              </span>
            </span>
          </div>

          {/* Row 3: Control No / Student No */}
          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
            <div>
              <span style={{ fontWeight: 'bold' as const }}>Control No.: </span>
              <span style={S.underlineField('100px')}>{cl.controlNo || ''}</span>
            </div>
            <div>
              <span style={{ fontWeight: 'bold' as const }}>Student No.: </span>
              <span style={S.underlineField('100px')}>{record.studentId}</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Physician block — vertically aligned to Remarks/Issued rows */}
        <div style={{ ...S.sigBlock, flexShrink: 0 }}>
          <div style={S.sigName}>GERALD S. BERNAL, MD</div>
          <div>College Physician</div>
          <div>License No.0084558</div>
        </div>

      </div>

    </div>
  );
}

/* ───────── main component: 3 copies on one page ───────── */
interface Props {
  record: MockSubmission;
}

const MedicalClearancePreview = forwardRef<HTMLDivElement, Props>(({ record }, ref) => {
  return (
    <div ref={ref} style={S.page}>
      {COPY_TYPES.map((copyType) => (
        <ClearanceCopy key={copyType} record={record} copyType={copyType} />
      ))}
    </div>
  );
});

MedicalClearancePreview.displayName = 'MedicalClearancePreview';
export default MedicalClearancePreview;