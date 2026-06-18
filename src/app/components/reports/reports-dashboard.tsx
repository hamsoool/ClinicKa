import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PortalPageIntro from '../portal-page-intro';
import ListPagination from '../list-pagination';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import {
  Activity,
  ClipboardCheck,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Search,
  SlidersHorizontal,
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
  LineChart,
  Line,
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

const STATUS_COLORS: Record<string, string> = {
  Approved: '#3b6d11',
  Pending: '#ba7517',
  'In Review': '#2f6fa3',
  Returned: '#a32d2d',
  'Exam Done': '#185fa5',
};
const DEPARTMENT_COLORS: Record<string, string> = {
  CCS: '#FF7F3F',
  CBA: '#FBDF07',
  CEAS: '#406093',
  CHTM: '#FCB7C7',
  CAHS: '#DE3E3E',
};
const GENDER_COLORS: Record<string, string> = {
  male: '#9ED3DC',
  female: '#FCB7C7',
  other: '#85f6ae',
  unspecified: '#d8e4d7',
};
const SERIES_COLORS = ['#006d3c', '#12b76a', '#3d8f66', '#85cfa4', '#5d7c68', '#e5a93a', '#d26d6d', '#6d7b6e'];
const CHART_PRIMARY = '#006d3c';
const CHART_PRIMARY_SOFT = '#12b76a';
const CHART_GREEN_PALE = '#85f6ae';
const CHART_GRID = '#d8e4d7';
const CHART_TEXT = '#3d4a3f';


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

type FunnelDatum = {
  stage: string;
  count: number;
  fill: string;
};
type MonthlyRateDatum = {
  key: string;
  label: string;
  total: number;
  cleared: number;
  rate: number;
};
type NamedCountDatum = {
  name: string;
  value: number;
  fill: string;
  percent?: number;
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
type ReportTableRow = {
  studentId: string;
  fullName: string;
  yearLevel: string;
  age: string;
  gender: string;
  deptProgram: string;
  submissionDate: string;
  clearanceStatus: string;
  issuanceDate: string;
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

  const label = settings.academicYear;

  return {
    label,
    startMs: Date.UTC(startYear, 6, 1),
    endMs: Date.UTC(endYear, 6, 1),
  };
}

function formatConditionLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (match) => match.toUpperCase());
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
    <col min="3" max="3" width="10" customWidth="1"/>
    <col min="4" max="4" width="14" customWidth="1"/>
    <col min="5" max="5" width="20" customWidth="1"/>
    <col min="6" max="6" width="14" customWidth="1"/>
    <col min="7" max="7" width="18" customWidth="1"/>
    <col min="8" max="8" width="18" customWidth="1"/>
    <col min="9" max="9" width="18" customWidth="1"/>
  </cols>
  <sheetData>${rowXml}</sheetData>
  <mergeCells count="1"><mergeCell ref="A1:I1"/></mergeCells>
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

  // Resolve dynamic background color based on accent text class
  const getIconBgClass = (accentClass: string) => {
    if (accentClass.includes('text-rose-700')) return 'bg-rose-100';
    if (accentClass.includes('text-amber-600')) return 'bg-amber-100';
    return 'bg-primary/10';
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden border-outline-variant/30 print:break-inside-avoid print:border print:border-black print:bg-white print:shadow-none">
      <CardContent className="flex flex-col flex-1 p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-[0.14em] sm:tracking-wider mb-1 leading-tight line-clamp-2 min-h-[1.5rem] sm:min-h-0 print:text-black">
              {label}
            </p>
            <p className={`text-lg sm:text-3xl font-bold leading-none print:text-black ${accent}`}>{value}</p>
            {helper && (
              <p className="mt-2 text-[11px] sm:text-xs leading-normal sm:leading-5 text-on-surface-variant print:text-black">
                {helper}
              </p>
            )}
          </div>
          <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center print:bg-white ${getIconBgClass(accent)}`}>
            <Icon className={`w-4.5 h-4.5 print:text-black ${accent}`} strokeWidth={2} />
          </div>
        </div>
        {normalizedProgress !== null && (
          <div className="mt-auto pt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high print:hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${normalizedProgress}%` }} />
            </div>
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
function CustomDemographicTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[18px] border border-outline-variant/40 bg-white px-3.5 py-2 text-sm shadow-sm">
      <p className="font-semibold text-on-surface">{payload[0].name}</p>
      <p className="text-xs text-muted-foreground">{payload[0].value} students</p>
    </div>
  );
}

function CustomApprovalRateTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[18px] border border-outline-variant/40 bg-white px-3.5 py-2.5 text-sm shadow-sm min-w-48 space-y-2">
      <p className="font-semibold text-on-surface border-b pb-1 border-outline-variant/30">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => {
          const rawGroups = entry.payload.rawGroups || {};
          const groupInfo = rawGroups[entry.name] || { total: 0, cleared: 0 };
          return (
            <div key={`tooltip-item-${index}`} className="flex flex-col">
              <div className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
                  <span className="text-on-surface-variant font-medium">{entry.name}:</span>
                </div>
                <span className="font-bold text-on-surface">{entry.value}%</span>
              </div>
              {groupInfo.total > 0 && (
                <p className="text-[10px] text-muted-foreground pl-3.5 mt-0.5">
                  {groupInfo.cleared} approved of {groupInfo.total} submissions
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-[18px] border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-on-surface-variant">
      {message}
    </div>
  );
}




function getSubmissionGroupValue(sub: ReportSubmission, groupBy: 'overall' | 'year' | 'department' | 'gender'): string {
  if (groupBy === 'overall') return 'Overall';
  if (groupBy === 'year') {
    const year = String(sub.year || '');
    return YEAR_LABELS[year] || (year ? `Year ${year}` : 'Unknown');
  }
  if (groupBy === 'department') {
    return resolveDepartmentValue(sub.department, sub.course) || 'Unknown';
  }
  if (groupBy === 'gender') {
    const gender = String(sub.gender || sub.sex || '').trim().toLowerCase();
    return gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : 'Unknown';
  }
  return 'Overall';
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
  const [genderFilter, setGenderFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [studentBreakdownView, setStudentBreakdownView] = useState<'year' | 'gender' | 'department' | 'program'>('year');
  const [approvalRateGroupBy, setApprovalRateGroupBy] = useState<'overall' | 'year' | 'department' | 'gender'>('overall');
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



  const filteredSubmissions = useMemo(
    () =>
      normalizedSubmissions.filter((sub) => {
        if (departmentFilter !== 'all' && !(sub.department === departmentFilter || sub.course?.includes(departmentFilter))) return false;
        if (yearFilter !== 'all' && String(sub.year) !== yearFilter) return false;
        if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
        if (courseFilter !== 'all' && normalizeCourseValue(sub.course) !== normalizeCourseValue(courseFilter)) return false;
        if (genderFilter !== 'all') {
          const gender = String(sub.gender || sub.sex || '').trim().toLowerCase();
          if (gender !== genderFilter) return false;
        }
        if (searchQuery.trim() !== '') {
          const query = searchQuery.trim().toLowerCase();
          const studentId = String(sub.studentId || '').toLowerCase();
          const firstName = String(sub.firstName || '').toLowerCase();
          const lastName = String(sub.lastName || '').toLowerCase();
          const middleInitial = String(sub.middleInitial || '').toLowerCase();
          const fullName = `${lastName}, ${firstName} ${middleInitial}`.toLowerCase();
          const fullNameSimple = `${firstName} ${lastName}`.toLowerCase();

          if (
            !studentId.includes(query) &&
            !firstName.includes(query) &&
            !lastName.includes(query) &&
            !fullName.includes(query) &&
            !fullNameSimple.includes(query)
          ) {
            return false;
          }
        }
        const subDate = sub.submittedAt ? new Date(sub.submittedAt) : null;
        if (fromDate && subDate && subDate < new Date(`${fromDate}T00:00:00`)) return false;
        if (toDate && subDate && subDate > new Date(`${toDate}T23:59:59`)) return false;
        return true;
      }),
    [normalizedSubmissions, departmentFilter, yearFilter, statusFilter, courseFilter, genderFilter, searchQuery, fromDate, toDate],
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

  const dedupedAllSubmissions = useMemo(() => {
    const seen = new Set<string>();
    const out: ReportSubmission[] = [];
    for (const s of normalizedSubmissions) {
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
  }, [normalizedSubmissions]);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [
    departmentFilter,
    yearFilter,
    statusFilter,
    courseFilter,
    genderFilter,
    searchQuery,
    fromDate,
    toDate,
  ]);

  const hasActiveFilters =
    departmentFilter !== 'all' || yearFilter !== 'all' || statusFilter !== 'all' ||
    courseFilter !== 'all' || genderFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    (fromDate !== '' && fromDate !== dateRange.minDate) ||
    (toDate !== '' && toDate !== dateRange.maxDate);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (departmentFilter !== 'all') count++;
    if (yearFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (courseFilter !== 'all') count++;
    if (genderFilter !== 'all') count++;
    if (searchQuery.trim() !== '') count++;
    if (fromDate !== '' && fromDate !== dateRange.minDate) count++;
    if (toDate !== '' && toDate !== dateRange.maxDate) count++;
    return count;
  }, [
    departmentFilter,
    yearFilter,
    statusFilter,
    courseFilter,
    genderFilter,
    searchQuery,
    fromDate,
    toDate,
    dateRange.minDate,
    dateRange.maxDate
  ]);

  const resetFilters = () => {
    setDepartmentFilter('all');
    setYearFilter('all');
    setStatusFilter('all');
    setCourseFilter('all');
    setGenderFilter('all');
    setSearchQuery('');
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



  const studentBreakdownData = useMemo(() => {
    const counts: Record<string, number> = {};

    dedupedFilteredSubmissions.forEach((sub) => {
      let key = '';
      if (studentBreakdownView === 'year') {
        const year = String(sub.year || '');
        key = YEAR_LABELS[year] || (year ? `Year ${year}` : 'Unknown');
      } else if (studentBreakdownView === 'gender') {
        const gender = String(sub.gender || sub.sex || '').trim().toLowerCase();
        key = gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : 'Unknown';
      } else if (studentBreakdownView === 'department') {
        key = resolveDepartmentValue(sub.department, sub.course) || 'Unknown';
      } else if (studentBreakdownView === 'program') {
        key = abbreviateCourse(sub.course) || 'Unknown';
      }

      counts[key] = (counts[key] || 0) + 1;
    });

    const sortedData = Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return sortedData.map((entry, index) => {
      let fill = SERIES_COLORS[index % SERIES_COLORS.length];

      if (studentBreakdownView === 'gender') {
        const genKey = entry.name.toLowerCase();
        if (GENDER_COLORS[genKey]) fill = GENDER_COLORS[genKey];
      } else if (studentBreakdownView === 'department') {
        const deptKey = entry.name.toUpperCase();
        if (DEPARTMENT_COLORS[deptKey]) fill = DEPARTMENT_COLORS[deptKey];
      } else if (studentBreakdownView === 'program') {
        const matchingSub = dedupedFilteredSubmissions.find(
          (sub) => abbreviateCourse(sub.course) === entry.name
        );
        if (matchingSub) {
          const dept = resolveDepartmentValue(matchingSub.department, matchingSub.course);
          if (DEPARTMENT_COLORS[dept]) fill = DEPARTMENT_COLORS[dept];
        }
      }

      return {
        ...entry,
        fill,
      };
    });
  }, [dedupedFilteredSubmissions, studentBreakdownView]);

  const monthlyRateData = useMemo<any[]>(() => {
    const datedSubmissions = dedupedFilteredSubmissions
      .map((s) => ({ submission: s, date: s.submittedAt ? new Date(s.submittedAt) : null }))
      .filter((item): item is { submission: ReportSubmission; date: Date } =>
        item.date instanceof Date && Number.isFinite(item.date.getTime()),
      );

    if (!datedSubmissions.length) return [];

    const buckets = new Map<string, {
      key: string;
      label: string;
      groupData: Map<string, { total: number; cleared: number }>;
    }>();

    datedSubmissions.forEach(({ submission, date }) => {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      let existing = buckets.get(monthKey);
      if (!existing) {
        existing = { key: monthKey, label: monthLabel, groupData: new Map() };
        buckets.set(monthKey, existing);
      }

      const groupVal = getSubmissionGroupValue(submission, approvalRateGroupBy);
      let gData = existing.groupData.get(groupVal);
      if (!gData) {
        gData = { total: 0, cleared: 0 };
        existing.groupData.set(groupVal, gData);
      }
      gData.total += 1;
      if (submission.status === 'approved') {
        gData.cleared += 1;
      }
    });

    const sortedBuckets = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));

    const allGroupNames = new Set<string>();
    datedSubmissions.forEach(({ submission }) => {
      allGroupNames.add(getSubmissionGroupValue(submission, approvalRateGroupBy));
    });
    const groupsArray = [...allGroupNames];

    const result = sortedBuckets.map((b) => {
      const row: Record<string, any> = {
        key: b.key,
        label: b.label,
        rawGroups: {},
      };

      groupsArray.forEach((gName) => {
        const gData = b.groupData.get(gName) || { total: 0, cleared: 0 };
        row[gName] = gData.total > 0 ? Math.round((gData.cleared / gData.total) * 100) : 0;
        row.rawGroups[gName] = gData;
      });

      return row;
    });

    if (result.length > 0) {
      const [yearStr, monthStr] = result[0].key.split('-');
      const firstDate = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      firstDate.setMonth(firstDate.getMonth() - 1);
      const prevKey = `${firstDate.getFullYear()}-${String(firstDate.getMonth() + 1).padStart(2, '0')}`;
      const prevLabel = firstDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      const baselineRow: Record<string, any> = {
        key: prevKey,
        label: prevLabel,
        rawGroups: {},
      };

      groupsArray.forEach((gName) => {
        baselineRow[gName] = 0;
        baselineRow.rawGroups[gName] = { total: 0, cleared: 0 };
      });

      result.unshift(baselineRow);
    }

    return result;
  }, [dedupedFilteredSubmissions, approvalRateGroupBy]);

  const approvalRateSeries = useMemo(() => {
    const groups = new Set<string>();
    dedupedFilteredSubmissions.forEach((sub) => {
      groups.add(getSubmissionGroupValue(sub, approvalRateGroupBy));
    });

    // Sort groups so they appear in a predictable order:
    // e.g., 1st Year -> 2nd Year -> 3rd Year -> 4th Year, or alphabetical for departments/gender
    const sortedGroups = [...groups].sort((a, b) => {
      if (approvalRateGroupBy === 'year') {
        const order: Record<string, number> = { '1st Year': 1, '2nd Year': 2, '3rd Year': 3, '4th Year': 4 };
        return (order[a] || 99) - (order[b] || 99);
      }
      return a.localeCompare(b);
    });

    return sortedGroups.map((name, index) => {
      let color = SERIES_COLORS[index % SERIES_COLORS.length];

      if (approvalRateGroupBy === 'overall') {
        color = CHART_PRIMARY;
      } else if (approvalRateGroupBy === 'department') {
        const deptKey = name.toUpperCase();
        if (DEPARTMENT_COLORS[deptKey]) color = DEPARTMENT_COLORS[deptKey];
      } else if (approvalRateGroupBy === 'gender') {
        const genKey = name.toLowerCase();
        if (GENDER_COLORS[genKey]) color = GENDER_COLORS[genKey];
      } else if (approvalRateGroupBy === 'year') {
        const yearColors: Record<string, string> = {
          '1st Year': '#006d3c',
          '2nd Year': '#12b76a',
          '3rd Year': '#3d8f66',
          '4th Year': '#85cfa4',
        };
        if (yearColors[name]) color = yearColors[name];
      }

      return {
        name,
        color,
      };
    });
  }, [dedupedFilteredSubmissions, approvalRateGroupBy]);



  const reportTableRows = useMemo<ReportTableRow[]>(
    () =>
      dedupedFilteredSubmissions.map((submission) => {
        const rawGender = submission.gender || submission.sex || '-';
        const gender = rawGender !== '-' ? rawGender.charAt(0).toUpperCase() + rawGender.slice(1).toLowerCase() : '-';

        return {
          studentId: submission.studentId || '-',
          fullName: getFullName(submission),
          yearLevel: submission.year ? (YEAR_LABELS[String(submission.year)] || `Year ${submission.year}`) : '-',
          age: submission.age ? String(submission.age) : '-',
          gender,
          deptProgram: [resolveDepartmentValue(submission.department, submission.course), abbreviateCourse(submission.course)]
            .filter((value) => value && value !== '-')
            .join(' / ') || '-',
          submissionDate: formatReportDate(submission.submittedAt),
          clearanceStatus: submission.status === 'approved' ? 'Cleared' : submission.status === 'returned' ? 'Returned' : 'Pending',
          issuanceDate: submission.clearanceInfo?.issuedDate ? formatReportDate(submission.clearanceInfo.issuedDate) : 'null',
        };
      }),
    [dedupedFilteredSubmissions],
  );

  const totalPages = Math.max(1, Math.ceil(reportTableRows.length / 10));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const friendlyFilters = useMemo(
    () => {
      const friendlyDepartment = departmentFilter === 'all' ? 'All Departments' : departmentFilter;
      const friendlyYear = yearFilter === 'all' ? 'All Years' : (YEAR_LABELS[yearFilter] || `Year ${yearFilter}`);
      const friendlyStatus = statusFilter === 'all' ? 'All Statuses' : (STATUS_LABELS[statusFilter] || statusFilter);
      const friendlyCourse = courseFilter === 'all' ? 'All Programs' : courseFilter;
      const friendlyGender = genderFilter === 'all'
        ? 'All Genders'
        : genderFilter === 'male'
          ? 'Male'
          : genderFilter === 'female'
            ? 'Female'
            : 'Other';
      const friendlySearch = searchQuery.trim() || 'All';

      return [
        { label: 'Academic Year', value: `SY ${reportingTermSettings.academicYear || '2026-2027'}` },
        { label: 'Reporting Term', value: reportingTermRange.label },
        { label: 'Department', value: friendlyDepartment },
        { label: 'Year', value: friendlyYear },
        { label: 'Clearance Status', value: friendlyStatus },
        { label: 'Program', value: friendlyCourse },
        { label: 'Gender', value: friendlyGender },
        { label: 'Search Query', value: friendlySearch },
        { label: 'Submitted From', value: fromDate || '-' },
        { label: 'Submitted To', value: toDate || '-' },
      ];
    },
    [
      departmentFilter,
      yearFilter,
      statusFilter,
      courseFilter,
      genderFilter,
      searchQuery,
      fromDate,
      toDate,
      reportingTermRange.label,
      reportingTermSettings.academicYear,
    ],
  );

  const activeFiltersString = useMemo(() => {
    const list: string[] = [];
    if (departmentFilter !== 'all') list.push(`Dept: ${departmentFilter}`);
    if (yearFilter !== 'all') list.push(`Year: ${YEAR_LABELS[yearFilter] || yearFilter}`);
    if (statusFilter !== 'all') list.push(`Status: ${STATUS_LABELS[statusFilter] || statusFilter}`);
    if (courseFilter !== 'all') list.push(`Program: ${courseFilter}`);
    if (genderFilter !== 'all') {
      const gLabel = genderFilter === 'male' ? 'Male' : genderFilter === 'female' ? 'Female' : 'Other';
      list.push(`Gender: ${gLabel}`);
    }
    if (searchQuery.trim()) list.push(`Search: "${searchQuery.trim()}"`);
    if (fromDate) list.push(`From: ${fromDate}`);
    if (toDate) list.push(`To: ${toDate}`);

    return list.join(' • ');
  }, [departmentFilter, yearFilter, statusFilter, courseFilter, genderFilter, searchQuery, fromDate, toDate]);

  const certificateRate = summary.total > 0 ? Math.round((summary.withCertificate / summary.total) * 100) : 0;
  const actionNeededCount = summary.pending + summary.inReview + summary.returned;
  const actionNeededRate = summary.total > 0 ? Math.round((actionNeededCount / summary.total) * 100) : 0;

  const globalSummary = useMemo(() => {
    const total = dedupedAllSubmissions.length;
    const approved = dedupedAllSubmissions.filter((s) => s.status === 'approved').length;
    const pending = dedupedAllSubmissions.filter((s) => s.status === 'pending').length;
    const inReview = dedupedAllSubmissions.filter((s) => s.status === 'in_review').length;
    const returned = dedupedAllSubmissions.filter((s) => s.status === 'returned').length;
    const withCertificate = dedupedAllSubmissions.filter((s) => Boolean(s.clearanceInfo?.issuedDate)).length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    return {
      total,
      approved,
      pending,
      inReview,
      returned,
      withCertificate,
      approvalRate,
    };
  }, [dedupedAllSubmissions]);

  const globalActionNeededCount = globalSummary.pending + globalSummary.inReview + globalSummary.returned;
  const globalActionNeededRate = globalSummary.total > 0 ? Math.round((globalActionNeededCount / globalSummary.total) * 100) : 0;

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
          'Age',
          'Gender',
          'Dept / Program',
          'Year Level',
          'Submission Date',
          'Clearance Status',
          'Issuance Date',
        ],
        ...reportTableRows.map((row) => [
          row.studentId,
          row.fullName,
          row.age,
          row.gender,
          row.deptProgram,
          row.yearLevel,
          row.submissionDate,
          row.clearanceStatus,
          row.issuanceDate,
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
    <div className="mx-auto w-full min-w-0 max-w-[100rem] space-y-5 print:space-y-4 print:bg-white print:text-black print:max-w-none">
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <PortalPageIntro
        title={`${mode === 'admin' ? 'Admin' : 'Staff'} Reports & Analytics`}
        description="Review student clinical aggregates, print clean summaries, and export structured Excel reports."
        className="mb-8 print:hidden"
      />

      {/* ── Official Print Header (Gordon College Letterhead) ── */}
      <div className="hidden print:block mb-5 font-sans">
        <div className="flex items-center justify-between">
          <img src="/gordon-college-logo.png" alt="Gordon College Logo" className="w-16 h-16 object-contain" />
          <div className="text-center flex-1 mx-4">
            <h1 className="text-[18.5px] font-black tracking-wider uppercase text-black leading-none">
              GORDON COLLEGE
            </h1>
            <p className="text-[11px] font-medium leading-relaxed text-black mt-1">
              Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City
            </p>
            <p className="text-[11px] font-medium leading-relaxed text-black">
              Tel. No.: (047) 222-2089 / (047) 603-7175
            </p>
            <p className="text-[11px] font-medium leading-relaxed text-black">
              Website: www.gordoncollege.edu.ph
            </p>
            <div className="mt-1.5 text-[11.5px] font-bold uppercase tracking-wider text-black leading-none">
              Health Services Unit
            </div>
            <div className="mt-4 text-[11px] font-bold text-black">
              SY {reportingTermSettings.academicYear || '2026-2027'}
            </div>
          </div>
          <img src="/gordonhsc.png" alt="Health Services Unit Logo" className="w-16 h-16 object-contain" />
        </div>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-3 xl:grid-cols-4 print:hidden">
        <StatCard
          label="Total Submissions"
          value={globalSummary.total}
          icon={Users}
          accent="text-primary"
          helper="Total student submissions received"
          progress={100}
        />
        <StatCard
          label="Cleared Students"  
          value={globalSummary.approved}
          icon={ClipboardCheck}
          accent="text-primary"
          helper="Total students officially cleared and approved"
          progress={globalSummary.total > 0 ? Math.round((globalSummary.approved / globalSummary.total) * 100) : 0}
        />
        <StatCard
          label="Approval Rate"
          value={`${globalSummary.approvalRate}%`}
          icon={TrendingUp}
          accent="text-primary"
          helper="Overall approval rate."
          progress={globalSummary.approvalRate}
        />
        <StatCard
          label="Needs Action"
          value={globalActionNeededCount}
          icon={Activity}
          accent="text-amber-600"
          helper={`${globalSummary.pending} pending • ${globalSummary.inReview} in review • ${globalSummary.returned} returned`}
          progress={globalActionNeededRate}
        />
      </div>

      {/* ── Clinical Records Card ─────────────────────────────────────── */}
      <Card className="border-outline-variant/30 print:border-0 print:bg-white print:shadow-none">
        <CardHeader className="pb-0 pt-5 px-5 print:hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-3">
              <div>
                <CardTitle className="text-base font-semibold print:text-sm print:text-black">Clinical Records</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground print:text-black">
                  {reportTableRows.length} student records matched the current report filters.
                </p>
              </div>
              <div className="relative w-60 sm:w-64 print:hidden mt-[30px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name or student ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full pl-9 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 print:hidden">

              {/* Reset all shortcut if active filters exist */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary font-medium mr-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset all
                </button>
              )}
              {/* Consolidated Popover Filters Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 sm:gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                    <span className="hidden sm:inline">Filters</span>
                    {activeFiltersCount > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-white">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[680px] max-w-[90vw] p-5 space-y-5 shadow-lg border border-outline-variant/50 bg-white z-50">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-semibold text-sm">Filter Options</h3>
                    {hasActiveFilters && (
                      <button
                        onClick={resetFilters}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary font-medium"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset all
                      </button>
                    )}
                  </div>

                  {/* Group 1: Student Info */}
                  <FilterSection label="Student">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <LabeledSelect label="Gender" value={genderFilter} onValueChange={setGenderFilter} placeholder="Gender">
                        <SelectItem value="all">All Genders</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </LabeledSelect>
                      <LabeledSelect label="Year Level" value={yearFilter} onValueChange={setYearFilter} placeholder="Year">
                        <SelectItem value="all">All Years</SelectItem>
                        {Object.entries(YEAR_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </LabeledSelect>
                    </div>
                  </FilterSection>

                  <div className="border-t border-outline-variant/20" />

                  {/* Group 2: Academic & Status */}
                  <FilterSection label="Academic & Status">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <LabeledSelect label="Department" value={departmentFilter} onValueChange={setDepartmentFilter} placeholder="Department">
                        <SelectItem value="all">All Departments</SelectItem>
                        {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </LabeledSelect>
                      <LabeledSelect label="Program" value={courseFilter} onValueChange={setCourseFilter} placeholder="Program">
                        <SelectItem value="all">All Programs</SelectItem>
                        {allCourses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </LabeledSelect>
                      <LabeledSelect label="Clearance Status" value={statusFilter} onValueChange={setStatusFilter} placeholder="Clearance Status">
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="physical_exam_done">Physical Exam Done</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="returned">Returned</SelectItem>
                      </LabeledSelect>
                    </div>
                  </FilterSection>

                  <div className="border-t border-outline-variant/20" />

                  {/* Group 3: Date Range */}
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
                </PopoverContent>
              </Popover>

              <Button onClick={handlePrint} size="sm" variant="outline" className="gap-1.5 sm:gap-2">
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print</span>
              </Button>
              <Button onClick={exportXlsx} size="sm" className="gap-1.5 sm:gap-2 bg-primary text-white hover:bg-primary/90">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Export Excel</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-1 print:px-0 print:pb-0">
          <div className="hidden print:block mb-4 print:-mt-[3.5px]">
            <h2 className="text-[25px] font-bold text-left text-black leading-none">
              Summary of Submitted Records
            </h2>
          </div>
          <div className="overflow-x-auto rounded-lg border border-outline-variant/40 print:overflow-visible print:rounded-none print:border-[1.5px] print:border-black/70">
            <table className="min-w-[66rem] w-full border-collapse text-left text-sm print:min-w-0 print:text-[8.5px] print:text-center">
              <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant print:bg-white print:text-black print:text-[8px]">
                <tr>
                  {[
                    'Student ID',
                    'Full Name',
                    'Age',
                    'Gender',
                    'Dept / Program',
                    'Year Level',
                    'Submission Date',
                    'Clearance Status',
                    'Issuance Date',
                  ].map((heading) => (
                    <th key={heading} scope="col" className="border-b border-outline-variant/50 px-3 py-3 font-semibold print:border-[1.5px] print:border-black/70 print:px-1 print:py-1">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 print:divide-y-0">
                {reportTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground print:border-[1.5px] print:border-black/70 print:text-black">
                      No records matched the selected filters.
                    </td>
                  </tr>
                ) : (
                  <>
                    {reportTableRows.map((row, index) => {
                      const isPaged = index >= (currentPage - 1) * 10 && index < currentPage * 10;
                      return (
                        <tr
                          key={`${row.studentId}-${row.submissionDate}-${row.fullName}`}
                          className={`bg-white/60 print:bg-white ${isPaged ? '' : 'hidden print:table-row'}`}
                        >
                          <td className="whitespace-nowrap px-3 py-3 font-medium text-on-surface print:border-[1.5px] print:border-black/70 print:px-1 print:py-1 print:text-black">{row.studentId}</td>
                          <td className="min-w-48 px-3 py-3 text-on-surface print:border-[1.5px] print:border-black/70 print:px-1 print:py-1 print:text-black print:min-w-0">{row.fullName}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-on-surface-variant print:border-[1.5px] print:border-black/70 print:px-1 print:py-1 print:text-black">{row.age}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-on-surface-variant print:border-[1.5px] print:border-black/70 print:px-1 print:py-1 print:text-black">{row.gender}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-on-surface-variant print:border-[1.5px] print:border-black/70 print:px-1 print:py-1 print:text-black">{row.deptProgram}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-on-surface-variant print:border-[1.5px] print:border-black/70 print:px-1 print:py-1 print:text-black">{row.yearLevel}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-on-surface-variant print:border-[1.5px] print:border-black/70 print:px-1 print:py-1 print:text-black">{row.submissionDate}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-on-surface-variant print:border-[1.5px] print:border-black/70 print:px-1 print:py-1 print:text-black">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${row.clearanceStatus === 'Cleared' ? 'bg-primary/10 text-primary' :
                              row.clearanceStatus === 'Returned' ? 'bg-rose-100 text-rose-700' :
                                'bg-amber-100 text-amber-700'
                              } print:bg-transparent print:text-black print:px-0 print:py-0 print:font-normal print:text-[8.5px]`}>
                              {row.clearanceStatus}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-on-surface-variant print:border-[1.5px] print:border-black/70 print:px-1 print:py-1 print:text-black">{row.issuanceDate}</td>
                        </tr>
                      );
                    })}
                    <tr className="hidden print:table-row bg-white/80 font-bold text-on-surface print:bg-white print:text-black print:font-bold">
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-on-surface print:border-[1.5px] print:border-black/70 print:px-1 print:py-1 print:text-black print:font-bold">Total</td>
                      <td className="px-3 py-3 print:border-[1.5px] print:border-black/70 print:px-1 print:py-1"></td>
                      <td className="px-3 py-3 print:border-[1.5px] print:border-black/70 print:px-1 print:py-1"></td>
                      <td className="px-3 py-3 print:border-[1.5px] print:border-black/70 print:px-1 print:py-1"></td>
                      <td className="px-3 py-3 print:border-[1.5px] print:border-black/70 print:px-1 print:py-1"></td>
                      <td className="px-3 py-3 print:border-[1.5px] print:border-black/70 print:px-1 print:py-1"></td>
                      <td className="px-3 py-3 print:border-[1.5px] print:border-black/70 print:px-1 print:py-1"></td>
                      <td className="px-3 py-3 print:border-[1.5px] print:border-black/70 print:px-1 print:py-1"></td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-on-surface print:border-[1.5px] print:border-black/70 print:px-1 print:py-1 print:text-black print:font-bold">{reportTableRows.length}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <div className="print:hidden">
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={reportTableRows.length}
              pageSize={10}
              pageSizeOptions={[10]}
              itemLabel="records"
              onPageChange={setCurrentPage}
              onPageSizeChange={() => { }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Clinical Analytics ──────────────────────────────────────── */}
      <div className="space-y-4 print:hidden">
        {/* Row 1: Student Demographics & Approval Rate Trend */}
        <div className="grid gap-4 xl:grid-cols-2">
          {/* Card 1: Student Demographics Breakdown */}
          <Card className="border-outline-variant/30">
            <CardHeader className="pb-0 pt-5 px-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Student Demographics Breakdown</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Total count of students matching the current report filters, grouped by selection.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Group by:</span>
                <Select value={studentBreakdownView} onValueChange={(v: any) => setStudentBreakdownView(v)}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="year">Year Level</SelectItem>
                    <SelectItem value="gender">Gender</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="program">Program</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              {studentBreakdownData.length === 0 ? (
                <EmptyChartState message="No demographic data available for the selected filters." />
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={studentBreakdownData} margin={{ top: 18, right: 12, left: -14, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_GRID} strokeOpacity={0.6} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_TEXT }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: CHART_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomDemographicTooltip />} cursor={{ fill: 'rgba(0, 109, 60, 0.04)' }} />
                      <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {studentBreakdownData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                        <LabelList dataKey="count" position="top" fill={CHART_TEXT} fontSize={11} fontWeight={600} offset={8} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Clearance Approval Rate Line Graph */}
          <Card className="border-outline-variant/30">
            <CardHeader className="pb-0 pt-5 px-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Clearance Approval Rate Trend</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Monthly percentage trend of student submissions approved and cleared.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Group by:</span>
                <Select value={approvalRateGroupBy} onValueChange={(v: any) => setApprovalRateGroupBy(v)}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overall">Overall</SelectItem>
                    <SelectItem value="year">Year Level</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="gender">Gender</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              {monthlyRateData.length === 0 ? (
                <EmptyChartState message="No monthly rate data available for the selected filters." />
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyRateData} margin={{ top: 18, right: 24, left: -14, bottom: 0 }}>
                      <defs>
                        {approvalRateSeries.map((series) => (
                          <linearGradient
                            key={series.name}
                            id={`approval-rate-${series.name.replace(/\s+/g, '-')}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="5%" stopColor={series.color} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={series.color} stopOpacity={0.02} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid stroke={CHART_GRID} strokeOpacity={0.6} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_TEXT }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: CHART_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 100]} unit="%" />
                      <Tooltip content={<CustomApprovalRateTooltip />} cursor={{ stroke: CHART_GRID, strokeWidth: 1 }} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{ paddingTop: 12 }}
                        formatter={(value: string) => (
                          <span className="text-xs font-medium text-on-surface-variant mr-3">
                            {value}
                          </span>
                        )}
                      />
                      {approvalRateSeries.map((series) => (
                        <Area
                          key={series.name}
                          type="monotone"
                          dataKey={series.name}
                          name={series.name}
                          stroke={series.color}
                          strokeWidth={2.5}
                          fill={`url(#approval-rate-${series.name.replace(/\s+/g, '-')})`}
                          fillOpacity={1}
                          dot={(props: any) => {
                            if (props.index === 0) return <g />;
                            return (
                              <circle
                                key={`dot-${series.name}-${props.index}`}
                                cx={props.cx}
                                cy={props.cy}
                                r={4}
                                stroke={props.stroke}
                                strokeWidth={2}
                                fill="#ffffff"
                              />
                            );
                          }}
                          activeDot={(props: any) => {
                            if (props.index === 0) return <g />;
                            return (
                              <circle
                                key={`active-dot-${series.name}-${props.index}`}
                                cx={props.cx}
                                cy={props.cy}
                                r={6}
                                stroke={props.stroke}
                                strokeWidth={2}
                                fill="#ffffff"
                              />
                            );
                          }}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* ── Custom Print-Only Styles and Footer ── */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            size: auto;
            margin: 0;
          }
          body {
            padding: 1.6cm 1.6cm 1.8cm 1.6cm !important;
            background-color: #fff !important;
          }
          tr {
            break-inside: avoid;
          }
          thead {
            display: table-header-group;
          }
        }
      `}} />
      <div className="hidden print:flex flex-col fixed bottom-[1.2cm] left-[1.6cm] right-[1.6cm] text-[8.5px] text-black/50 font-sans">
        <div className="flex justify-between items-end border-t border-black/15 pt-1">
          <span className="leading-none">https://clinicka.vercel.app</span>
          <span className="leading-none">ClinicKa!</span>
        </div>
      </div>

    </div>
  );
}
