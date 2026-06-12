import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PortalPageIntro from '../portal-page-intro';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import {
  Activity,
  Award,
  ClipboardCheck,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { getActiveAjaxRefetchInterval } from '../../lib/ajax-refresh';
import type { SubmissionRecord } from '../../lib/record-types';
import {
  BarChart,
  Bar,
  LabelList,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  createDefaultAdminSystemSettings,
  getAnalytics,
  getReportingTermSettings,
  getSubmissions,
  type AdminSystemSettings,
} from '../../lib/api';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
const REPORTING_TERM_REFRESH_INTERVAL_MS = 180_000;
const REPORTS_QUERY_GC_TIME_MS = 10 * 60_000;
const YEAR_LABELS: Record<string, string> = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' };
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  returned: 'Returned',
  physical_exam_done: 'Physical Exam Done',
};
const CERTIFICATE_LABELS: Record<string, string> = { all: 'All Certificates', issued: 'Issued Only', not_issued: 'Not Issued' };
const STATUS_COLORS: Record<string, string> = {
  Approved: '#3b6d11',
  Pending: '#ba7517',
  'In Review': '#2f6fa3',
  Returned: '#a32d2d',
  'Exam Done': '#185fa5',
};
const DEPARTMENT_COLORS: Record<string, string> = {
  CCS: '#f97316',
  CBA: '#facc15',
  CEAS: '#3b82f6',
  CHTM: '#ec4899',
  CAHS: '#ef4444',
};
const CHART_PRIMARY = '#006d3c';
const CHART_PRIMARY_SOFT = '#12b76a';
const CHART_GREEN_PALE = '#85f6ae';
const CHART_GRID = '#d8e4d7';
const CHART_TEXT = '#3d4a3f';
const CERTIFICATE_COLORS: Record<string, string> = {
  Issued: CHART_PRIMARY,
  'Not Issued': '#d8e4d7',
};
const GENDER_COLORS: Record<string, string> = {
  Male: CHART_PRIMARY,
  Female: CHART_PRIMARY_SOFT,
  Other: CHART_GREEN_PALE,
  Unspecified: '#d8e4d7',
};

type ReportsSummary = {
  total: number;
  approved: number;
  pending: number;
  inReview: number;
  returned: number;
  physicalExamDone: number;
  firstYears: number;
  firstYearUnderReview: number;
  firstYearNotUnderReview: number;
  withCertificate: number;
  approvalRate: number;
  byCourse: Record<string, number>;
};

type SubmissionBreakdownView = 'department' | 'program';
type SubmissionBreakdownDatum = {
  label: string;
  count: number;
  fill: string;
};
type NamedCountDatum = {
  name: string;
  value: number;
  fill: string;
  percent?: number;
};
type TimelineDatum = {
  key: string;
  label: string;
  count: number;
};
type RankedDatum = {
  label: string;
  count: number;
  percent: number;
};
type ReportingTermRange = {
  label: string;
  startMs: number;
  endMs: number;
};
type ReportSubmission = SubmissionRecord & {
  gender?: string;
  certificatePdfUrl?: string;
};
type ClinicalSummary = {
  clearanceIssued: number;
  pendingPhysicalExams: number;
  medicalCertificatesIssued: number;
  abnormalXray: number;
  anemiaTrend: number;
  abnormalUrinalysis: number;
};
type ReportTableRow = {
  studentId: string;
  fullName: string;
  courseDept: string;
  submissionDate: string;
  labStatus: string;
  physicalExamStatus: string;
  issuedCertificates: string;
};

function normalizeCourseValue(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function resolveDepartmentValue(department?: string, course?: string) {
  const normalizedDepartment = String(department || '').trim().toUpperCase();
  if (DEPARTMENTS.includes(normalizedDepartment)) return normalizedDepartment;

  const normalizedCourse = String(course || '').trim().toUpperCase();
  const matchedDepartment = DEPARTMENTS.find((item) => normalizedCourse.includes(item));
  if (matchedDepartment) return matchedDepartment;

  return normalizedDepartment;
}

function abbreviateCourse(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '-';

  const parenMatch = raw.match(/\(([A-Za-z]{2,10})\)\s*$/);
  if (parenMatch?.[1]) return parenMatch[1].toUpperCase();

  const normalized = raw.toLowerCase().replace(/\./g, '');
  const known: Array<[string, string]> = [
    ['bachelor of science in information technology', 'BSIT'],
    ['bs information technology', 'BSIT'],
    ['bachelor of science in computer science', 'BSCS'],
    ['bs computer science', 'BSCS'],
    ['bachelor of science in nursing', 'BSN'],
    ['bs nursing', 'BSN'],
    ['bachelor of science in business administration', 'BSBA'],
    ['bs business administration', 'BSBA'],
    ['bachelor of science in psychology', 'BSPsych'],
    ['bs psychology', 'BSPsych'],
    ['bachelor of science in hospitality management', 'BSHM'],
    ['bs hospitality management', 'BSHM'],
    ['bachelor of secondary education', 'BSEd'],
    ['bachelor of elementary education', 'BEEd'],
  ];
  const exact = known.find(([key]) => normalized === key);
  if (exact) return exact[1];

  const bsInMatch = normalized.match(/^bachelor of science in\s+(.+)$/i);
  if (bsInMatch?.[1]) {
    const major = bsInMatch[1]
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !['and', 'of', 'the', 'in'].includes(w));
    const majorAcronym = major.map((w) => w[0]).join('').toUpperCase();
    if (majorAcronym) return `BS${majorAcronym}`;
  }

  if (/^[A-Za-z]{2,8}$/.test(raw.replace(/\s+/g, ''))) return raw.toUpperCase();

  const acronym = raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !['of', 'in', 'and', 'the'].includes(part.toLowerCase()))
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return acronym.length >= 3 && acronym.length <= 8 ? acronym : raw;
}

function buildReportingTermRange(settings: AdminSystemSettings): ReportingTermRange {
  const [startYearValue, endYearValue] = String(settings.academicYear || '').split('-');
  const startYear = Number.parseInt(startYearValue || '', 10);
  const endYear = Number.parseInt(endYearValue || '', 10);

  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
    return buildReportingTermRange(createDefaultAdminSystemSettings());
  }

  const label = `${settings.academicYear} • ${settings.semester}`;

  switch (settings.semester) {
    case 'First Semester':
      return {
        label,
        startMs: Date.UTC(startYear, 6, 1),
        endMs: Date.UTC(endYear, 0, 1),
      };
    case 'Summer':
      return {
        label,
        startMs: Date.UTC(endYear, 5, 1),
        endMs: Date.UTC(endYear, 6, 1),
      };
    case 'Second Semester':
    default:
      return {
        label,
        startMs: Date.UTC(endYear, 0, 1),
        endMs: Date.UTC(endYear, 5, 1),
      };
  }
}

function formatConditionLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (match) => match.toUpperCase());
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTimelineBucket(date: Date, mode: 'day' | 'week' | 'month') {
  if (mode === 'month') {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    return {
      key: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      label: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    };
  }

  if (mode === 'week') {
    const day = startOfLocalDay(date);
    const weekStart = new Date(day);
    weekStart.setDate(day.getDate() - day.getDay());
    return {
      key: weekStart.toISOString().slice(0, 10),
      label: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    };
  }

  const day = startOfLocalDay(date);
  return {
    key: day.toISOString().slice(0, 10),
    label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

function formatReportDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function formatReportDateTime(value = new Date()) {
  return value.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getFullName(submission: Pick<ReportSubmission, 'firstName' | 'middleInitial' | 'lastName'>) {
  const middle = submission.middleInitial ? ` ${String(submission.middleInitial).charAt(0)}.` : '';
  const firstName = String(submission.firstName || '').trim();
  const lastName = String(submission.lastName || '').trim();

  if (!firstName && !lastName) return '-';
  return `${lastName || '-'}, ${firstName || '-'}${middle}`;
}

function hasPhysicalExam(submission: ReportSubmission) {
  if (submission.status === 'physical_exam_done' || submission.status === 'approved') return true;

  const measurements = submission.staffMeasurements;
  if (!measurements) return false;

  return [
    measurements.examinedBy,
    measurements.updatedAt,
    measurements.bloodPressure,
    measurements.cardiacRate,
    measurements.respiratoryRate,
    measurements.temperature,
    measurements.visualAcuity,
    measurements.skin,
    measurements.heent,
    measurements.chestLungs,
    measurements.heart,
    measurements.abdomen,
    measurements.extremities,
  ].some((value) => String(value || '').trim().length > 0);
}

function parseLabNumber(value?: string | null) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : null;
}

function isNegativeLabValue(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;

  return [
    '0',
    'none',
    'nil',
    'negative',
    'normal',
    'not detected',
    'trace negative',
  ].includes(normalized);
}

function hasAnemiaFlag(submission: ReportSubmission) {
  const hemoglobin = parseLabNumber(submission.labResults?.hemoglobin);
  if (hemoglobin === null) return false;

  const sex = String(submission.sex || submission.gender || '').trim().toLowerCase();
  const threshold = sex === 'male' ? 13 : sex === 'female' ? 12 : 12.5;
  return hemoglobin < threshold;
}

function hasAbnormalXray(submission: ReportSubmission) {
  const result = String(submission.labResults?.xrayResult || '').trim().toLowerCase();
  if (result === 'abnormal') return true;

  const findings = String(submission.labResults?.xrayFindings || '').trim().toLowerCase();
  if (!findings || findings === 'normal' || findings.includes('no active') || findings.includes('unremarkable')) {
    return false;
  }

  return true;
}

function hasAbnormalUrinalysis(submission: ReportSubmission) {
  const glucose = submission.labResults?.urinalysisGlucose;
  const protein = submission.labResults?.urinalysisProtein;

  return !isNegativeLabValue(glucose) || !isNegativeLabValue(protein);
}

function formatLabStatus(submission: ReportSubmission) {
  const labResults = submission.labResults;
  const xray = hasAbnormalXray(submission)
    ? 'X-Ray: Abnormal'
    : labResults?.xrayDate || submission.xrayFileUrl || labResults?.xrayResult
      ? 'X-Ray: Done'
      : 'X-Ray: Pending';
  const cbc = hasAnemiaFlag(submission)
    ? 'CBC: Low Hgb'
    : labResults?.cbcDate || submission.cbcFileUrl || labResults?.hemoglobin
      ? 'CBC: Done'
      : 'CBC: Pending';
  const urinalysis = hasAbnormalUrinalysis(submission)
    ? 'Urinalysis: Abnormal'
    : labResults?.urinalysisDate || submission.urinalysisFileUrl
      ? 'Urinalysis: Done'
      : 'Urinalysis: Pending';

  return `${xray} / ${cbc} / ${urinalysis}`;
}

function formatPhysicalExamStatus(submission: ReportSubmission) {
  if (hasPhysicalExam(submission)) return 'Completed';
  if (submission.status === 'returned') return 'Returned';
  return 'Pending';
}

function formatCertificateStatus(submission: ReportSubmission) {
  const issuedDate = submission.clearanceInfo?.issuedDate;
  if (!issuedDate) return 'None';

  const controlNo = String(submission.clearanceInfo?.controlNo || '').trim();
  return controlNo ? `Issued ${formatReportDate(issuedDate)} (${controlNo})` : `Issued ${formatReportDate(issuedDate)}`;
}

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number) {
  let column = '';
  let value = index + 1;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }

  return column;
}

function buildSheetRow(rowIndex: number, values: string[], styleIndex: number) {
  const cells = values.map((value, columnIndex) => {
    const reference = `${columnName(columnIndex)}${rowIndex}`;
    return `<c r="${reference}" t="inlineStr" s="${styleIndex}"><is><t>${escapeXml(value)}</t></is></c>`;
  });

  return `<row r="${rowIndex}">${cells.join('')}</row>`;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });

  return output;
}

function createZipBlob(files: Array<{ path: string; content: string }>) {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.path);
    const contentBytes = encoder.encode(file.content);
    const checksum = crc32(contentBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, dosTime);
    writeUint16(localHeader, 12, dosDate);
    writeUint32(localHeader, 14, checksum);
    writeUint32(localHeader, 18, contentBytes.length);
    writeUint32(localHeader, 22, contentBytes.length);
    writeUint16(localHeader, 26, nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, dosTime);
    writeUint16(centralHeader, 14, dosDate);
    writeUint32(centralHeader, 16, checksum);
    writeUint32(centralHeader, 20, contentBytes.length);
    writeUint32(centralHeader, 24, contentBytes.length);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralChunks.push(centralHeader);

    offset += localHeader.length + contentBytes.length;
  });

  const centralDirectory = concatBytes(centralChunks);
  const endRecord = new Uint8Array(22);
  writeUint32(endRecord, 0, 0x06054b50);
  writeUint16(endRecord, 8, files.length);
  writeUint16(endRecord, 10, files.length);
  writeUint32(endRecord, 12, centralDirectory.length);
  writeUint32(endRecord, 16, offset);

  return new Blob([concatBytes([...localChunks, centralDirectory, endRecord])], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function buildXlsxBlob(rows: string[][]) {
  const rowXml = rows
    .map((row, index) => {
      const rowIndex = index + 1;
      const styleIndex = rowIndex === 1 ? 1 : rowIndex <= 5 ? 2 : rowIndex === 7 ? 3 : 4;
      return buildSheetRow(rowIndex, row, styleIndex);
    })
    .join('');

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <cols>
    <col min="1" max="1" width="18" customWidth="1"/>
    <col min="2" max="2" width="28" customWidth="1"/>
    <col min="3" max="3" width="26" customWidth="1"/>
    <col min="4" max="4" width="18" customWidth="1"/>
    <col min="5" max="5" width="46" customWidth="1"/>
    <col min="6" max="6" width="22" customWidth="1"/>
    <col min="7" max="7" width="34" customWidth="1"/>
  </cols>
  <sheetData>${rowXml}</sheetData>
  <mergeCells count="1"><mergeCell ref="A1:G1"/></mergeCells>
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F5133"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  return createZipBlob([
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    },
    {
      path: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Medical Report" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { path: 'xl/worksheets/sheet1.xml', content: sheetXml },
    { path: 'xl/styles.xml', content: stylesXml },
    {
      path: 'docProps/core.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Gordon College HSU Medical Report</dc:title>
  <dc:creator>ClinicKa</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`,
    },
    {
      path: 'docProps/app.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>ClinicKa</Application>
</Properties>`,
    },
  ]);
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  helper,
  progress,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  helper?: string;
  progress?: number;
}) {
  const normalizedProgress = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null;

  return (
    <Card className="overflow-hidden border-outline-variant/30 print:break-inside-avoid print:border print:border-black print:bg-white print:shadow-none">
      <CardContent className="pt-5 pb-5 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 truncate print:text-black">{label}</p>
            <p className={`text-3xl font-bold leading-none print:text-black ${accent}`}>{value}</p>
            {helper && <p className="mt-2 text-xs leading-5 text-on-surface-variant print:text-black">{helper}</p>}
          </div>
          <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center print:bg-white ${accent.replace('text-', 'bg-').replace('600', '100').replace('foreground', '100')}`}>
            <Icon className={`w-4.5 h-4.5 print:text-black ${accent}`} strokeWidth={2} />
          </div>
        </div>
        {normalizedProgress !== null && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-container-high print:hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${normalizedProgress}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Filter Section Label ───────────────────────────────────────────────────
function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">{label}</p>
      {children}
    </div>
  );
}

// ── Labeled Select ─────────────────────────────────────────────────────────
function LabeledSelect({
  label,
  value,
  onValueChange,
  placeholder,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────
function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[18px] border border-outline-variant/40 bg-white px-3 py-2 text-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} submissions</p>
    </div>
  );
}

function CustomTimelineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[18px] border border-outline-variant/40 bg-white px-3 py-2 text-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} submissions</p>
    </div>
  );
}

function CustomDonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[18px] border border-outline-variant/40 bg-white px-3 py-2 text-sm">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-muted-foreground">{payload[0].value} students</p>
    </div>
  );
}

function DepartmentBarValueLabel(props: any) {
  const { x = 0, y = 0, width = 0, value = 0 } = props || {};

  return (
    <text
      x={x + width / 2}
      y={Math.max(Number(y) - 8, 14)}
      textAnchor="middle"
      fontSize={12}
      fill="hsl(var(--muted-foreground))"
    >
      {value}
    </text>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-[18px] border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-on-surface-variant">
      {message}
    </div>
  );
}

function ProgressList({
  items,
  emptyMessage,
}: {
  items: RankedDatum[];
  emptyMessage: string;
}) {
  if (!items.length) return <EmptyChartState message={emptyMessage} />;

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-on-surface">{item.label}</span>
            <span className="shrink-0 text-on-surface-variant">{item.count} • {item.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-primary" style={{ width: `${item.percent}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPipeline({ items }: { items: NamedCountDatum[] }) {
  if (!items.length) return <EmptyChartState message="No status data available for the selected filters." />;

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.name} className="rounded-[18px] border border-outline-variant/35 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
              <span className="truncate font-semibold text-on-surface">{item.name}</span>
            </div>
            <span className="shrink-0 text-on-surface-variant">{item.value} • {item.percent ?? 0}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full" style={{ width: `${item.percent ?? 0}%`, backgroundColor: item.fill }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ReportsDashboard({ mode }: { mode: 'staff' | 'admin' }) {
  const analyticsQueryKey = mode === 'admin' ? ['adminAnalytics'] : ['staffAnalytics'];
  const submissionsQueryKey = mode === 'admin' ? ['adminSubmissions'] : ['staffSubmissions'];
  const reportingTermQueryKey = ['reportingTermSettings'];
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [certificateFilter, setCertificateFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [studentBatchFilter, setStudentBatchFilter] = useState('all');
  const [submissionBreakdownView, setSubmissionBreakdownView] = useState<SubmissionBreakdownView>('department');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultReportingTermSettings = useMemo(() => createDefaultAdminSystemSettings(), []);
  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: isAnalyticsError,
  } = useQuery({
    queryKey: analyticsQueryKey,
    queryFn: () => getAnalytics(),
    staleTime: 60_000,
    gcTime: REPORTS_QUERY_GC_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(90_000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
  const {
    data: submissions = [],
    isLoading: submissionsLoading,
    isError: isSubmissionsError,
  } = useQuery({
    queryKey: submissionsQueryKey,
    queryFn: async () => {
      const data = await getSubmissions();
      return data.submissions || [];
    },
    staleTime: 60_000,
    gcTime: REPORTS_QUERY_GC_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(60_000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
  const {
    data: reportingTermSettings = defaultReportingTermSettings,
    isLoading: reportingTermLoading,
  } = useQuery({
    queryKey: reportingTermQueryKey,
    queryFn: getReportingTermSettings,
    staleTime: 60_000,
    gcTime: REPORTS_QUERY_GC_TIME_MS,
    refetchInterval: () => getActiveAjaxRefetchInterval(REPORTING_TERM_REFRESH_INTERVAL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
  const normalizedSubmissions = useMemo(
    (): ReportSubmission[] =>
      Array.isArray(submissions)
        ? (submissions as ReportSubmission[])
        : Array.isArray((submissions as { submissions?: unknown[] } | undefined)?.submissions)
          ? ((submissions as { submissions: ReportSubmission[] }).submissions)
          : [],
    [submissions],
  );
  const loading = analyticsLoading || submissionsLoading || reportingTermLoading;

  useEffect(() => {
    if (isAnalyticsError || isSubmissionsError) {
      toast.error('Failed to load report data');
    }
  }, [isAnalyticsError, isSubmissionsError]);

  const allCourses = useMemo(
    () =>
      [...new Set(normalizedSubmissions.map((s) => String(s.course || '').trim()).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [normalizedSubmissions],
  );

  const allConditions = useMemo(() => {
    const keys = new Set<string>();
    normalizedSubmissions.forEach((s) => Object.entries(s.medicalHistory || {}).forEach(([k, v]) => v && keys.add(k)));
    return [...keys].sort((a, b) => a.localeCompare(b));
  }, [normalizedSubmissions]);

  const studentBatches = useMemo(() => {
    const batches = new Set<string>();
    normalizedSubmissions.forEach((s) => {
      const id = String(s.studentId || '');
      const match = id.match(/^(\d{4})/);
      if (match?.[1]) batches.add(match[1]);
    });
    return [...batches].sort();
  }, [normalizedSubmissions]);

  const filteredSubmissions = useMemo(
    () =>
      normalizedSubmissions.filter((sub) => {
        if (departmentFilter !== 'all' && !(sub.department === departmentFilter || sub.course?.includes(departmentFilter))) return false;
        if (yearFilter !== 'all' && String(sub.year) !== yearFilter) return false;
        if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
        if (courseFilter !== 'all' && normalizeCourseValue(sub.course) !== normalizeCourseValue(courseFilter)) return false;
        if (
          conditionFilter !== 'all'
          && !sub.medicalHistory?.[conditionFilter as keyof NonNullable<ReportSubmission['medicalHistory']>]
        ) return false;
        if (certificateFilter === 'issued' && !sub.clearanceInfo?.issuedDate) return false;
        if (certificateFilter === 'not_issued' && sub.clearanceInfo?.issuedDate) return false;
        if (genderFilter !== 'all') {
          const gender = String(sub.gender || sub.sex || '').trim().toLowerCase();
          if (gender !== genderFilter) return false;
        }
        if (studentBatchFilter !== 'all') {
          const id = String(sub.studentId || '');
          if (!id.startsWith(studentBatchFilter)) return false;
        }
        const subDate = sub.submittedAt ? new Date(sub.submittedAt) : null;
        if (fromDate && subDate && subDate < new Date(`${fromDate}T00:00:00`)) return false;
        if (toDate && subDate && subDate > new Date(`${toDate}T23:59:59`)) return false;
        return true;
      }),
    [normalizedSubmissions, departmentFilter, yearFilter, statusFilter, courseFilter, conditionFilter, certificateFilter, genderFilter, studentBatchFilter, fromDate, toDate],
  );

  const dedupedFilteredSubmissions = useMemo(() => {
    const seen = new Set<string>();
    const out: ReportSubmission[] = [];
    for (const s of filteredSubmissions) {
      const signature = [
        s.studentId || '',
        (s.firstName || '').trim().toLowerCase(),
        (s.lastName || '').trim().toLowerCase(),
        s.year || '',
        s.status || '',
        s.course || '',
        s.submittedAt ? new Date(s.submittedAt).toISOString().slice(0, 10) : '',
      ].join('|');
      if (seen.has(signature)) continue;
      seen.add(signature);
      out.push(s);
    }
    return out;
  }, [filteredSubmissions]);

  const dateRange = useMemo(() => {
    const timestamps = normalizedSubmissions
      .map((s) => (s.submittedAt ? new Date(s.submittedAt).getTime() : NaN))
      .filter((t) => Number.isFinite(t)) as number[];
    if (!timestamps.length) return { minDate: '', maxDate: today };
    const min = new Date(Math.min(...timestamps)).toISOString().split('T')[0];
    return { minDate: min, maxDate: today };
  }, [normalizedSubmissions, today]);

  useEffect(() => {
    if (!normalizedSubmissions.length) return;
    if (!fromDate) setFromDate(dateRange.minDate);
    if (!toDate) setToDate(dateRange.maxDate);
  }, [normalizedSubmissions, fromDate, toDate, dateRange.minDate, dateRange.maxDate]);

  const hasActiveFilters =
    departmentFilter !== 'all' || yearFilter !== 'all' || statusFilter !== 'all' ||
    courseFilter !== 'all' || conditionFilter !== 'all' || certificateFilter !== 'all' ||
    genderFilter !== 'all' || studentBatchFilter !== 'all';

  const resetFilters = () => {
    setDepartmentFilter('all');
    setYearFilter('all');
    setStatusFilter('all');
    setCourseFilter('all');
    setConditionFilter('all');
    setCertificateFilter('all');
    setGenderFilter('all');
    setStudentBatchFilter('all');
    setFromDate(dateRange.minDate);
    setToDate(dateRange.maxDate);
  };

  const summary = useMemo<ReportsSummary>(() => {
    const total = dedupedFilteredSubmissions.length;
    const approved = dedupedFilteredSubmissions.filter((s) => s.status === 'approved').length;
    const pending = dedupedFilteredSubmissions.filter((s) => s.status === 'pending').length;
    const inReview = dedupedFilteredSubmissions.filter((s) => s.status === 'in_review').length;
    const returned = dedupedFilteredSubmissions.filter((s) => s.status === 'returned').length;
    const physicalExamDone = dedupedFilteredSubmissions.filter((s) => s.status === 'physical_exam_done').length;
    const firstYears = dedupedFilteredSubmissions.filter((s) => String(s.year) === '1');
    const firstYearUnderReview = firstYears.filter((s) => s.status === 'pending' || s.status === 'in_review').length;
    const firstYearNotUnderReview = firstYears.length - firstYearUnderReview;
    const withCertificate = dedupedFilteredSubmissions.filter((s) => Boolean(s.clearanceInfo?.issuedDate)).length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const byCourse = dedupedFilteredSubmissions.reduce(
      (acc, sub) => {
        const course = sub.course || 'Unknown';
        acc[course] = (acc[course] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return {
      total,
      approved,
      pending,
      inReview,
      returned,
      physicalExamDone,
      firstYears: firstYears.length,
      firstYearUnderReview,
      firstYearNotUnderReview,
      withCertificate,
      approvalRate,
      byCourse,
    };
  }, [dedupedFilteredSubmissions]);
  const reportingTermRange = useMemo(
    () => buildReportingTermRange(reportingTermSettings),
    [reportingTermSettings],
  );
  const currentTermSubmissions = useMemo(
    () =>
      dedupedFilteredSubmissions.filter((submission) => {
        const submittedTimestamp = new Date(submission.submittedAt || 0).getTime();
        return Number.isFinite(submittedTimestamp)
          && submittedTimestamp >= reportingTermRange.startMs
          && submittedTimestamp < reportingTermRange.endMs;
      }),
    [dedupedFilteredSubmissions, reportingTermRange.endMs, reportingTermRange.startMs],
  );

  // ── Chart data ─────────────────────────────────────────────────────────
  const departmentChartData = useMemo(() => {
    const counts = currentTermSubmissions.reduce((acc, sub) => {
      const department = resolveDepartmentValue(sub.department, sub.course);
      if (!department) return acc;

      acc[department] = (acc[department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return DEPARTMENTS
      .map((department) => ({
        department,
        count: counts[department] || 0,
        fill: DEPARTMENT_COLORS[department] || '#94a3b8',
      }));
  }, [currentTermSubmissions]);
  const programChartData = useMemo(
    () => {
      const programCounts = currentTermSubmissions.reduce((acc, sub) => {
        const program = abbreviateCourse(sub.course);
        if (!program || program === '-') return acc;

        acc[program] = (acc[program] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return (Object.entries(programCounts) as Array<[string, number]>)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([label, count]) => ({
          label,
          count,
          fill: 'hsl(var(--primary))',
        }));
    },
    [currentTermSubmissions],
  );
  const submissionBreakdownData: SubmissionBreakdownDatum[] = submissionBreakdownView === 'department'
    ? departmentChartData.map((item) => ({
        label: item.department,
        count: item.count,
        fill: item.fill,
      }))
    : programChartData;

  const statusChartData = useMemo<NamedCountDatum[]>(
    () => [
      { name: 'Approved', value: summary.approved, fill: STATUS_COLORS.Approved },
      { name: 'Pending', value: summary.pending, fill: STATUS_COLORS.Pending },
      { name: 'In Review', value: summary.inReview, fill: STATUS_COLORS['In Review'] },
      { name: 'Returned', value: summary.returned, fill: STATUS_COLORS.Returned },
      { name: 'Exam Done', value: summary.physicalExamDone, fill: STATUS_COLORS['Exam Done'] },
    ]
      .filter((d) => d.value > 0)
      .map((d) => ({
        ...d,
        percent: summary.total > 0 ? Math.round((d.value / summary.total) * 100) : 0,
      })),
    [summary],
  );

  const submissionsByDate = useMemo<TimelineDatum[]>(() => {
    const dated = dedupedFilteredSubmissions
      .map((s) => (s.submittedAt ? new Date(s.submittedAt) : null))
      .filter((date): date is Date => date instanceof Date && Number.isFinite(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (!dated.length) return [];

    const first = startOfLocalDay(dated[0]);
    const last = startOfLocalDay(dated[dated.length - 1]);
    const spanDays = Math.max(1, Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1);
    const bucketMode = spanDays > 180 ? 'month' : spanDays > 45 ? 'week' : 'day';
    const buckets = new Map<string, TimelineDatum>();

    dated.forEach((date) => {
      const bucket = getTimelineBucket(date, bucketMode);
      const existing = buckets.get(bucket.key);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(bucket.key, { ...bucket, count: 1 });
      }
    });

    return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [dedupedFilteredSubmissions]);

  const yearLevelData = useMemo<NamedCountDatum[]>(
    () =>
      Object.entries(YEAR_LABELS).map(([year, label], index) => {
        const value = dedupedFilteredSubmissions.filter((s) => String(s.year) === year).length;
        return {
          name: label,
          value,
          fill: [CHART_PRIMARY, CHART_PRIMARY_SOFT, CHART_GREEN_PALE, '#3b6d11'][index] || CHART_PRIMARY,
          percent: summary.total > 0 ? Math.round((value / summary.total) * 100) : 0,
        };
      }),
    [dedupedFilteredSubmissions, summary.total],
  );

  const certificateChartData = useMemo<NamedCountDatum[]>(
    () => [
      {
        name: 'Issued',
        value: summary.withCertificate,
        fill: CERTIFICATE_COLORS.Issued,
        percent: summary.total > 0 ? Math.round((summary.withCertificate / summary.total) * 100) : 0,
      },
      {
        name: 'Not Issued',
        value: Math.max(summary.total - summary.withCertificate, 0),
        fill: CERTIFICATE_COLORS['Not Issued'],
        percent: summary.total > 0 ? Math.round(((summary.total - summary.withCertificate) / summary.total) * 100) : 0,
      },
    ].filter((item) => item.value > 0),
    [summary.total, summary.withCertificate],
  );

  const genderChartData = useMemo<NamedCountDatum[]>(() => {
    const counts: Record<string, number> = {};
    dedupedFilteredSubmissions.forEach((submission) => {
      const normalized = String(submission.gender || submission.sex || '').trim().toLowerCase();
      const label = normalized === 'male' ? 'Male' : normalized === 'female' ? 'Female' : normalized ? 'Other' : 'Unspecified';
      counts[label] = (counts[label] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        fill: GENDER_COLORS[name] || CHART_PRIMARY,
        percent: summary.total > 0 ? Math.round((value / summary.total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [dedupedFilteredSubmissions, summary.total]);

  const conditionPrevalenceData = useMemo<RankedDatum[]>(() => {
    const counts: Record<string, number> = {};
    dedupedFilteredSubmissions.forEach((submission) => {
      Object.entries(submission.medicalHistory || {}).forEach(([key, value]) => {
        if (value) counts[key] = (counts[key] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .map(([label, count]) => ({
        label: formatConditionLabel(label),
        count,
        percent: summary.total > 0 ? Math.round((count / summary.total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 8);
  }, [dedupedFilteredSubmissions, summary.total]);

  const topPrograms = useMemo<RankedDatum[]>(
    () =>
      Object.entries(summary.byCourse)
        .map(([course, count]) => ({
          label: abbreviateCourse(course),
          count,
          percent: summary.total > 0 ? Math.round((count / summary.total) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 5),
    [summary.byCourse, summary.total],
  );

  const clinicalSummary = useMemo<ClinicalSummary>(() => {
    const clearanceIssued = dedupedFilteredSubmissions.filter((submission) => Boolean(submission.clearanceInfo?.issuedDate)).length;
    const completedPhysicalExams = dedupedFilteredSubmissions.filter(hasPhysicalExam).length;
    const abnormalXray = dedupedFilteredSubmissions.filter(hasAbnormalXray).length;
    const anemiaTrend = dedupedFilteredSubmissions.filter(hasAnemiaFlag).length;
    const abnormalUrinalysis = dedupedFilteredSubmissions.filter(hasAbnormalUrinalysis).length;

    return {
      clearanceIssued,
      pendingPhysicalExams: Math.max(dedupedFilteredSubmissions.length - completedPhysicalExams, 0),
      medicalCertificatesIssued: clearanceIssued,
      abnormalXray,
      anemiaTrend,
      abnormalUrinalysis,
    };
  }, [dedupedFilteredSubmissions]);

  const reportTableRows = useMemo<ReportTableRow[]>(
    () =>
      dedupedFilteredSubmissions.map((submission) => ({
        studentId: submission.studentId || '-',
        fullName: getFullName(submission),
        courseDept: [abbreviateCourse(submission.course), resolveDepartmentValue(submission.department, submission.course)]
          .filter((value) => value && value !== '-')
          .join(' / ') || '-',
        submissionDate: formatReportDate(submission.submittedAt),
        labStatus: formatLabStatus(submission),
        physicalExamStatus: formatPhysicalExamStatus(submission),
        issuedCertificates: formatCertificateStatus(submission),
      })),
    [dedupedFilteredSubmissions],
  );

  const friendlyFilters = useMemo(
    () => {
      const friendlyDepartment = departmentFilter === 'all' ? 'All Departments' : departmentFilter;
      const friendlyYear = yearFilter === 'all' ? 'All Years' : (YEAR_LABELS[yearFilter] || `Year ${yearFilter}`);
      const friendlyStatus = statusFilter === 'all' ? 'All Statuses' : (STATUS_LABELS[statusFilter] || statusFilter);
      const friendlyCourse = courseFilter === 'all' ? 'All Courses' : courseFilter;
      const friendlyCondition = conditionFilter === 'all' ? 'All Conditions' : formatConditionLabel(conditionFilter);
      const friendlyCertificate = CERTIFICATE_LABELS[certificateFilter] || certificateFilter;
      const friendlyGender = genderFilter === 'all'
        ? 'All Genders'
        : genderFilter === 'male'
          ? 'Male'
          : genderFilter === 'female'
            ? 'Female'
            : 'Other';
      const friendlyBatch = studentBatchFilter === 'all' ? 'All Batches' : `${studentBatchFilter} Batch`;

      return [
        { label: 'Academic Year', value: `SY ${reportingTermSettings.academicYear || '2026-2027'}` },
        { label: 'Reporting Term', value: reportingTermRange.label },
        { label: 'Department', value: friendlyDepartment },
        { label: 'Year', value: friendlyYear },
        { label: 'Status', value: friendlyStatus },
        { label: 'Course', value: friendlyCourse },
        { label: 'Condition', value: friendlyCondition },
        { label: 'Certificate', value: friendlyCertificate },
        { label: 'Gender', value: friendlyGender },
        { label: 'Student ID Batch', value: friendlyBatch },
        { label: 'Submitted From', value: fromDate || '-' },
        { label: 'Submitted To', value: toDate || '-' },
      ];
    },
    [
      certificateFilter,
      conditionFilter,
      courseFilter,
      departmentFilter,
      fromDate,
      genderFilter,
      reportingTermRange.label,
      reportingTermSettings.academicYear,
      statusFilter,
      studentBatchFilter,
      toDate,
      yearFilter,
    ],
  );

  const certificateRate = summary.total > 0 ? Math.round((summary.withCertificate / summary.total) * 100) : 0;
  const actionNeededCount = summary.pending + summary.inReview + summary.returned;
  const actionNeededRate = summary.total > 0 ? Math.round((actionNeededCount / summary.total) * 100) : 0;

  // ── Print and spreadsheet export ────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  const exportXlsx = () => {
    try {
      const generatedOn = formatReportDateTime();
      const academicYear = `SY ${reportingTermSettings.academicYear || '2026-2027'}`;
      const workbookRows = [
        ['GORDON COLLEGE HEALTH SERVICES UNIT - MEDICAL REPORT'],
        [`Academic Year: ${academicYear}`],
        [`Reporting Term: ${reportingTermRange.label}`],
        [`Generated On: ${generatedOn}`],
        [`Filtered Records: ${reportTableRows.length}`],
        [],
        [
          'Student ID',
          'Full Name',
          'Course/Dept',
          'Submission Date',
          'Lab Status (X-Ray/CBC/Urinalysis)',
          'Physical Exam Status',
          'Issued Certificates',
        ],
        ...reportTableRows.map((row) => [
          row.studentId,
          row.fullName,
          row.courseDept,
          row.submissionDate,
          row.labStatus,
          row.physicalExamStatus,
          row.issuedCertificates,
        ]),
      ];
      const blob = buildXlsxBlob(workbookRows);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${mode}_medical_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Excel report exported');
    } catch (error) {
      console.error('XLSX export error:', error);
      toast.error('Failed to export Excel report');
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-56 sm:h-10 sm:w-80" />
            <Skeleton className="h-5 w-full max-w-md" />
          </div>
          <Skeleton className="h-10 w-full rounded-md sm:w-36" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={`stats-skeleton-${idx}`} className="border-outline-variant/30">
              <CardContent className="px-5 pb-5 pt-5">
                <Skeleton className="mb-3 h-3 w-32" />
                <Skeleton className="h-9 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-outline-variant/30">
          <CardHeader className="pb-0 pt-5 px-5">
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-64" />
          </CardContent>
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card key={`chart-skeleton-${idx}`} className={`border-outline-variant/30 ${idx === 0 ? 'xl:col-span-2' : ''}`}>
              <CardHeader className="pb-2 pt-5 px-5">
                <Skeleton className="h-6 w-44" />
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <Skeleton className="h-56 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 print:space-y-4 print:bg-white print:text-black">
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <PortalPageIntro
        title={`${mode === 'admin' ? 'Admin' : 'Staff'} Reports & Analytics`}
        description="Review student clinical aggregates, print clean summaries, and export structured Excel reports."
        className="mb-8 print:hidden"
      />

      <div className="hidden print:block">
        <div className="text-center">
          <p className="text-base font-bold uppercase text-black">Gordon College Health Services Unit - Medical Report</p>
          <p className="mt-1 text-sm text-black">Academic Year: SY {reportingTermSettings.academicYear || '2026-2027'}</p>
          <p className="text-sm text-black">Generated On: {formatReportDateTime()}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-black">
          {friendlyFilters.slice(2).map((filter) => (
            <p key={filter.label}>
              <span className="font-semibold">{filter.label}:</span> {filter.value}
            </p>
          ))}
        </div>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4 print:gap-2">
        <StatCard
          label="Student Medical Submissions"
          value={summary.total}
          icon={Users}
          accent="text-primary"
          helper={`Pending ${summary.pending} • In Review ${summary.inReview} • Returned ${summary.returned} • Approved ${summary.approved}`}
        />
        <StatCard
          label="Clearances Issued"
          value={clinicalSummary.clearanceIssued}
          icon={ClipboardCheck}
          accent="text-primary"
          helper={`${clinicalSummary.pendingPhysicalExams} pending physical exams`}
          progress={summary.total > 0 ? Math.round((clinicalSummary.clearanceIssued / summary.total) * 100) : 0}
        />
        <StatCard
          label="Medical Certificates Issued"
          value={clinicalSummary.medicalCertificatesIssued}
          icon={Award}
          accent="text-primary"
          helper={`${certificateRate}% certificate coverage`}
          progress={certificateRate}
        />
        <StatCard
          label="Key Clinical Flags"
          value={clinicalSummary.abnormalXray + clinicalSummary.anemiaTrend + clinicalSummary.abnormalUrinalysis}
          icon={Stethoscope}
          accent="text-rose-700"
          helper={`X-Ray ${clinicalSummary.abnormalXray} • Anemia ${clinicalSummary.anemiaTrend} • Urinalysis ${clinicalSummary.abnormalUrinalysis}`}
        />
        <StatCard
          label="Current-Term Records"
          value={currentTermSubmissions.length}
          icon={Activity}
          accent="text-primary"
          helper={reportingTermRange.label}
        />
        <StatCard
          label="Approval Rate"
          value={`${summary.approvalRate}%`}
          icon={TrendingUp}
          accent="text-primary"
          helper={`${summary.approved} approved of ${summary.total || 0}`}
          progress={summary.approvalRate}
        />
        <StatCard
          label="Needs Action"
          value={actionNeededCount}
          icon={Activity}
          accent="text-amber-600"
          helper={`${summary.pending} pending • ${summary.inReview} in review • ${summary.returned} returned`}
          progress={actionNeededRate}
        />
        <StatCard
          label="Physical Exams Pending"
          value={clinicalSummary.pendingPhysicalExams}
          icon={ClipboardCheck}
          accent="text-amber-600"
          helper={`${Math.max(summary.total - clinicalSummary.pendingPhysicalExams, 0)} completed physical exams`}
        />
      </div>

      {/* ── Filters Card ──────────────────────────────────────────────── */}
      <Card className="border-outline-variant/30 print:hidden">
        <CardHeader className="pb-0 pt-5 px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Filters</CardTitle>
              {hasActiveFilters && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Active
                </span>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-outline-variant/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:justify-start sm:border-0 sm:px-0 sm:py-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset all
                </button>
              )}
              <Button onClick={handlePrint} size="sm" variant="outline" className="w-full gap-2 sm:w-auto sm:shrink-0">
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button onClick={exportXlsx} size="sm" className="w-full gap-2 bg-primary text-white hover:bg-primary/90 sm:w-auto sm:shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5 pt-5 space-y-5">

          {/* ── Group 1: Student Info ──────────────────────────────────── */}
          <FilterSection label="Student">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <LabeledSelect label="Department" value={departmentFilter} onValueChange={setDepartmentFilter} placeholder="Department">
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </LabeledSelect>
              <LabeledSelect label="Year Level" value={yearFilter} onValueChange={setYearFilter} placeholder="Year">
                <SelectItem value="all">All Years</SelectItem>
                {Object.entries(YEAR_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </LabeledSelect>
              <LabeledSelect label="Course" value={courseFilter} onValueChange={setCourseFilter} placeholder="Course">
                <SelectItem value="all">All Courses</SelectItem>
                {allCourses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </LabeledSelect>
              <LabeledSelect label="Student ID Batch" value={studentBatchFilter} onValueChange={setStudentBatchFilter} placeholder="Batch">
                <SelectItem value="all">All Batches</SelectItem>
                {studentBatches.map((batch) => <SelectItem key={batch} value={batch}>{batch}</SelectItem>)}
              </LabeledSelect>
            </div>
          </FilterSection>

          <div className="border-t border-outline-variant/20" />

          {/* ── Group 2: Submission Info ───────────────────────────────── */}
          <FilterSection label="Submission">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <LabeledSelect label="Status" value={statusFilter} onValueChange={setStatusFilter} placeholder="Status">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="physical_exam_done">Physical Exam Done</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </LabeledSelect>
              <LabeledSelect label="Certificate" value={certificateFilter} onValueChange={setCertificateFilter} placeholder="Certificate">
                <SelectItem value="all">All Certificates</SelectItem>
                <SelectItem value="issued">Issued Only</SelectItem>
                <SelectItem value="not_issued">Not Issued</SelectItem>
              </LabeledSelect>
              <LabeledSelect label="Medical Condition" value={conditionFilter} onValueChange={setConditionFilter} placeholder="Condition">
                <SelectItem value="all">All Conditions</SelectItem>
                {allConditions.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k.replace(/([A-Z])/g, ' $1').replace(/^./, (m) => m.toUpperCase())}
                  </SelectItem>
                ))}
              </LabeledSelect>
              <LabeledSelect label="Gender" value={genderFilter} onValueChange={setGenderFilter} placeholder="Gender">
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </LabeledSelect>
            </div>
          </FilterSection>

          <div className="border-t border-outline-variant/20" />

          {/* ── Group 3: Date Range ────────────────────────────────────── */}
          <FilterSection label="Date Range">
            <div className="grid max-w-none grid-cols-1 gap-3 sm:max-w-sm sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">From</span>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  min={dateRange.minDate || undefined}
                  max={today}
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">To</span>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  min={dateRange.minDate || undefined}
                  max={today}
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
          </FilterSection>

        </CardContent>
      </Card>

      {/* ── Master Records Table ──────────────────────────────────────── */}
      <Card className="border-outline-variant/30 print:border-0 print:bg-white print:shadow-none">
        <CardHeader className="pb-0 pt-5 px-5 print:px-0 print:pt-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold print:text-sm print:text-black">Filtered Clinical Records</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground print:text-black">
                {reportTableRows.length} student records matched the current report filters.
              </p>
            </div>
            <p className="text-xs text-muted-foreground print:hidden">
              Lab status summarizes X-Ray, CBC, and urinalysis results from the mapped submission record.
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4 print:px-0 print:pb-0">
          <div className="overflow-x-auto rounded-lg border border-outline-variant/40 print:overflow-visible print:rounded-none print:border-black">
            <table className="min-w-[66rem] w-full border-collapse text-left text-sm print:min-w-0 print:text-[10px]">
              <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant print:bg-white print:text-black">
                <tr>
                  {[
                    'Student ID',
                    'Full Name',
                    'Course/Dept',
                    'Submission Date',
                    'Lab Status (X-Ray/CBC/Urinalysis)',
                    'Physical Exam Status',
                    'Issued Certificates',
                  ].map((heading) => (
                    <th key={heading} scope="col" className="border-b border-outline-variant/50 px-3 py-3 font-semibold print:border print:border-black print:px-1.5 print:py-1">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 print:divide-y-0">
                {reportTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground print:border print:border-black print:text-black">
                      No records matched the selected filters.
                    </td>
                  </tr>
                ) : (
                  reportTableRows.map((row) => (
                    <tr key={`${row.studentId}-${row.submissionDate}-${row.fullName}`} className="bg-white/60 print:bg-white">
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-on-surface print:border print:border-black print:px-1.5 print:py-1 print:text-black">{row.studentId}</td>
                      <td className="min-w-48 px-3 py-3 text-on-surface print:border print:border-black print:px-1.5 print:py-1 print:text-black">{row.fullName}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-on-surface-variant print:border print:border-black print:px-1.5 print:py-1 print:text-black">{row.courseDept}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-on-surface-variant print:border print:border-black print:px-1.5 print:py-1 print:text-black">{row.submissionDate}</td>
                      <td className="min-w-72 px-3 py-3 text-on-surface-variant print:border print:border-black print:px-1.5 print:py-1 print:text-black">{row.labStatus}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-on-surface-variant print:border print:border-black print:px-1.5 print:py-1 print:text-black">{row.physicalExamStatus}</td>
                      <td className="min-w-44 px-3 py-3 text-on-surface-variant print:border print:border-black print:px-1.5 print:py-1 print:text-black">{row.issuedCertificates}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Charts ────────────────────────────────────────────────────── */}
      <div className="space-y-4 print:hidden">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
          <Card className="border-outline-variant/30">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="text-base font-semibold">Submission Volume Trend</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Auto-groups by day, week, or month based on the selected date range.</p>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              {submissionsByDate.length === 0 ? (
                <EmptyChartState message="No timeline data available for the selected filters." />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={submissionsByDate} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_GRID} strokeOpacity={0.6} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_TEXT }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: CHART_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTimelineTooltip />} cursor={{ stroke: CHART_GRID, strokeWidth: 1 }} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke={CHART_PRIMARY}
                        strokeWidth={2.5}
                        fill={CHART_PRIMARY_SOFT}
                        fillOpacity={0.18}
                        activeDot={{ r: 5, fill: CHART_PRIMARY, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-outline-variant/30">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="text-base font-semibold">Review Pipeline</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Share of filtered submissions by current status.</p>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              <StatusPipeline items={statusChartData} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(22rem,0.82fr)]">
          <Card className="border-outline-variant/30">
            <CardHeader className="pb-0 pt-5 px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Current-Term Submissions by {submissionBreakdownView === 'department' ? 'Department' : 'Program'}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">Filtered records inside {reportingTermRange.label}.</p>
                </div>
                <div className="w-full sm:w-44">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Group by</p>
                  <Select value={submissionBreakdownView} onValueChange={(value) => setSubmissionBreakdownView(value as SubmissionBreakdownView)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose chart view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="department">Department</SelectItem>
                      <SelectItem value="program">Program</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              {submissionBreakdownView === 'program' && submissionBreakdownData.length === 0 ? (
                <EmptyChartState message="No current-term program submissions are available for the selected filters." />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={submissionBreakdownData} margin={{ top: 18, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_GRID} strokeOpacity={0.6} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: CHART_TEXT }} tickLine={false} axisLine={false} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: CHART_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, (dataMax: number) => Math.max(1, Number(dataMax) || 0)]} />
                      <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(0, 109, 60, 0.05)' }} />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={52}>
                        {submissionBreakdownData.map((entry) => (
                          <Cell key={entry.label} fill={entry.fill} />
                        ))}
                        <LabelList dataKey="count" content={<DepartmentBarValueLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-outline-variant/30">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="text-base font-semibold">Year-Level Distribution</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Student record mix across academic levels.</p>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              {summary.total === 0 ? (
                <EmptyChartState message="No year-level data available for the selected filters." />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearLevelData} layout="vertical" margin={{ top: 4, right: 18, left: 12, bottom: 4 }}>
                      <CartesianGrid stroke={CHART_GRID} strokeOpacity={0.55} horizontal={false} />
                      <XAxis type="number" hide domain={[0, (dataMax: number) => Math.max(1, Number(dataMax) || 0)]} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: CHART_TEXT }} tickLine={false} axisLine={false} width={72} />
                      <Tooltip content={<CustomDonutTooltip />} cursor={{ fill: 'rgba(0, 109, 60, 0.05)' }} />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                        {yearLevelData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                        <LabelList dataKey="value" position="right" fill={CHART_TEXT} fontSize={12} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="border-outline-variant/30">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="text-base font-semibold">Certificate Coverage</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Issued certificates against filtered submissions.</p>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              {certificateChartData.length === 0 ? (
                <EmptyChartState message="No certificate data available for the selected filters." />
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={certificateChartData} cx="50%" cy="48%" innerRadius="58%" outerRadius="78%" dataKey="value" paddingAngle={2} strokeWidth={0}>
                        {certificateChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomDonutTooltip />} />
                      <Legend iconType="circle" iconSize={9} formatter={(value) => <span style={{ fontSize: 12, color: CHART_TEXT }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-outline-variant/30">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="text-base font-semibold">Gender Mix</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Filtered submissions by recorded sex/gender.</p>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              {genderChartData.length === 0 ? (
                <EmptyChartState message="No gender data available for the selected filters." />
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={genderChartData} cx="50%" cy="48%" innerRadius="50%" outerRadius="76%" dataKey="value" paddingAngle={3} strokeWidth={0}>
                        {genderChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomDonutTooltip />} />
                      <Legend iconType="circle" iconSize={9} formatter={(value) => <span style={{ fontSize: 12, color: CHART_TEXT }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-outline-variant/30">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="text-base font-semibold">Top Programs</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Highest-volume programs in the filtered set.</p>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              <ProgressList items={topPrograms} emptyMessage="No program data available for the selected filters." />
            </CardContent>
          </Card>
        </div>

        <Card className="border-outline-variant/30">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-base font-semibold">Medical History Prevalence</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Most common declared conditions among filtered submissions.</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            <ProgressList items={conditionPrevalenceData} emptyMessage="No declared medical-history conditions are present in the selected filters." />
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
