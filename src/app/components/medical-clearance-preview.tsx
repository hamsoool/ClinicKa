import { forwardRef } from 'react';
import type { SubmissionRecord } from '../lib/record-types';

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

/* ───────── Logos ───────── */
function GordonCollegeLogo({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/gordon-college-logo.png"
      alt="Gordon College logo"
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

function AcademicAffairsLogo({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/gordon_college_academicaffairs.png"
      alt="Gordon College Academic Affairs logo"
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

function HSULogo({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/gordonhsc.png"
      alt="Health Services Unit logo"
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

/* ───────── single copy ───────── */
function ClearanceCopy({ record, copyType }: { record: SubmissionRecord; copyType: string }) {
  const cl = record.clearanceInfo || {};
  const purpose = cl.purpose || 'enrolment';

  // Permanently fixed — not connected to any input field
  const signatoryName = 'GERALD S. BERNAL, MD';
  const signatoryTitle = 'College Physician';

  const isStudentCopy = copyType === "STUDENT'S COPY";
  const remarksEnding = isStudentCopy
    ? 'at the College Clinic.'
    : 'at the College Clinic for Enrolment purposes only.';

  return (
    <div style={S.copy}>
      {/* HEADER */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0, paddingTop: '2px' }}>
          <GordonCollegeLogo size={34} />
          <AcademicAffairsLogo size={34} />
        </div>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={S.schoolName}>GORDON COLLEGE</div>
          <div style={S.schoolAddr}>
            Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City
          </div>
          <div style={S.schoolAddr}>Tel. No.: (047) 222-4080</div>

          <div style={{ marginTop: '3px' }}>
            <div style={{ fontSize: '8.5px', fontWeight: 'bold' }}>
              Office of Student Welfare and Services
            </div>
            <div style={{ fontSize: '8.5px', fontWeight: 'bold' }}>
              Health Services Unit
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, paddingTop: '2px' }}>
          <HSULogo size={34} />
        </div>

        <div
          style={{
            position: 'absolute',
            top: '26px',
            right: '42px',
            border: '1.5px solid #000',
            padding: '2px 6px',
            fontSize: '7.5px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            background: '#fff',
          }}
        >
          {copyType}
        </div>
      </div>

      {/* TITLE */}
      <div style={{ textAlign: 'center', margin: '5px 0 4px' }}>
        {'MEDICALCERTIFICATE'.split('').map((ch, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontSize: '11.5px',
              fontWeight: 'bold',
              borderBottom: '1.5px solid #000',
              paddingBottom: '1px',
              marginRight: '2px',
              minWidth: '8px',
              textAlign: 'center',
            }}
          >
            {ch}
          </span>
        ))}
      </div>

      {/* BODY */}
      <div style={S.bodyText}>
        This is to certify that Mr/ Ms{' '}
        <span style={S.underlineField('140px')}>
          {record.firstName} {record.middleInitial ? record.middleInitial + '. ' : ''}
          {record.lastName}
        </span>{' '}
        Age <span style={S.underlineField('28px')}>{record.age || ''}</span> Sex{' '}
        <span style={S.underlineField('18px')}>
          {record.sex === 'female' ? 'F' : 'M'}
        </span>{' '}
        has submitted all required medical requirements and upon physical examination.
      </div>

      {/* FINDINGS */}
      <div style={{ ...S.bodyText, display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
        <span
          style={{
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            marginRight: '4px',
          }}
        >
          Findings:
        </span>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <span style={S.checkbox(cl.findingsNormal === true)}>
              {cl.findingsNormal ? '?' : ''}
            </span>
            <span>Essentially normal physical findings at the time of evaluation</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={S.checkbox(!!cl.diagnosis)}>{cl.diagnosis ? '?' : ''}</span>
            <span>Diagnosis:</span>
            <span style={{ ...S.underlineField('550px'), width: '550px' }}>
              {cl.diagnosis || ''}
            </span>
          </div>
        </div>
      </div>

      {/* REMARKS + SIGNATURE */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '8px',
          marginTop: '2px',
        }}
      >
        <div style={{ flex: 1, fontSize: '9px' }}>
          <div style={{ marginBottom: '2px' }}>
            <span style={{ fontWeight: 'bold' }}>Remarks: </span>
            <span style={S.underlineField('400px')}>{cl.remarks || ''}</span>
          </div>

          <div style={{ marginBottom: '2px' }}>
            This was issued on{' '}
            <span style={S.underlineField('90px')}>
              {cl.issuedDate
                ? new Date(cl.issuedDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : ''}
            </span>{' '}
            {remarksEnding}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '6px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 'bold' }}>Purpose:</span>
            <span><span style={S.checkbox(purpose === 'enrolment')}></span> Enrolment</span>
            <span><span style={S.checkbox(purpose === 'ojt')}></span> OJT / Internship</span>
            <span><span style={S.checkbox(purpose === 'rle')}></span> R.L.E</span>
          </div>

          <div style={{ marginTop: '35px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div>
              <span style={{ fontWeight: 'bold' }}>Control No.: </span>
              <span style={S.underlineField('100px')}>{cl.controlNo || ''}</span>
            </div>
            <div>
              <span style={{ fontWeight: 'bold' }}>Student No.: </span>
              <span style={S.underlineField('100px')}>{record.studentId}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            ...S.sigBlock,
            flexShrink: 0,
            alignSelf: 'flex-end',
            marginBottom: '6px',
            minWidth: '180px',
          }}
        >
          <div style={S.sigName}>{signatoryName}</div>
          <div>{signatoryTitle}</div>
          <div>License No. 008455</div>
        </div>
      </div>
    </div>
  );
}

/* MAIN */
interface Props {
  record: SubmissionRecord;
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
