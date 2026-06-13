import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { ReactElement, ReactNode } from 'react';
import { DATA_PRIVACY_PREVIEW_TEXT } from '../pages/student/medical-form/constants';
import { formatAcademicYearLabel, getRecordAcademicYear, getSubmissionSlotLabel, normalizeSubmissionSlot } from './academic-year';
import { formatOperationDetailsForDisplay } from './operation-details';
import type { LabResults, SubmissionRecord } from './record-types';

const CLEARANCE_SIGNATORY_NAMES = ['GERALD S. BERNAL, MD', 'ARMANDO TAMAYO, MD'] as const;
const RECORD_COLUMNS_PER_PAGE = 4;
const PX_TO_PT = 0.75;
const CERTIFICATE_SCALE = 841.89 / 1132;

const CERTIFICATE_COPY_TYPES = ["STUDENT'S COPY", "COORDINATOR'S COPY", "REGISTRAR'S COPY"] as const;
const CERTIFICATE_PAGE_PADDING_TOP = 10 * CERTIFICATE_SCALE;
const CERTIFICATE_PAGE_PADDING_X = 18 * CERTIFICATE_SCALE;
const CERTIFICATE_PAGE_PADDING_BOTTOM = 18 * CERTIFICATE_SCALE;
const CERTIFICATE_COPY_HEIGHT = 364 * CERTIFICATE_SCALE;
const CERTIFICATE_LOGO_SIZE = 44 * CERTIFICATE_SCALE;
const CERTIFICATE_COPY_BADGE_HEIGHT = 22 * CERTIFICATE_SCALE;
const CERTIFICATE_COPY_GAP = 6 * CERTIFICATE_SCALE;
const CERTIFICATE_BODY_FONT_SIZE = 11.5 * CERTIFICATE_SCALE;
const CERTIFICATE_SIGNATORY_NAME_FONT_SIZE = 12 * CERTIFICATE_SCALE;
const CERTIFICATE_SCHOOL_FONT_SIZE = 18 * CERTIFICATE_SCALE;
const CERTIFICATE_ADDRESS_FONT_SIZE = 10 * CERTIFICATE_SCALE;
const CERTIFICATE_UNIT_FONT_SIZE = 11 * CERTIFICATE_SCALE;
const CERTIFICATE_TITLE_FONT_SIZE = 15 * CERTIFICATE_SCALE;
const CERTIFICATE_YEAR_FONT_SIZE = 11 * CERTIFICATE_SCALE;
const CERTIFICATE_BADGE_FONT_SIZE = 8.5 * CERTIFICATE_SCALE;
const MEDICAL_FORM_TABLE_WIDTH = 764 * PX_TO_PT;
const MEDICAL_FORM_EXAM_LABEL_WIDTH = 168 * PX_TO_PT;
const MEDICAL_FORM_EXAM_YEAR_WIDTH = 149 * PX_TO_PT;
const MEDICAL_FORM_LAB_LABEL_WIDTH = 68 * PX_TO_PT;
const MEDICAL_FORM_LAB_YEAR_WIDTH = 174 * PX_TO_PT;

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

const EXAM_ROWS = [
  'BP',
  'CR',
  'RR',
  'Temp.',
  'Weight',
  'Height',
  'BMI',
  'Visual Acuity',
  'Skin',
  'HEENT',
  'Chest/Lungs',
  'Heart',
  'Abdomen',
  'Extremities',
  'Others, specify',
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

function assetUrl(path: string) {
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).href;
}

function text(value: unknown) {
  return String(value || '').trim();
}

function getPdfFileName(title: string, record?: SubmissionRecord) {
  const id = text(record?.studentId);
  const normalized = (id || title || 'document')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${normalized || 'document'}.pdf`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function writePdfPreviewShell(targetWindow: Window, title: string) {
  targetWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>
  <style>
    html, body { height: 100%; margin: 0; background: #111827; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    body { display: grid; place-items: center; }
    .status { border-radius: 10px; background: #fff; padding: 18px 20px; box-shadow: 0 20px 50px rgba(0,0,0,.25); font-size: 15px; }
  </style>
</head>
<body>
  <div class="status">Preparing PDF...</div>
</body>
</html>`);
  targetWindow.document.close();
}

function writePdfPreviewDocument(targetWindow: Window, title: string, fileName: string, pdfUrl: string) {
  const safeTitle = escapeHtml(title);
  const safeFileName = escapeHtml(fileName);
  const scriptTitle = JSON.stringify(title);
  const scriptFileName = JSON.stringify(fileName);
  const scriptPdfUrl = JSON.stringify(pdfUrl);

  targetWindow.document.open();
  targetWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${safeFileName}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; font-family: Arial, Helvetica, sans-serif; background: #1f2937; color: #111827; }
    body { display: flex; flex-direction: column; min-height: 100%; }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 56px;
      padding: max(8px, env(safe-area-inset-top)) 12px 8px;
      background: #fff;
      border-bottom: 1px solid #d1d5db;
      box-shadow: 0 1px 3px rgba(0,0,0,.12);
      z-index: 2;
    }
    .title { min-width: 0; flex: 1; font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .actions { display: flex; gap: 8px; }
    button, a.action {
      appearance: none;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #111827;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
      padding: 10px 12px;
      text-decoration: none;
      white-space: nowrap;
    }
    button.primary, a.primary { background: #166534; border-color: #166534; color: #fff; }
    .viewer { flex: 1; min-height: 0; display: flex; background: #374151; }
    iframe { width: 100%; height: 100%; border: 0; background: #52525b; }
    .mobile-help { display: none; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #d1d5db; font-size: 12px; line-height: 1.4; }
    @media (max-width: 720px) {
      .toolbar { align-items: stretch; flex-direction: column; }
      .title { width: 100%; white-space: normal; }
      .actions { width: 100%; display: grid; grid-template-columns: 1fr 1fr; }
      button, a.action { width: 100%; text-align: center; padding: 12px 10px; }
      .mobile-help { display: block; }
    }
    @media print {
      .toolbar, .mobile-help { display: none; }
      iframe { height: 100vh; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="title">${safeFileName}</div>
    <div class="actions">
      <a class="action primary" id="open-link" href="">Open PDF</a>
      <a class="action" id="download-link" href="" download="${safeFileName}">Download</a>
      <button type="button" id="share-button">Share / Print</button>
      <button type="button" id="print-button">Print</button>
    </div>
  </div>
  <div class="mobile-help">On iPhone/iPad, use Share / Print to open the iOS share sheet, then choose Print or Save to Files. On Android, Open PDF or Download will hand the file to the browser/PDF viewer.</div>
  <div class="viewer">
    <iframe id="pdf-frame" title="${safeTitle}" src=""></iframe>
  </div>
  <script>
    const pdfUrl = ${scriptPdfUrl};
    const fileName = ${scriptFileName};
    const documentTitle = ${scriptTitle};
    const frame = document.getElementById('pdf-frame');
    const openLink = document.getElementById('open-link');
    const downloadLink = document.getElementById('download-link');
    const shareButton = document.getElementById('share-button');
    const printButton = document.getElementById('print-button');

    frame.src = pdfUrl;
    openLink.href = pdfUrl;
    downloadLink.href = pdfUrl;

    async function sharePdf() {
      try {
        if (!navigator.share) {
          window.open(pdfUrl, '_blank', 'noopener');
          return;
        }
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: 'application/pdf' });
        const payload = { files: [file], title: documentTitle };
        if (navigator.canShare && !navigator.canShare(payload)) {
          window.open(pdfUrl, '_blank', 'noopener');
          return;
        }
        await navigator.share(payload);
      } catch (error) {
        window.open(pdfUrl, '_blank', 'noopener');
      }
    }

    function printPdf() {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (error) {
        window.open(pdfUrl, '_blank', 'noopener');
      }
    }

    shareButton.addEventListener('click', sharePdf);
    printButton.addEventListener('click', printPdf);
  </script>
</body>
</html>`);
  targetWindow.document.close();
}

function normalizeExaminerName(value?: string | null) {
  return text(value)
    .toLowerCase()
    .replace(/\b(m\.?\s*d\.?|doctor|dr\.?|rn|r\.?\s*n\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchClearanceSignatoryName(value?: string | null) {
  const normalized = normalizeExaminerName(value);
  return CLEARANCE_SIGNATORY_NAMES.find((name) => normalizeExaminerName(name) === normalized) || '';
}

function formatCertificateIssuedDate(value?: string | null) {
  const raw = text(value);
  if (!raw) return '';
  const parsed = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatLocalPhone(value?: string | null) {
  const digitsOnly = text(value).replace(/\D/g, '');
  if (!digitsOnly) return '';
  let normalized = digitsOnly;
  if (normalized.startsWith('63')) normalized = normalized.slice(2);
  if (normalized.startsWith('0')) normalized = normalized.slice(1);
  normalized = normalized.slice(0, 10);
  if (normalized.length === 10 && normalized.startsWith('9')) return `0${normalized}`;
  return text(value);
}

function abbreviateCourseDept(value: string) {
  const raw = text(value);
  const acronymInParens = raw.match(/\(([A-Za-z0-9&.\- ]+)\)\s*$/);
  if (acronymInParens?.[1]) return acronymInParens[1].trim();
  const upperCode = raw.match(/\b([A-Z]{2,}(?:[-/][A-Z]{2,})?)\b/);
  return upperCode?.[1]?.trim() || raw;
}

function formatXrayResult(value?: string | null) {
  const normalized = text(value).toLowerCase();
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
  return values.filter((value) => text(value).length > 0).length;
}

function buildBestRecordBySlot(records: SubmissionRecord[]) {
  const recordsBySlot = new Map<number, SubmissionRecord>();
  for (const item of records) {
    const slot = normalizeSubmissionSlot(item.year);
    if (!slot) continue;
    const current = recordsBySlot.get(slot);
    if (!current || getExamCompletenessScore(item) >= getExamCompletenessScore(current)) {
      recordsBySlot.set(slot, item);
    }
  }
  return recordsBySlot;
}

function buildSlotPages(recordsBySlot: Map<number, SubmissionRecord>, initialSlot: number) {
  const highestSlot = Math.max(initialSlot, ...recordsBySlot.keys());
  const totalPages = Math.max(1, Math.ceil(highestSlot / RECORD_COLUMNS_PER_PAGE));
  return Array.from({ length: totalPages }, (_, pageIndex) => {
    const pageStart = pageIndex * RECORD_COLUMNS_PER_PAGE + 1;
    return Array.from({ length: RECORD_COLUMNS_PER_PAGE }, (_, columnIndex) => pageStart + columnIndex);
  });
}

const S = StyleSheet.create({
  page: { backgroundColor: '#fff', color: '#000', fontFamily: 'Helvetica' },
  row: { flexDirection: 'row' },
  center: { alignItems: 'center', textAlign: 'center' },
  bold: { fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 7.5 },
  tiny: { fontSize: 6.75 },
  logo: { height: CERTIFICATE_LOGO_SIZE, width: CERTIFICATE_LOGO_SIZE, objectFit: 'contain' },
  field: { borderBottomWidth: 0.7, borderBottomColor: '#000', paddingHorizontal: 2, minHeight: 10 },
  checkbox: { borderWidth: 0.75, borderColor: '#000', height: 7.5, width: 7.5, marginRight: 2 },
  checked: { backgroundColor: '#000' },
  table: { borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: '#000' },
  cell: { borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: '#000', paddingHorizontal: 3, paddingVertical: 1.5, minHeight: 16.5 },
});

function Checkbox({ checked }: { checked?: boolean }) {
  return <View style={[S.checkbox, checked ? S.checked : {}]} />;
}

function Line({ value, style }: { value?: unknown; style?: any }) {
  return <Text style={[S.field, style]}>{text(value) || ' '}</Text>;
}

function FormLine({ value, style }: { value?: unknown; style?: any }) {
  return (
    <Text
      style={[
        {
          borderBottomWidth: 0.75,
          borderBottomColor: '#000',
          minHeight: 19 * PX_TO_PT,
          paddingHorizontal: 1.5,
          paddingBottom: 3,
          fontSize: 10.5 * PX_TO_PT,
          lineHeight: 1,
        },
        style,
      ]}
    >
      {text(value) || ' '}
    </Text>
  );
}

function FormInlineLine({ value, width = 44 * PX_TO_PT }: { value?: unknown; width?: number }) {
  return (
    <Text
      style={{
        borderBottomWidth: 0.75,
        borderBottomColor: '#000',
        minWidth: width,
        paddingHorizontal: 1.5,
        paddingBottom: 3,
        fontSize: 9.5 * PX_TO_PT,
        lineHeight: 1,
      }}
    >
      {text(value) || ' '}
    </Text>
  );
}

function FormLabel({ children, style }: { children: ReactNode; style?: any }) {
  return <Text style={[S.bold, { fontSize: 10.5 * PX_TO_PT }, style]}>{children}</Text>;
}

function FormLogoCircle({ src }: { src: string }) {
  return (
    <View
      style={{
        width: 64 * PX_TO_PT,
        height: 64 * PX_TO_PT,
        borderRadius: 32 * PX_TO_PT,
        borderWidth: 1.5,
        borderColor: '#555',
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Image src={assetUrl(src)} style={{ width: 64 * PX_TO_PT, height: 64 * PX_TO_PT, objectFit: 'contain' }} />
    </View>
  );
}

function CertificateField({
  value,
  width,
  minWidth,
  align = 'center',
  style,
}: {
  value?: unknown;
  width?: number;
  minWidth?: number;
  align?: 'center' | 'left';
  style?: any;
}) {
  return (
    <Text
      style={[
        {
          borderBottomWidth: 0.75,
          borderBottomColor: '#000',
          minWidth,
          width,
          paddingHorizontal: 2 * CERTIFICATE_SCALE,
          paddingBottom: 4.5 * CERTIFICATE_SCALE,
          fontSize: CERTIFICATE_BODY_FONT_SIZE,
          lineHeight: 1,
          textAlign: align,
        },
        style,
      ]}
    >
      {text(value) || ' '}
    </Text>
  );
}

function CertificateTitle() {
  return (
    <View style={[S.row, { justifyContent: 'center' }]}>
      {'MEDICALCERTIFICATE'.split('').map((letter, index) => (
        <Text
          key={`${letter}-${index}`}
          style={[
            S.bold,
            {
              width: 10.5 * CERTIFICATE_SCALE,
              height: 21 * CERTIFICATE_SCALE,
              marginRight: 2.5 * CERTIFICATE_SCALE,
              paddingBottom: 5 * CERTIFICATE_SCALE,
              borderBottomWidth: 1.1,
              borderBottomColor: '#000',
              fontSize: CERTIFICATE_TITLE_FONT_SIZE,
              lineHeight: 1,
              textAlign: 'center',
            },
          ]}
        >
          {letter}
        </Text>
      ))}
    </View>
  );
}

function LogoGroup() {
  return (
    <View style={[S.row, { gap: 3 }]}>
      <Image src={assetUrl('/gordon-college-logo.png')} style={S.logo} />
      <Image src={assetUrl('/gordon_college_academicaffairs.png')} style={S.logo} />
    </View>
  );
}

function CertificateCopy({
  record,
  copyType,
  academicYearLabel,
  isLast,
}: {
  record: SubmissionRecord;
  copyType: string;
  academicYearLabel: string;
  isLast?: boolean;
}) {
  const clearance = record.clearanceInfo || {};
  const purposes = text(clearance.purpose || 'enrolment')
    .split(',')
    .map((item) => (item.trim().toLowerCase() === 'enrollment' ? 'enrolment' : item.trim().toLowerCase()))
    .filter(Boolean);
  const signatoryName =
    matchClearanceSignatoryName(clearance.signatoryName) ||
    text(clearance.signatoryName) ||
    matchClearanceSignatoryName(record.staffMeasurements?.examinedBy) ||
    CLEARANCE_SIGNATORY_NAMES[0];
  const issuedDateLabel = formatCertificateIssuedDate(clearance.issuedDate);
  const isStudentCopy = copyType === "STUDENT'S COPY";
  const badgeWidth = (copyType.length > 16 ? 132 : 118) * CERTIFICATE_SCALE;
  const remarksEnding = isStudentCopy ? 'at the College Clinic.' : 'at the College Clinic for Enrolment purposes only.';
  const studentName = `${record.firstName} ${record.middleInitial ? `${record.middleInitial}. ` : ''}${record.lastName}`;

  return (
    <View
      style={{
        borderWidth: 0.75,
        borderColor: '#555',
        height: CERTIFICATE_COPY_HEIGHT,
        paddingTop: 12 * CERTIFICATE_SCALE,
        paddingHorizontal: 16 * CERTIFICATE_SCALE,
        paddingBottom: 14 * CERTIFICATE_SCALE,
        marginBottom: isLast ? 0 : CERTIFICATE_COPY_GAP,
      }}
    >
      <View style={[S.row, { alignItems: 'flex-start', gap: 8 * CERTIFICATE_SCALE }]}>
        <View style={[S.row, { gap: 4 * CERTIFICATE_SCALE, paddingTop: 2 * CERTIFICATE_SCALE }]}>
          <Image src={assetUrl('/gordon-college-logo.png')} style={S.logo} />
          <Image src={assetUrl('/gordon_college_academicaffairs.png')} style={S.logo} />
        </View>
        <View style={[S.center, { flex: 1 }]}>
          <Text style={[S.bold, { fontSize: CERTIFICATE_SCHOOL_FONT_SIZE, letterSpacing: 2 * CERTIFICATE_SCALE, marginBottom: 1 * CERTIFICATE_SCALE }]}>GORDON COLLEGE</Text>
          <Text style={{ fontSize: CERTIFICATE_ADDRESS_FONT_SIZE, lineHeight: 1.5, color: '#222' }}>Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City</Text>
          <Text style={{ fontSize: CERTIFICATE_ADDRESS_FONT_SIZE, lineHeight: 1.5, color: '#222' }}>Tel. No.: (047) 222-4080</Text>
          <Text style={[S.bold, { fontSize: CERTIFICATE_UNIT_FONT_SIZE, marginTop: 4 * CERTIFICATE_SCALE }]}>Office of Student Welfare and Services</Text>
          <Text style={[S.bold, { fontSize: CERTIFICATE_UNIT_FONT_SIZE }]}>Health Services Unit</Text>
        </View>
        <View style={[S.center, { width: Math.max(badgeWidth, 60 * CERTIFICATE_SCALE), paddingTop: 2 * CERTIFICATE_SCALE }]}>
          <Image src={assetUrl('/gordonhsc.png')} style={S.logo} />
          <View
            style={{
              borderWidth: 1.125,
              marginTop: 3 * CERTIFICATE_SCALE,
              width: badgeWidth,
              height: CERTIFICATE_COPY_BADGE_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={[S.bold, { fontSize: CERTIFICATE_BADGE_FONT_SIZE, textAlign: 'center' }]}>{copyType}</Text>
          </View>
        </View>
      </View>
      <View style={[S.center, { marginTop: 10 * CERTIFICATE_SCALE, marginBottom: 8 * CERTIFICATE_SCALE }]}>
        <CertificateTitle />
        <Text style={[S.bold, { fontSize: CERTIFICATE_YEAR_FONT_SIZE, marginTop: 8 * CERTIFICATE_SCALE, letterSpacing: 0.08 }]}>{academicYearLabel}</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ gap: 10 * CERTIFICATE_SCALE }}>
          <View>
            <Text style={{ fontSize: CERTIFICATE_BODY_FONT_SIZE, lineHeight: 1.9 }}>
              This is to certify that Mr/ Ms{' '}
              <Text style={{ textDecoration: 'underline' }}>{studentName || '                      '}</Text>
              {' '}Age{' '}
              <Text style={{ textDecoration: 'underline' }}>{record.age || '   '}</Text>
              {' '}Sex{' '}
              <Text style={{ textDecoration: 'underline' }}>{record.sex === 'female' ? 'F' : 'M'}</Text>
              {' '}has submitted all required medical requirements and upon physical
            </Text>
            <Text style={{ fontSize: CERTIFICATE_BODY_FONT_SIZE, lineHeight: 1.9 }}>examination.</Text>
          </View>
          <View style={[S.row, { gap: 6 * CERTIFICATE_SCALE, alignItems: 'flex-start' }]}>
            <Text style={[S.bold, { fontSize: CERTIFICATE_BODY_FONT_SIZE, lineHeight: 2 }]}>Findings:</Text>
            <View style={{ flex: 1 }}>
              <View style={[S.row, { alignItems: 'center', gap: 5 * CERTIFICATE_SCALE, marginBottom: 4 * CERTIFICATE_SCALE }]}>
                <Checkbox checked={clearance.findingsNormal === true} />
                <Text style={{ fontSize: CERTIFICATE_BODY_FONT_SIZE }}>Essentially normal physical findings at the time of evaluation</Text>
              </View>
              <View style={[S.row, { alignItems: 'center', gap: 5 * CERTIFICATE_SCALE }]}>
                <Checkbox checked={Boolean(text(clearance.diagnosis))} />
                <Text style={{ fontSize: CERTIFICATE_BODY_FONT_SIZE }}>Diagnosis:</Text>
                <CertificateField value={clearance.diagnosis} width={490 * CERTIFICATE_SCALE} align="left" />
              </View>
            </View>
          </View>
          <View style={{ gap: 4 * CERTIFICATE_SCALE }}>
            <View style={[S.row, { alignItems: 'flex-end' }]}>
              <Text style={[S.bold, { fontSize: CERTIFICATE_BODY_FONT_SIZE, lineHeight: 2 }]}>Remarks: </Text>
              <CertificateField value={clearance.remarks} width={550 * CERTIFICATE_SCALE} align="left" />
            </View>
            <View style={[S.row, { alignItems: 'flex-end' }]}>
              <Text style={{ fontSize: CERTIFICATE_BODY_FONT_SIZE }}>This was issued on </Text>
              <CertificateField value={issuedDateLabel} minWidth={100 * CERTIFICATE_SCALE} />
              <Text style={{ fontSize: CERTIFICATE_BODY_FONT_SIZE }}> {remarksEnding}</Text>
            </View>
          </View>
          <View style={[S.row, { gap: 12 * CERTIFICATE_SCALE, alignItems: 'center' }]}>
            <Text style={[S.bold, { fontSize: CERTIFICATE_BODY_FONT_SIZE }]}>Purpose:</Text>
            {[
              ['Enrolment', 'enrolment'],
              ['OJT / Internship', 'ojt'],
              ['R.L.E', 'rle'],
            ].map(([label, key]) => (
              <View key={key} style={[S.row, { alignItems: 'center', gap: 3 * CERTIFICATE_SCALE }]}>
                <Checkbox checked={purposes.includes(key)} />
                <Text style={{ fontSize: CERTIFICATE_BODY_FONT_SIZE }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={[S.row, { alignItems: 'flex-end', width: '100%', paddingTop: 8 * CERTIFICATE_SCALE }]}>
          <View style={[S.row, { alignItems: 'flex-end', minHeight: 42 * CERTIFICATE_SCALE }]}>
            <Text style={[S.bold, { fontSize: CERTIFICATE_BODY_FONT_SIZE }]}>Student No.: </Text>
            <CertificateField value={record.studentId} width={150 * CERTIFICATE_SCALE} />
          </View>
          <View style={{ marginLeft: 'auto', width: 190 * CERTIFICATE_SCALE, textAlign: 'right', alignItems: 'flex-end' }}>
            <Text style={[S.bold, { fontSize: CERTIFICATE_SIGNATORY_NAME_FONT_SIZE }]}>{signatoryName}</Text>
            <Text style={{ fontSize: CERTIFICATE_BODY_FONT_SIZE }}>College Physician</Text>
            <Text style={{ fontSize: CERTIFICATE_BODY_FONT_SIZE }}>License No. {text(clearance.licenseNo) || '008455'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function MedicalCertificatePdf({ record, academicYearLabel }: { record: SubmissionRecord; academicYearLabel?: string }) {
  const resolvedYear = academicYearLabel || formatAcademicYearLabel(getRecordAcademicYear(record));
  return (
    <Document title="Medical Certificate">
      <Page
        size="A4"
        style={[
          S.page,
          {
            paddingTop: CERTIFICATE_PAGE_PADDING_TOP,
            paddingHorizontal: CERTIFICATE_PAGE_PADDING_X,
            paddingBottom: CERTIFICATE_PAGE_PADDING_BOTTOM,
          },
        ]}
      >
        {CERTIFICATE_COPY_TYPES.map((copyType, index) => (
          <CertificateCopy
            key={copyType}
            record={record}
            copyType={copyType}
            academicYearLabel={resolvedYear}
            isLast={index === CERTIFICATE_COPY_TYPES.length - 1}
          />
        ))}
      </Page>
    </Document>
  );
}

function getExamFieldValue(sourceRecord: SubmissionRecord | undefined, field: string) {
  if (!sourceRecord) return '';
  const sourceExam = sourceRecord.staffMeasurements || {};
  const direct = (sourceExam as any)?.[field];
  if (text(direct)) return direct;
  if (field === 'bloodPressure') return sourceRecord.bloodPressure || '';
  if (field === 'weight') return sourceRecord.weight || '';
  if (field === 'height') return sourceRecord.height || '';
  if (field === 'bmi') return sourceRecord.bmi || '';
  return '';
}

function formatExamDate(sourceRecord?: SubmissionRecord) {
  if (!sourceRecord) return '';
  const rawDate = sourceRecord.staffMeasurements?.updatedAt || sourceRecord.updatedAt || sourceRecord.submittedAt;
  if (!rawDate) return '';
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString();
}

function FormTableCell({ children, style }: { children?: React.ReactNode; style?: any }) {
  return <View style={[S.cell, style]}>{typeof children === 'string' ? <Text style={S.small}>{children}</Text> : children}</View>;
}

function MedicalRecordPdfPage({
  record,
  recordsBySlot,
  slots,
  academicYearLabel,
}: {
  record: SubmissionRecord;
  recordsBySlot: Map<number, SubmissionRecord>;
  slots: number[];
  academicYearLabel: string;
}) {
  const history = record.medicalHistory || {};
  const civilStatus = text(record.civilStatus).toLowerCase();
  const getSlotRecord = (slot: number) => recordsBySlot.get(slot);
  const getSlotLab = (slot: number): LabResults => getSlotRecord(slot)?.labResults || {};

  return (
    <Page size="LEGAL" style={[S.page, { fontSize: 10.5 * PX_TO_PT, paddingTop: 18 * PX_TO_PT, paddingHorizontal: 22 * PX_TO_PT, paddingBottom: 16 * PX_TO_PT }]}>
      <View style={[S.row, { alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 * PX_TO_PT }]}>
        <View style={[S.row, { gap: 6 * PX_TO_PT, alignItems: 'center' }]}>
          <FormLogoCircle src="/gordon-college-logo.png" />
          <FormLogoCircle src="/gordon_college_academicaffairs.png" />
          <FormLogoCircle src="/gordonhsc.png" />
        </View>
        <View style={[S.center, { flex: 1, paddingHorizontal: 10 * PX_TO_PT }]}>
          <Text style={[S.bold, { fontSize: 18 * PX_TO_PT, letterSpacing: 0.75 }]}>GORDON COLLEGE</Text>
          <Text style={{ fontSize: 9 * PX_TO_PT, lineHeight: 1.7 }}>Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City</Text>
          <Text style={{ fontSize: 9 * PX_TO_PT, lineHeight: 1.7 }}>Tel. No.: (047) 222-2089 / (047) 603-7175</Text>
          <Text style={{ fontSize: 9 * PX_TO_PT, lineHeight: 1.7 }}>Website: www.gordoncollege.edu.ph</Text>
          <Text style={[S.bold, { marginTop: 9 * PX_TO_PT, fontSize: 13 * PX_TO_PT }]}>Health Services Unit</Text>
        </View>
        <View style={{ width: 78 * PX_TO_PT, alignItems: 'center' }}>
          <View style={{ borderWidth: 0.75, width: 78 * PX_TO_PT, height: 78 * PX_TO_PT, alignItems: 'center', justifyContent: 'center' }}>
            {record.photoUrl ? <Image src={record.photoUrl} style={{ width: 78 * PX_TO_PT, height: 78 * PX_TO_PT, objectFit: 'cover' }} /> : <Text style={[S.bold, { fontSize: 11 * PX_TO_PT, textAlign: 'center' }]}>1 x 1{'\n'}photo</Text>}
          </View>
        </View>
      </View>

      <View style={[S.row, { alignItems: 'center', justifyContent: 'space-between', marginTop: 8 * PX_TO_PT, marginBottom: 6 * PX_TO_PT }]}>
        <Text style={[S.bold, { borderWidth: 0.75, paddingVertical: 1.5, paddingHorizontal: 7.5, minWidth: 150 * PX_TO_PT, fontSize: 10.5 * PX_TO_PT }]}>Student #: {record.studentId}</Text>
        <Text style={[S.bold, { flex: 1, textAlign: 'center', fontSize: 13 * PX_TO_PT }]}>Health Services Unit</Text>
        <View style={{ minWidth: 120 * PX_TO_PT, textAlign: 'right' }}>
          <Text style={[S.bold, { fontSize: 9 * PX_TO_PT }]}>School Year</Text>
          <Text style={[S.bold, { fontSize: 9 * PX_TO_PT }]}>{academicYearLabel}</Text>
        </View>
      </View>

      <View style={{ marginTop: 7 * PX_TO_PT, marginBottom: 8 * PX_TO_PT }}>
        <View style={[S.row, { alignItems: 'stretch' }]}>
          <View style={{ width: 130 * PX_TO_PT, flexShrink: 0 }}>
            <View style={[S.row, { alignItems: 'flex-end', gap: 4 * PX_TO_PT, height: 20 * PX_TO_PT }]}>
              <FormLabel>Name:</FormLabel>
              <FormLine value={record.lastName} style={{ flex: 1 }} />
            </View>
            <FormLabel style={{ marginTop: 2 * PX_TO_PT }}>Last Name</FormLabel>
          </View>
          <View style={{ flex: 2, marginLeft: 6 * PX_TO_PT, minWidth: 220 * PX_TO_PT }}>
            <View style={{ height: 20 * PX_TO_PT, justifyContent: 'flex-end' }}>
              <FormLine value={record.firstName} style={{ textAlign: 'center' }} />
            </View>
            <FormLabel style={{ marginTop: 2 * PX_TO_PT, textAlign: 'center' }}>First Name</FormLabel>
          </View>
          <View style={{ width: 42 * PX_TO_PT, marginLeft: 8 * PX_TO_PT, flexShrink: 0 }}>
            <View style={{ height: 20 * PX_TO_PT, justifyContent: 'flex-end' }}>
              <FormLine value={record.middleInitial} style={{ textAlign: 'center' }} />
            </View>
            <FormLabel style={{ marginTop: 2 * PX_TO_PT, textAlign: 'center' }}>M. I.</FormLabel>
          </View>
          <View style={{ flex: 1.2, marginLeft: 8 * PX_TO_PT, minWidth: 250 * PX_TO_PT }}>
            <View style={[S.row, { alignItems: 'flex-end', gap: 4 * PX_TO_PT, height: 20 * PX_TO_PT }]}>
              <FormLabel>Course/Dept.</FormLabel>
              <FormLine value={abbreviateCourseDept(record.course)} style={{ flex: 1 }} />
            </View>
            <View style={[S.row, { alignItems: 'center', gap: 8 * PX_TO_PT, marginTop: 2 * PX_TO_PT }]}>
              <FormLabel>Age:</FormLabel>
              <FormLine value={record.age} style={{ width: 32 * PX_TO_PT, textAlign: 'center' }} />
              <FormLabel style={{ marginLeft: 4 * PX_TO_PT }}>Sex: F</FormLabel>
              <Checkbox checked={record.sex === 'female'} />
              <FormLabel>M</FormLabel>
              <Checkbox checked={record.sex === 'male'} />
            </View>
          </View>
        </View>
        <View style={{ height: 7 * PX_TO_PT }} />
        <View style={[S.row, { alignItems: 'flex-end', gap: 6 * PX_TO_PT }]}>
          <FormLabel>Birthday:</FormLabel>
          <FormLine value={record.birthday} style={{ width: 140 * PX_TO_PT }} />
          <FormLabel style={{ marginLeft: 10 * PX_TO_PT }}>Civil Status: Single</FormLabel>
          <Checkbox checked={civilStatus === 'single' || !civilStatus} />
          <FormLabel>Married</FormLabel>
          <Checkbox checked={civilStatus === 'married'} />
          <FormLabel style={{ marginLeft: 14 * PX_TO_PT }}>Tel. /CPR:</FormLabel>
          <FormLine value={formatLocalPhone(record.contactNumber)} style={{ width: 140 * PX_TO_PT }} />
        </View>
        <View style={[S.row, { alignItems: 'flex-end', gap: 6 * PX_TO_PT, marginTop: 8 * PX_TO_PT }]}>
          <FormLabel>Present Address:</FormLabel>
          <FormLine value={record.address} style={{ flex: 1 }} />
        </View>
      </View>

      <Text style={[S.bold, { marginTop: 8 * PX_TO_PT, marginBottom: 5 * PX_TO_PT, fontSize: 10.5 * PX_TO_PT }]}>• MEDICAL HISTORY: place a CHECK (✓) if you have or had.</Text>
      <View style={{ borderWidth: 0.75, paddingVertical: 7 * PX_TO_PT, paddingHorizontal: 9 * PX_TO_PT, marginBottom: 8 * PX_TO_PT, gap: 6 * PX_TO_PT }}>
        {MEDICAL_HISTORY_ROWS.map((row, index) => (
          <View key={index} style={S.row}>
            {row.map((item) => (
              <View key={item.key} style={[S.row, { flex: 1, alignItems: 'center' }]}>
                {item.key.startsWith('_blank_') ? null : (
                  <>
                    <Checkbox checked={Boolean((history as any)[item.key])} />
                    <Text style={{ fontSize: 10.5 * PX_TO_PT }}>{item.label}</Text>
                  </>
                )}
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={{ marginBottom: 8 * PX_TO_PT }}>
        <View style={[S.row, { alignItems: 'center', gap: 4 * PX_TO_PT, marginBottom: 8 * PX_TO_PT }]}>
          <FormLabel>• Have you had any operation in the past? YES</FormLabel>
          <Checkbox checked={record.hadOperation === 'yes'} />
          <FormLabel>NO</FormLabel>
          <Checkbox checked={record.hadOperation === 'no'} />
        </View>
        <View style={[S.row, { alignItems: 'flex-end', gap: 4 * PX_TO_PT, marginBottom: 8 * PX_TO_PT }]}>
          <FormLabel>• If yes, state the nature of the operation and date/year</FormLabel>
          <FormLine value={record.hadOperation === 'yes' ? formatOperationDetailsForDisplay(record.operationDetails) : ''} style={{ flex: 1 }} />
        </View>
        <View style={{ height: 8 * PX_TO_PT }} />
        <View style={[S.row, { alignItems: 'flex-end', gap: 4 * PX_TO_PT, marginBottom: 8 * PX_TO_PT }]}>
          <FormLabel>• Emergency Contact Person Name:</FormLabel>
          <FormLine value={record.emergencyContact?.name} style={{ width: 160 * PX_TO_PT }} />
          <FormLabel style={{ marginLeft: 95 * PX_TO_PT }}>Relationship:</FormLabel>
          <FormLine value={record.emergencyContact?.relationship} style={{ width: 140 * PX_TO_PT }} />
        </View>
        <View style={[S.row, { alignItems: 'flex-end', gap: 4 * PX_TO_PT }]}>
          <FormLabel>Address:</FormLabel>
          <FormLine value={record.emergencyContact?.address} style={{ width: 250 * PX_TO_PT }} />
          <FormLabel style={{ marginLeft: 140 * PX_TO_PT }}>Tel. phone No. CP:</FormLabel>
          <FormLine value={formatLocalPhone(record.emergencyContact?.phone)} style={{ width: 160 * PX_TO_PT }} />
        </View>
      </View>

      <View style={{ height: 8 * PX_TO_PT }} />
      <Text style={{ fontSize: 9.5 * PX_TO_PT, lineHeight: 1.7, marginTop: 9 * PX_TO_PT, marginBottom: 6 * PX_TO_PT }}>• {DATA_PRIVACY_PREVIEW_TEXT}</Text>
      <View style={{ alignItems: 'flex-end', marginBottom: 9 * PX_TO_PT }}>
        <Text style={[S.bold, { fontSize: 10.5 * PX_TO_PT, marginBottom: 4 * PX_TO_PT, marginRight: 20 * PX_TO_PT }]}>Signature of Student</Text>
        <View style={{ borderBottomWidth: 0.75, width: 180 * PX_TO_PT, minHeight: 26 * PX_TO_PT, alignItems: 'center' }}>
          {record.signatureUrl ? <Image src={record.signatureUrl} style={{ maxHeight: 24 * PX_TO_PT, maxWidth: 170 * PX_TO_PT, objectFit: 'contain' }} /> : null}
        </View>
      </View>

      <View style={[S.table, { width: MEDICAL_FORM_TABLE_WIDTH, marginBottom: 6 * PX_TO_PT }]}>
        <View style={S.row}>
          <FormTableCell style={{ width: MEDICAL_FORM_EXAM_LABEL_WIDTH }}><Text style={[S.bold, S.small]}>Physical Examination</Text></FormTableCell>
          {slots.map((slot) => (
            <FormTableCell key={slot} style={{ width: MEDICAL_FORM_EXAM_YEAR_WIDTH }}><Text style={[S.bold, S.small]}>{`${getSubmissionSlotLabel(slot).replace('Year ', 'Yr. ')} / Date: ${formatExamDate(getSlotRecord(slot))}`}</Text></FormTableCell>
          ))}
        </View>
        {EXAM_ROWS.map((row) => (
          <View key={row} style={S.row}>
            <FormTableCell style={{ width: MEDICAL_FORM_EXAM_LABEL_WIDTH, height: 22 * PX_TO_PT }}><Text style={[S.bold, S.small]}>{row}</Text></FormTableCell>
            {slots.map((slot) => <FormTableCell key={slot} style={{ width: MEDICAL_FORM_EXAM_YEAR_WIDTH, height: 22 * PX_TO_PT }}>{text(getExamFieldValue(getSlotRecord(slot), EXAM_FIELD_MAP[row]))}</FormTableCell>)}
          </View>
        ))}
        <View style={S.row}>
          <FormTableCell style={{ width: MEDICAL_FORM_EXAM_LABEL_WIDTH }}><Text style={[S.bold, S.small]}>Examined by:</Text></FormTableCell>
          {slots.map((slot) => {
            const exam = getSlotRecord(slot)?.staffMeasurements || {};
            return (
              <FormTableCell key={slot} style={{ width: MEDICAL_FORM_EXAM_YEAR_WIDTH, minHeight: 60 * PX_TO_PT, alignItems: 'center', justifyContent: 'center' }}>
                {exam.examinedBySignatureUrl ? <Image src={exam.examinedBySignatureUrl} style={{ height: 32 * PX_TO_PT, width: 96 * PX_TO_PT, objectFit: 'contain' }} /> : null}
                <Text style={[S.small, { textAlign: 'center', marginTop: 3 }]}>{text(exam.examinedBy)}</Text>
              </FormTableCell>
            );
          })}
        </View>
      </View>

      <View style={[S.table, { width: MEDICAL_FORM_TABLE_WIDTH, marginBottom: 6 * PX_TO_PT }]}>
        <View style={S.row}>
          <FormTableCell style={{ width: MEDICAL_FORM_LAB_LABEL_WIDTH, minHeight: 64 * PX_TO_PT, justifyContent: 'center' }}>
            <Text style={[S.bold, S.small]}>Chest :{'\n'}x-ray</Text>
          </FormTableCell>
          {slots.map((slot) => {
            const lab = getSlotLab(slot);
            return (
              <FormTableCell key={slot} style={{ width: MEDICAL_FORM_LAB_YEAR_WIDTH, minHeight: 64 * PX_TO_PT, paddingVertical: 5 * PX_TO_PT, gap: 3 * PX_TO_PT }}>
                <View style={[S.row, { alignItems: 'flex-end' }]}>
                  <Text style={S.small}>Date: </Text>
                  <FormInlineLine value={lab.xrayDate} width={52 * PX_TO_PT} />
                </View>
                <View style={[S.row, { alignItems: 'flex-end', justifyContent: 'space-between' }]}>
                  <Text style={S.small}>Abnormal findings</Text>
                  <View style={[S.row, { alignItems: 'flex-end' }]}>
                    <Text style={S.small}>Result: </Text>
                    <FormInlineLine value={formatXrayResult(lab.xrayResult)} width={42 * PX_TO_PT} />
                  </View>
                </View>
                <Text style={[S.small, { lineHeight: 1.25 }]}>{text(lab.xrayFindings)}</Text>
              </FormTableCell>
            );
          })}
        </View>

        <View style={S.row}>
          <FormTableCell style={{ width: MEDICAL_FORM_LAB_LABEL_WIDTH, minHeight: 86 * PX_TO_PT, justifyContent: 'center' }}>
            <Text style={[S.bold, S.small]}>CBC:</Text>
          </FormTableCell>
          {slots.map((slot) => {
            const lab = getSlotLab(slot);
            return (
              <FormTableCell key={slot} style={{ width: MEDICAL_FORM_LAB_YEAR_WIDTH, minHeight: 86 * PX_TO_PT, paddingVertical: 5 * PX_TO_PT, gap: 3 * PX_TO_PT }}>
                <View style={[S.row, { alignItems: 'flex-end' }]}>
                  <Text style={S.small}>Date: </Text>
                  <FormInlineLine value={lab.cbcDate} width={52 * PX_TO_PT} />
                </View>
                <View style={[S.row, { alignItems: 'flex-end' }]}>
                  <Text style={S.small}>Hgb. </Text>
                  <FormInlineLine value={lab.hemoglobin} width={36 * PX_TO_PT} />
                  <Text style={S.small}> Hct. </Text>
                  <FormInlineLine value={lab.hematocrit} width={36 * PX_TO_PT} />
                </View>
                <View style={[S.row, { alignItems: 'flex-end' }]}>
                  <Text style={S.small}>WBC </Text>
                  <FormInlineLine value={lab.wbc} width={42 * PX_TO_PT} />
                  <Text style={S.small}> &lt;</Text>
                </View>
                <View style={[S.row, { alignItems: 'flex-end' }]}>
                  <Text style={S.small}>Plt. Ct. </Text>
                  <FormInlineLine value={lab.plateletCount} width={42 * PX_TO_PT} />
                </View>
                <View style={[S.row, { alignItems: 'flex-end' }]}>
                  <Text style={S.small}>Bld. Type </Text>
                  <FormInlineLine value={lab.bloodType} width={42 * PX_TO_PT} />
                </View>
              </FormTableCell>
            );
          })}
        </View>

        <View style={S.row}>
          <FormTableCell style={{ width: MEDICAL_FORM_LAB_LABEL_WIDTH, minHeight: 64 * PX_TO_PT, justifyContent: 'center' }}>
            <Text style={[S.bold, S.small]}>U/A:</Text>
          </FormTableCell>
          {slots.map((slot) => {
            const lab = getSlotLab(slot);
            return (
              <FormTableCell key={slot} style={{ width: MEDICAL_FORM_LAB_YEAR_WIDTH, minHeight: 64 * PX_TO_PT, paddingVertical: 5 * PX_TO_PT, gap: 3 * PX_TO_PT }}>
                <View style={[S.row, { alignItems: 'flex-end' }]}>
                  <Text style={S.small}>Date: </Text>
                  <FormInlineLine value={lab.urinalysisDate} width={52 * PX_TO_PT} />
                </View>
                <View style={[S.row, { alignItems: 'flex-end' }]}>
                  <Text style={S.small}>•Glucose/Sugar </Text>
                  <FormInlineLine value={lab.urinalysisGlucose} width={56 * PX_TO_PT} />
                </View>
                <View style={[S.row, { alignItems: 'flex-end' }]}>
                  <Text style={S.small}>•Protein </Text>
                  <FormInlineLine value={lab.urinalysisProtein} width={56 * PX_TO_PT} />
                </View>
              </FormTableCell>
            );
          })}
        </View>

        <View style={S.row}>
          <FormTableCell style={{ width: MEDICAL_FORM_LAB_LABEL_WIDTH, minHeight: 22 * PX_TO_PT }}><Text style={[S.bold, S.small]}>OTHERS:</Text></FormTableCell>
          {slots.map((slot) => <FormTableCell key={slot} style={{ width: MEDICAL_FORM_LAB_YEAR_WIDTH, minHeight: 22 * PX_TO_PT }}>{text(getSlotLab(slot).others)}</FormTableCell>)}
        </View>

        <View style={S.row}>
          <FormTableCell style={{ width: MEDICAL_FORM_LAB_LABEL_WIDTH, minHeight: 22 * PX_TO_PT }}><Text style={[S.bold, S.small]}>Date{'\n'}Received:</Text></FormTableCell>
          {slots.map((slot) => {
            const sourceRecord = getSlotRecord(slot);
            const dateReceived = sourceRecord?.updatedAt ? new Date(sourceRecord.updatedAt).toLocaleDateString() : '';
            return <FormTableCell key={slot} style={{ width: MEDICAL_FORM_LAB_YEAR_WIDTH, minHeight: 22 * PX_TO_PT }}>{dateReceived}</FormTableCell>;
          })}
        </View>
      </View>
      <Text style={{ fontSize: 9 * PX_TO_PT, marginTop: 8 * PX_TO_PT, color: '#333' }}>Revision#4    05/2024 qbb</Text>
    </Page>
  );
}

function MedicalRecordPdf({
  record,
  records = [],
  academicYearLabel,
}: {
  record: SubmissionRecord;
  records?: SubmissionRecord[];
  academicYearLabel?: string;
}) {
  const dedupedRecords = Array.from(
    new Map([...records, record].filter((item): item is SubmissionRecord => Boolean(item?.id)).map((item) => [item.id, item])).values(),
  );
  const initialSlot = normalizeSubmissionSlot(record.year) || 1;
  const recordsBySlot = buildBestRecordBySlot(dedupedRecords);
  const slotPages = buildSlotPages(recordsBySlot, initialSlot);
  const resolvedYear = academicYearLabel || formatAcademicYearLabel(getRecordAcademicYear(record));
  return (
    <Document title="Medical Record">
      {slotPages.map((slots) => (
        <MedicalRecordPdfPage
          key={slots[0]}
          record={record}
          recordsBySlot={recordsBySlot}
          slots={slots}
          academicYearLabel={resolvedYear}
        />
      ))}
    </Document>
  );
}

async function openPdfDocument(document: ReactElement, title: string, record?: SubmissionRecord) {
  const previewWindow = window.open('', '_blank');
  if (!previewWindow) {
    throw new Error('The PDF preview was blocked. Please allow pop-ups for this site and try again.');
  }
  writePdfPreviewShell(previewWindow, 'Preparing PDF...');
  try {
    const blob = await pdf(document).toBlob();
    const fileName = getPdfFileName(title, record);
    const url = URL.createObjectURL(blob);
    writePdfPreviewDocument(previewWindow, title, fileName, url);
    window.setTimeout(() => URL.revokeObjectURL(url), 15 * 60_000);
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}

export function openMedicalCertificatePdf(record: SubmissionRecord, academicYearLabel?: string) {
  return openPdfDocument(<MedicalCertificatePdf record={record} academicYearLabel={academicYearLabel} />, 'Medical Certificate', record);
}

export function openMedicalRecordPdf(record: SubmissionRecord, records?: SubmissionRecord[], academicYearLabel?: string) {
  return openPdfDocument(<MedicalRecordPdf record={record} records={records} academicYearLabel={academicYearLabel} />, 'Medical Record', record);
}
