import { forwardRef, memo } from 'react';
import { formatAcademicYearLabel, getRecordAcademicYear } from '../lib/academic-year';
import type { SubmissionRecord } from '../lib/record-types';

const S = {
  page: {
    fontFamily: "'Arial', 'Helvetica', sans-serif",
    fontSize: '11px',
    lineHeight: '1.4',
    color: '#000',
    background: '#fff',
    width: '794px',
    margin: '0 auto',
    padding: '10px 18px 18px 18px',
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
    position: 'relative' as const,
    top: '5px',
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
const CLEARANCE_SIGNATORY_NAMES = ['GERALD S. BERNAL, MD', 'ARMANDO TAMAYO, MD'] as const;

function normalizeSignatoryName(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b(m\.?\s*d\.?|doctor|dr\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchClearanceSignatoryName(value?: string | null) {
  const normalized = normalizeSignatoryName(value);
  return CLEARANCE_SIGNATORY_NAMES.find((name) => normalizeSignatoryName(name) === normalized) || '';
}

function formatCertificateIssuedDate(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const isoCandidate = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

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

function UnderlinedField({
  value,
  minWidth = '100px',
  width,
  align = 'center',
}: {
  value?: string | number | null;
  minWidth?: string;
  width?: string;
  align?: 'center' | 'left';
}) {
  const text = String(value || '').trim();

  return (
    <span
      className="relative inline-flex align-baseline print:align-baseline"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'flex-end',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        minWidth,
        width,
        textAlign: align,
        padding: '0 2px 6px 2px',
        fontSize: '10.5px',
        lineHeight: '1',
        boxSizing: 'border-box',
        verticalAlign: 'baseline',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'inline-block',
          transform: 'translateY(-2px)',
        }}
      >
        {text || '\u00A0'}
      </span>
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          borderBottom: '1px solid #000',
          zIndex: 0,
        }}
      />
    </span>
  );
}

function UnderlinedTitleLetter({ letter }: { letter: string }) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        minWidth: '9px',
        height: '19px',
        fontSize: '13px',
        fontWeight: 'bold',
        padding: '0 0 5px 0',
        marginRight: '2.5px',
        textAlign: 'center',
        lineHeight: 1,
        boxSizing: 'border-box',
      }}
    >
      <span style={{ position: 'relative', zIndex: 1, transform: 'translateY(-1px)' }}>{letter}</span>
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          borderBottom: '1.5px solid #000',
          zIndex: 0,
        }}
      />
    </span>
  );
}

function CopyTypeBadge({ label }: { label: string }) {
  const width = label.length > 16 ? 132 : 118;
  const height = 22;
  const centerX = width / 2;
  const centerY = height / 2 + 0.5;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="pdf-print-exact block overflow-visible"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <rect
        x="0.75"
        y="0.75"
        width={width - 1.5}
        height={height - 1.5}
        fill="#fff"
        stroke="#000"
        strokeWidth="1.5"
      />
      <text
        x={centerX}
        y={centerY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="6.5"
        fontWeight="700"
        fill="#000"
      >
        {label}
      </text>
    </svg>
  );
}

function ClearanceCopy({
  record,
  copyType,
  academicYearLabel,
}: {
  record: SubmissionRecord;
  copyType: string;
  academicYearLabel?: string;
}) {
  const cl = record.clearanceInfo || {};
  const purposes = String(cl.purpose || 'enrolment')
    .split(',')
    .map((item) => item.trim().toLowerCase() === 'enrollment' ? 'enrolment' : item.trim().toLowerCase())
    .filter(Boolean);

  const findingsNormal = cl.findingsNormal === true;
  const diagnosis = String(cl.diagnosis || '').trim();
  const remarks = String(cl.remarks || '').trim();
  const issuedDateLabel = formatCertificateIssuedDate(cl.issuedDate);
  const savedSignatoryName = String(cl.signatoryName || '').trim();
  const signatoryName =
    matchClearanceSignatoryName(cl.signatoryName) ||
    savedSignatoryName ||
    matchClearanceSignatoryName(record.staffMeasurements?.examinedBy) ||
    CLEARANCE_SIGNATORY_NAMES[0];
  const signatoryTitle = 'College Physician';
  const licenseNo = (cl.licenseNo || '008455').trim();

  const isStudentCopy = copyType === "STUDENT'S COPY";
  const remarksEnding = isStudentCopy
    ? 'at the College Clinic.'
    : 'at the College Clinic for Enrolment purposes only.';
  const resolvedAcademicYearLabel = academicYearLabel || formatAcademicYearLabel(getRecordAcademicYear(record));

  const renderCheckbox = (checked: boolean) => (
    <span
      className="pdf-print-exact relative inline-block h-[10px] w-[10px] shrink-0 align-middle print:shrink-0"
      style={S.checkbox(checked)}
    />
  );

  return (
    <div className="pdf-print-exact flex flex-col print:flex print:flex-col" style={S.copy}>

      {/* HEADER — original logo positions: Gordon+Academic LEFT, HSU RIGHT */}
      <div
        className="flex items-start gap-2 print:flex print:flex-row print:items-start"
        style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}
      >

        {/* LEFT: Gordon + Academic logos */}
        <div className="flex shrink-0 gap-1 print:flex print:flex-row" style={{ display: 'flex', gap: '4px', flexShrink: 0, paddingTop: '2px' }}>
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
          className="flex min-w-[60px] shrink-0 flex-col items-center gap-[3px] print:flex print:flex-col"
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
          <CopyTypeBadge label={copyType} />
        </div>
      </div>

      {/* TITLE */}
      <div style={{ textAlign: 'center', margin: '10px 0 8px' }}>
        {'MEDICALCERTIFICATE'.split('').map((ch, i) => (
          <UnderlinedTitleLetter key={i} letter={ch} />
        ))}
        <div style={{ marginTop: '8px', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.08em' }}>
          {resolvedAcademicYearLabel}
        </div>
      </div>

      {/* CONTENT — grows to fill available space, sections spread out */}
      <div
        className="flex flex-1 flex-col justify-between print:flex print:flex-col"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      >

        {/* TOP CONTENT */}
        <div
          className="flex flex-col gap-[10px] print:flex print:flex-col"
          style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
        >

          {/* Certification line */}
          <div className="leading-[1.9] print:leading-[1.9]" style={S.bodyText}>
            This is to certify that Mr/ Ms{' '}
            <UnderlinedField
              minWidth="150px"
              value={`${record.firstName} ${record.middleInitial ? `${record.middleInitial}. ` : ''}${record.lastName}`}
            />{' '}
            Age <UnderlinedField minWidth="30px" value={record.age || ''} /> Sex{' '}
            <UnderlinedField minWidth="20px" value={record.sex === 'female' ? 'F' : 'M'} />{' '}
            has submitted all required medical requirements and upon physical examination.
          </div>

          {/* Findings */}
          <div
            className="flex items-start gap-[6px] print:flex print:flex-row print:items-start"
            style={{ fontSize: '10.5px', lineHeight: '2', display: 'flex', gap: '6px', alignItems: 'flex-start' }}
          >
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginRight: '4px' }}>
              Findings:
            </span>
            <div style={{ flex: 1 }}>
              <div
                className="flex items-center gap-[5px] print:flex print:flex-row print:items-center"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}
              >
                {renderCheckbox(findingsNormal)}
                <span>Essentially normal physical findings at the time of evaluation</span>
              </div>
              <div
                className="flex items-center gap-[5px] print:flex print:flex-row print:items-center"
                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                {renderCheckbox(!!diagnosis)}
                <span>Diagnosis:</span>
                <UnderlinedField minWidth="490px" width="490px" value={diagnosis} align="left" />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div
            className="flex flex-col gap-1 print:flex print:flex-col"
            style={{ fontSize: '10.5px', lineHeight: '2', display: 'flex', flexDirection: 'column', gap: '4px' }}
          >
            <div>
              <span style={{ fontWeight: 'bold' }}>Remarks: </span>
              <UnderlinedField minWidth="550px" width="550px" value={remarks} align="left" />
            </div>
            <div>
              This was issued on{' '}
              <UnderlinedField
                minWidth="100px"
                value={issuedDateLabel}
              />{' '}
              {remarksEnding}
            </div>
          </div>

          {/* Purpose */}
          <div
            className="flex items-center gap-3 print:flex print:flex-row print:items-center"
            style={{ fontSize: '10.5px', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <span style={{ fontWeight: 'bold' }}>Purpose:</span>
            <span className="inline-flex items-center gap-[3px] print:inline-flex">
              {renderCheckbox(purposes.includes('enrolment'))}
              <span>Enrolment</span>
            </span>
            <span className="inline-flex items-center gap-[3px] print:inline-flex">
              {renderCheckbox(purposes.includes('ojt'))}
              <span>OJT / Internship</span>
            </span>
            <span className="inline-flex items-center gap-[3px] print:inline-flex">
              {renderCheckbox(purposes.includes('rle'))}
              <span>R.L.E</span>
            </span>
          </div>
        </div>

        {/* BOTTOM ROW: Student No. LEFT, Signatory RIGHT */}
        <div
          className="flex items-end justify-between gap-2 print:flex print:flex-row print:items-end"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '8px',
            paddingTop: '8px',
          }}
        >
          <div
            className="flex min-w-[240px] flex-1 flex-col justify-start gap-[5px] print:flex print:flex-col print:min-w-[240px]"
            style={{
              fontSize: '10.5px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: '5px',
              minHeight: '42px',
            }}
          >
            <div>
              <span style={{ fontWeight: 'bold' }}>Student No.: </span>
              <UnderlinedField minWidth="150px" width="150px" value={record.studentId} />
            </div>
          </div>

          <div className="min-w-[190px] shrink-0 print:min-w-[190px]" style={{ ...S.sigBlock, flexShrink: 0, minWidth: '190px' }}>
            <div style={S.sigName}>{signatoryName}</div>
            <div>{signatoryTitle}</div>
            <div>License No. {licenseNo}</div>
          </div>
        </div>

      </div>
    </div>
  );
}

interface Props {
  record: SubmissionRecord;
  academicYearLabel?: string;
}

const MedicalClearancePreviewBase = forwardRef<HTMLDivElement, Props>(({ record, academicYearLabel }, ref) => {
  return (
    <div
      ref={ref}
      data-pdf-page="a4"
      className="pdf-print-exact flex flex-col bg-white print:flex print:flex-col"
      style={S.page}
    >
      {COPY_TYPES.map((copyType) => (
        <ClearanceCopy key={copyType} record={record} copyType={copyType} academicYearLabel={academicYearLabel} />
      ))}
    </div>
  );
});

MedicalClearancePreviewBase.displayName = 'MedicalClearancePreviewBase';
const MedicalClearancePreview = memo(MedicalClearancePreviewBase);
MedicalClearancePreview.displayName = 'MedicalClearancePreview';
export default MedicalClearancePreview;
