import { forwardRef, memo } from 'react';
import type { SubmissionRecord } from '../lib/record-types';

const S = {
  page: {
    fontFamily: "'Arial', 'Helvetica', sans-serif",
    fontSize: '11px',
    lineHeight: '1.4',
    color: '#000',
    background: '#fff',
    width: '794px',
    height: '1123px',
    margin: '0 auto',
    padding: '10px 18px 10px 18px',
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  copy: {
    border: '1px solid #555',
    padding: '12px 16px 14px 16px',
    position: 'relative' as const,
    pageBreakInside: 'avoid' as const,
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    boxSizing: 'border-box' as const,
  },
  schoolName: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    letterSpacing: '2px',
    marginBottom: '1px',
  },
  schoolAddr: {
    fontSize: '8px',
    color: '#222',
    marginBottom: '1px',
    lineHeight: '1.5',
  },
  bodyText: {
    fontSize: '10.5px',
    lineHeight: '1.9',
    marginBottom: '0px',
  },
  underlineField: (minW = '100px') => ({
    borderBottom: '1px solid #000',
    display: 'inline-block' as const,
    minWidth: minW,
    textAlign: 'center' as const,
    paddingBottom: '1px',
    fontSize: '10.5px',
  }),
  checkbox: (checked: boolean) => ({
    display: 'inline-block' as const,
    width: '10px',
    height: '10px',
    border: '1px solid #000',
    marginRight: '2px',
    verticalAlign: 'middle' as const,
    background: checked ? '#000' : '#fff',
    fontSize: '7px',
    textAlign: 'center' as const,
    lineHeight: '10px',
    color: '#fff',
    flexShrink: 0,
  }),
  sigBlock: {
    textAlign: 'right' as const,
    fontSize: '10.5px',
  },
  sigName: {
    fontWeight: 'bold' as const,
    fontSize: '11px',
  },
};

const COPY_TYPES = ["STUDENT'S COPY", "COORDINATOR'S COPY", "REGISTRAR'S COPY"] as const;

function GordonCollegeLogo({ size = 44 }: { size?: number }) {
  return (
    <img
      src="/gordon-college-logo.png"
      alt="Gordon College logo"
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

function AcademicAffairsLogo({ size = 44 }: { size?: number }) {
  return (
    <img
      src="/gordon_college_academicaffairs.png"
      alt="Gordon College Academic Affairs logo"
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

function HSULogo({ size = 44 }: { size?: number }) {
  return (
    <img
      src="/gordonhsc.png"
      alt="Health Services Unit logo"
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

function ClearanceCopy({ record, copyType }: { record: SubmissionRecord; copyType: string }) {
  const cl = record.clearanceInfo || {};
  const purpose = cl.purpose || 'enrolment';

  const signatoryName = (record.staffMeasurements?.examinedBy || '').trim() || 'GERALD S. BERNAL, MD';
  const signatoryTitle = 'College Physician';

  const isStudentCopy = copyType === "STUDENT'S COPY";
  const remarksEnding = isStudentCopy
    ? 'at the College Clinic.'
    : 'at the College Clinic for Enrolment purposes only.';

  return (
    <div style={S.copy}>

      {/* HEADER — original logo positions: Gordon+Academic LEFT, HSU RIGHT */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>

        {/* LEFT: Gordon + Academic logos */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, paddingTop: '2px' }}>
          <GordonCollegeLogo size={44} />
          <AcademicAffairsLogo size={44} />
        </div>

        {/* CENTER: school info */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={S.schoolName}>GORDON COLLEGE</div>
          <div style={S.schoolAddr}>
            Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City
          </div>
          <div style={S.schoolAddr}>Tel. No.: (047) 222-4080</div>
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold' }}>
              Office of Student Welfare and Services
            </div>
            <div style={{ fontSize: '9px', fontWeight: 'bold' }}>
              Health Services Unit
            </div>
          </div>
        </div>

        {/* RIGHT: HSU logo + copy-type badge */}
        <div
          style={{
            flexShrink: 0,
            paddingTop: '2px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            minWidth: '60px',
          }}
        >
          <HSULogo size={44} />
          <div
            style={{
              border: '1.5px solid #000',
              padding: '2px 5px',
              fontSize: '7px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              background: '#fff',
              lineHeight: 1,
              textAlign: 'center',
            }}
          >
            {copyType}
          </div>
        </div>
      </div>

      {/* TITLE */}
      <div style={{ textAlign: 'center', margin: '10px 0 8px' }}>
        {'MEDICALCERTIFICATE'.split('').map((ch, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontSize: '13px',
              fontWeight: 'bold',
              borderBottom: '1.5px solid #000',
              paddingBottom: '1px',
              marginRight: '2.5px',
              minWidth: '9px',
              textAlign: 'center',
            }}
          >
            {ch}
          </span>
        ))}
      </div>

      {/* CONTENT — grows to fill available space, sections spread out */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

        {/* TOP CONTENT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Certification line */}
          <div style={S.bodyText}>
            This is to certify that Mr/ Ms{' '}
            <span style={S.underlineField('150px')}>
              {record.firstName} {record.middleInitial ? record.middleInitial + '. ' : ''}
              {record.lastName}
            </span>{' '}
            Age <span style={S.underlineField('30px')}>{record.age || ''}</span> Sex{' '}
            <span style={S.underlineField('20px')}>
              {record.sex === 'female' ? 'F' : 'M'}
            </span>{' '}
            has submitted all required medical requirements and upon physical examination.
          </div>

          {/* Findings */}
          <div style={{ fontSize: '10.5px', lineHeight: '2', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginRight: '4px' }}>
              Findings:
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                <span style={S.checkbox(cl.findingsNormal === true)}>
                  {cl.findingsNormal ? '?' : ''}
                </span>
                <span>Essentially normal physical findings at the time of evaluation</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={S.checkbox(!!cl.diagnosis)}>{cl.diagnosis ? '?' : ''}</span>
                <span>Diagnosis:</span>
                <span style={{ ...S.underlineField('490px'), width: '490px' }}>
                  {cl.diagnosis || ''}
                </span>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div style={{ fontSize: '10.5px', lineHeight: '2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>
              <span style={{ fontWeight: 'bold' }}>Remarks: </span>
              <span style={S.underlineField('550px')}>{cl.remarks || ''}</span>
            </div>
            <div>
              This was issued on{' '}
              <span style={S.underlineField('100px')}>
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
          </div>

          {/* Purpose */}
          <div style={{ fontSize: '10.5px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 'bold' }}>Purpose:</span>
            <span><span style={S.checkbox(purpose === 'enrolment')}></span> Enrolment</span>
            <span><span style={S.checkbox(purpose === 'ojt')}></span> OJT / Internship</span>
            <span><span style={S.checkbox(purpose === 'rle')}></span> R.L.E</span>
          </div>
        </div>

        {/* BOTTOM ROW: Control/Student No. LEFT, Signatory RIGHT */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '8px',
            paddingTop: '8px',
          }}
        >
          <div style={{ fontSize: '10.5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div>
              <span style={{ fontWeight: 'bold' }}>Control No.: </span>
              <span style={S.underlineField('120px')}>{cl.controlNo || ''}</span>
            </div>
            <div>
              <span style={{ fontWeight: 'bold' }}>Student No.: </span>
              <span style={S.underlineField('120px')}>{record.studentId}</span>
            </div>
          </div>

          <div style={{ ...S.sigBlock, flexShrink: 0, minWidth: '190px' }}>
            <div style={S.sigName}>{signatoryName}</div>
            <div>{signatoryTitle}</div>
            <div>License No. 008455</div>
          </div>
        </div>

      </div>
    </div>
  );
}

interface Props {
  record: SubmissionRecord;
}

const MedicalClearancePreviewBase = forwardRef<HTMLDivElement, Props>(({ record }, ref) => {
  return (
    <div ref={ref} style={S.page}>
      {COPY_TYPES.map((copyType) => (
        <ClearanceCopy key={copyType} record={record} copyType={copyType} />
      ))}
    </div>
  );
});

MedicalClearancePreviewBase.displayName = 'MedicalClearancePreviewBase';
const MedicalClearancePreview = memo(MedicalClearancePreviewBase);
MedicalClearancePreview.displayName = 'MedicalClearancePreview';
export default MedicalClearancePreview;