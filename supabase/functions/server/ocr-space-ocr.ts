// @ts-nocheck
const OCR_SPACE_API_URL = Deno.env.get("OCR_SPACE_API_URL") || "https://api.ocr.space/parse/image";

export class OcrSpaceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrSpaceConfigurationError";
  }
}

export class OcrSpaceRequestError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "OcrSpaceRequestError";
    this.status = status;
  }
}

function normalizeWhitespace(value: string) {
  return value.replace(/[ \t\f\v]+/g, " ").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function cleanOcrLine(value: string) {
  return String(value || "")
    .replace(/[|{}[\]~]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9).%+\-]+$/g, "")
    .trim();
}

function isAdministrativeLine(line: string) {
  const normalized = line.toLowerCase();
  if (!normalized) return true;
  if (normalized.length <= 2) return true;
  if (/^(name|patient|student|age|sex|gender|birth|birthday|date|address|clinic|hospital|physician|requested|requesting|radiologist|rad\.?\s*tech|radiologic\s*technologist|radiographer|medical\s+technologist|pathologist|license|lic\.?|prepared|encoded|released|validated|verified|case|film|exam|examination|page|note|tel|phone|email|room|ward|observations?|mesh\s*tags?|tags?|keywords?|annotations?|labels?|metadata|related\s+terms?|search\s+terms?)\b/.test(normalized)) {
    return true;
  }
  if (/\b(?:rrt|rmt|mt|med\.?\s*tech\.?|rad\.?\s*tech\.?|radiologist|pathologist|fpcr|fpcp|fpcs|facr|dpbr|prc|ptr|lic\.?\s*no)\b/i.test(line)) return true;
  if (/(gordon college|holy infant|james l\.?\s*gordon|medical center|diagnostic|laboratory|hospital|clinic)/i.test(line)) {
    return true;
  }
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(normalized)) return true;
  if (/^[A-Z0-9 -]{3,}$/.test(line) && !/(normal|clear|lung|chest|heart|pulmonary|cardio|infil|effusion|opacity|ptb|pneumonia|impression|findings|result)/i.test(line)) {
    return true;
  }
  return false;
}

function sectionStartRegex(labelPattern: string) {
  return new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*[:\\-]?\\s*`, "i");
}

const XRAY_FINDINGS_LABEL_PATTERN =
  "(?:(?:radiographic|radiologic(?:al)?|chest\\s*x[-\\s]?ray|x[-\\s]?ray)\\s*)?(?:findings?|observations?|report|result|reading|remarks?)";
const XRAY_IMPRESSION_LABEL_PATTERN =
  "(?:final\\s+)?(?:radiologic(?:al)?\\s+)?(?:impression|impressions|impress[il]on|impresslon|impresson)";
const XRAY_CONCLUSION_LABEL_PATTERN =
  "(?:conclusion|conclusions|diagnosis|interpretation|opinion|assessment)";
const XRAY_SECONDARY_LABEL_PATTERN = `(?:${XRAY_IMPRESSION_LABEL_PATTERN}|${XRAY_CONCLUSION_LABEL_PATTERN})`;

const SECTION_LABELS = [
  {
    key: "findings",
    pattern: XRAY_FINDINGS_LABEL_PATTERN,
  },
  {
    key: "impression",
    pattern: XRAY_IMPRESSION_LABEL_PATTERN,
  },
  {
    key: "conclusion",
    pattern: XRAY_CONCLUSION_LABEL_PATTERN,
  },
] as const;

const OCR_METADATA_LABEL_PATTERN =
  "(?:observations?|mesh\\s*tags?|tags?|keywords?|annotations?|labels?|metadata|related\\s+terms?|search\\s+terms?|detected\\s+conditions?)";

const XRAY_NON_CLINICAL_TAIL_PATTERN =
  "(?:note\\s*:|this\\s+report\\s+is\\s+based|should\\s+be\\s+correlated|please\\s+correlate\\s+clinically|correlate\\s+clinically|electronically\\s+signed|validated\\s+by|verified\\s+by|released\\s+by|prepared\\s+by|encoded\\s+by|rad\\.?\\s*tech\\.?|radiologic\\s+technologist|radiographer|radiologist|medical\\s+technologist|pathologist|rrt\\b|rmt\\b|\\bmt\\b|\\bmd\\b|\\bfpcr\\b|\\bfpcp\\b|\\bfpcs\\b|\\bfacr\\b|\\bdpbr\\b|\\bprc\\b|\\bptr\\b|lic\\.?\\s*no|license\\s*no|page\\s*\\d+\\s*of\\s*\\d+|page\\s*\\d+)";

const STOP_LABEL_PATTERN =
  `(?:${XRAY_IMPRESSION_LABEL_PATTERN}|${XRAY_CONCLUSION_LABEL_PATTERN}|findings?|observations?|result|remarks?|recommendations?|${OCR_METADATA_LABEL_PATTERN}|${XRAY_NON_CLINICAL_TAIL_PATTERN}|name|patient|student|age|sex|gender|birthday|date|physician|license|prepared|encoded|released|validated|verified|request(?:ed|ing)?|exam(?:ination)?|case|film|page)`;

function resolveStopIndex(text: string, match: RegExpExecArray | null) {
  if (!match) return -1;
  const matchedText = match[0] || "";
  return matchedText.startsWith(".") ? match.index + 1 : match.index;
}

function extractSectionText(text: string, labelPattern: string) {
  const match = sectionStartRegex(labelPattern).exec(text);
  if (!match) return "";

  const start = match.index + match[0].length;
  const tail = text.slice(start);
  const stopMatches = [
    new RegExp(`\\n\\s*${STOP_LABEL_PATTERN}\\s*[:\\-]?`, "i").exec(tail),
    new RegExp(`\\b${XRAY_NON_CLINICAL_TAIL_PATTERN}`, "i").exec(tail),
    new RegExp(`(?:^|\\.\\s+|;\\s+|\\n\\s*)${OCR_METADATA_LABEL_PATTERN}\\s*[:\\-]?`, "i").exec(tail),
    new RegExp(`\\b${OCR_METADATA_LABEL_PATTERN}\\b\\s*[:\\-]?`, "i").exec(tail),
  ]
    .map((stopMatch) => resolveStopIndex(tail, stopMatch))
    .filter((index) => index >= 0);
  const stopIndex = stopMatches.length ? Math.min(...stopMatches) : -1;
  return stripTrailingSignatureName(stopIndex >= 0 ? tail.slice(0, stopIndex) : tail);
}

function stripTrailingSignatureName(value: string) {
  return String(value || "")
    .replace(/([.!?])\s+[A-Z][A-Z.'-]*(?:\s+[A-Z][A-Z.'-]*){1,8},?\s*$/g, "$1")
    .replace(/\s*,\s*$/g, "")
    .trim();
}

function stripXrayNonClinicalTail(value: string) {
  let text = String(value || "");
  const markerMatch = new RegExp(`\\b${XRAY_NON_CLINICAL_TAIL_PATTERN}`, "i").exec(text);

  if (markerMatch) {
    text = stripTrailingSignatureName(text.slice(0, markerMatch.index));
  }

  return text
    .replace(new RegExp(`(?:^|\\n)\\s*(?:${XRAY_NON_CLINICAL_TAIL_PATTERN})[\\s\\S]*$`, "i"), "")
    .trim();
}

function isXrayNonClinicalStopLine(line: string) {
  return new RegExp(`\\b${XRAY_NON_CLINICAL_TAIL_PATTERN}`, "i").test(line);
}

function isXraySecondaryHeaderLine(line: string) {
  return new RegExp(`^\\s*(?:${XRAY_SECONDARY_LABEL_PATTERN})\\b\\s*[:\\-]?`, "i").test(line);
}

function isXrayFindingsHeaderLine(line: string) {
  return new RegExp(`^\\s*(?:${XRAY_FINDINGS_LABEL_PATTERN})\\b\\s*[:\\-]?`, "i").test(line);
}

function stripXraySectionHeader(line: string, labelPattern: string) {
  return String(line || "").replace(new RegExp(`^\\s*(?:${labelPattern})\\b\\s*[:\\-]?\\s*`, "i"), "");
}

function formatClinicalText(value: string) {
  return String(value || "")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/([.!?])\s+(?=(?:No|There|The|Heart|Lung|Lungs|Mild|Moderate|Severe|Impression|Findings|Result|Conclusion)\b|[A-Z][a-z])/g, "$1\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/^[,.;:\-\s]+|[,;:\-\s]+$/g, "")
    .trim();
}

function cleanupClinicalText(value: string) {
  const candidateLines = stripXrayNonClinicalTail(normalizeWhitespace(value))
    .replace(new RegExp(`\\b${OCR_METADATA_LABEL_PATTERN}\\b[\\s\\S]*$`, "i"), "")
    .split(/\n+/)
    .map(cleanOcrLine)
    .filter(Boolean);
  const lines = [];

  for (const line of candidateLines) {
    if (isXrayNonClinicalStopLine(line)) break;
    if (!isAdministrativeLine(line)) lines.push(line);
  }

  const cleaned = stripXrayNonClinicalTail(lines
    .join(" ")
    .replace(new RegExp(`\\b${OCR_METADATA_LABEL_PATTERN}\\b\\s*[:\\-]?.*$`, "i"), " ")
    .replace(/\b(?:impression|impressions|conclusion|diagnosis|interpretation|opinion|assessment|findings?|observations?|report|result|reading|remarks?)\s*[:\-]\s*/gi, " ")
    .trim());

  return formatClinicalText(cleaned);
}

function scoreClinicalLine(line: string) {
  const normalized = line.toLowerCase();
  let score = 0;

  if (line.length >= 8 && line.length <= 180) score += 1;
  if (/(chest|lung|lungs|pulmonary|cardio|heart|pleura|hilar|diaphragm|costophrenic)/.test(normalized)) score += 2;
  if (/(normal|clear|unremarkable|negative|within normal|no active|no acute)/.test(normalized)) score += 3;
  if (/(infiltrat|opacity|opacit|effusion|pneumonia|ptb|tuberculosis|cardiomegaly|nodule|mass|fibrosis|consolidation|atelectasis|abnormal)/.test(normalized)) score += 3;
  if (isAdministrativeLine(line)) score -= 6;
  if (/^\W*\d+[\d\s/.-]*\W*$/.test(line)) score -= 4;

  return score;
}

function getFallbackFindings(lines: string[]) {
  const candidates = lines
    .map((line, index) => ({ index, line: cleanOcrLine(line), score: scoreClinicalLine(line) }))
    .filter((item) => item.line && item.score >= 3)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index);

  return cleanupClinicalText(candidates.map((item) => item.line).join("\n"));
}

function extractXrayFindingsByProximity(lines: string[]) {
  const collectedCandidates: Array<{ findings: string; score: number; index: number }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = cleanOcrLine(lines[index]);
    if (!rawLine || !isXrayFindingsHeaderLine(rawLine)) continue;

    const collectedLines: string[] = [];
    const inlineText = cleanupClinicalText(stripXraySectionHeader(rawLine, XRAY_FINDINGS_LABEL_PATTERN));
    if (inlineText) collectedLines.push(inlineText);

    for (const nearbyRawLine of lines.slice(index + 1, index + 7)) {
      const nearbyLine = cleanOcrLine(nearbyRawLine);
      if (!nearbyLine) continue;
      if (isXraySecondaryHeaderLine(nearbyLine) || isXrayNonClinicalStopLine(nearbyLine)) break;
      if (isXrayFindingsHeaderLine(nearbyLine) && collectedLines.length) break;

      const cleanedNearbyLine = cleanupClinicalText(stripXraySectionHeader(nearbyLine, XRAY_FINDINGS_LABEL_PATTERN));
      const clinicalScore = scoreClinicalLine(cleanedNearbyLine || nearbyLine);
      if (cleanedNearbyLine && clinicalScore >= 1) {
        collectedLines.push(cleanedNearbyLine);
        continue;
      }

      if (collectedLines.length && isAdministrativeLine(nearbyLine)) {
        break;
      }
    }

    const findings = cleanupClinicalText(collectedLines.join("\n"));
    if (findings) {
      collectedCandidates.push({
        findings,
        index,
        score: scoreClinicalLine(findings) + collectedLines.length,
      });
    }
  }

  collectedCandidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return collectedCandidates[0]?.findings || "";
}

function hasUnnegatedPattern(text: string, pattern: RegExp) {
  const normalized = text.toLowerCase();
  const matches = [...normalized.matchAll(new RegExp(pattern.source, "gi"))];
  return matches.some((match) => {
    const start = Math.max(0, (match.index || 0) - 40);
    const prefix = normalized.slice(start, match.index);
    return !/(?:\bno\b|\bwithout\b|\bnegative\s+for\b|\bnot\b)\s+(?:\w+\s+){0,4}$/.test(prefix);
  });
}

function inferXrayResult(text: string): "normal" | "abnormal" | undefined {
  const normalized = text.toLowerCase();
  const abnormalPatterns = [
    /infiltrat\w*/i,
    /opacit\w*/i,
    /effusion/i,
    /pneumonia/i,
    /\bptb\b/i,
    /tuberculosis/i,
    /cardiomegaly/i,
    /nodule/i,
    /mass/i,
    /fibrosis/i,
    /consolidation/i,
    /atelectasis/i,
    /pleural\s+thickening/i,
    /abnormal/i,
  ];

  if (abnormalPatterns.some((pattern) => hasUnnegatedPattern(text, pattern))) {
    return "abnormal";
  }

  if (
    /(normal\s+chest|negative\s+chest|unremarkable|within\s+normal\s+limits|no\s+active\s+(?:pulmonary|lung|cardiopulmonary)\s+disease|no\s+acute\s+cardiopulmonary|clear\s+lungs?|no\s+(?:focal\s+)?infiltrat|no\s+pleural\s+effusion|heart\s+(?:is\s+)?not\s+enlarged)/.test(normalized)
  ) {
    return "normal";
  }

  return undefined;
}

export function extractChestXrayFields(rawText: string) {
  const cleanedLines = normalizeWhitespace(rawText)
    .split(/\n+/)
    .map(cleanOcrLine)
    .filter(Boolean);
  const cleanedText = cleanedLines.join("\n");

  const strictFindings = cleanupClinicalText(extractSectionText(cleanedText, XRAY_FINDINGS_LABEL_PATTERN));
  const proximityFindings = strictFindings ? "" : extractXrayFindingsByProximity(cleanedLines);
  const fallbackFindings = proximityFindings || strictFindings || getFallbackFindings(cleanedLines);
  return {
    findings: fallbackFindings,
    result: inferXrayResult(fallbackFindings) || inferXrayResult(cleanedText),
  };
}

type CbcNumericFieldKey = "hemoglobin" | "hematocrit" | "wbc" | "plateletCount";
type CbcNumericNormalizer = (value: number, context: string, rawValue: string) => string;

const CBC_NUMERIC_FIELDS: Array<{
  key: CbcNumericFieldKey;
  pattern: RegExp;
  normalize: CbcNumericNormalizer;
}> = [
  {
    key: "hemoglobin",
    pattern: /\b(?:h[ae]moglobin|hgb|hb)\b/i,
    normalize: normalizeHemoglobinValue,
  },
  {
    key: "hematocrit",
    pattern: /\b(?:h[ae]matocrit|hct|pcv|packed\s+cell\s+volume)\b/i,
    normalize: normalizeHematocritValue,
  },
  {
    key: "wbc",
    pattern: /\b(?:white\s*(?:blood\s*)?(?:cell\s*)?(?:count)?|white\s+cells?|wbc|total\s+(?:wbc|leu(?:ko|co)cyte)\s*count|tlc|leu(?:ko|co)cytes?|leu(?:ko|co)cyte\s*count)\b/i,
    normalize: normalizeWbcValue,
  },
  {
    key: "plateletCount",
    pattern: /\b(?:platelets?|platelet\s*count|plt|plt\s*count|thrombocytes?|thrombocyte\s*count)\b/i,
    normalize: normalizePlateletValue,
  },
];

const CBC_BLOOD_TYPE_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function getCbcLabelCount(line: string) {
  return CBC_NUMERIC_FIELDS.filter((field) => field.pattern.test(line)).length;
}

function formatNumericValue(value: number, maxDecimals: number) {
  if (!Number.isFinite(value)) return "";
  const fixed = value.toFixed(maxDecimals);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function normalizeCbcUnitContext(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[μµ]/g, "u")
    .replace(/[×✕]/g, "x")
    .replace(/[⁰]/g, "0")
    .replace(/[¹]/g, "1")
    .replace(/[²]/g, "2")
    .replace(/[³]/g, "3")
    .replace(/[⁴]/g, "4")
    .replace(/[⁵]/g, "5")
    .replace(/[⁶]/g, "6")
    .replace(/[⁷]/g, "7")
    .replace(/[⁸]/g, "8")
    .replace(/[⁹]/g, "9")
    .replace(/\b(?:micro|mc)l(?:iter|itre)?s?\b/g, "ul")
    .replace(/\bmicrol(?:iter|itre)s?\b/g, "ul")
    .replace(/\bcubic\s+millimeters?\b/g, "mm3")
    .replace(/\bcu\.?\s*mm\b/g, "cumm")
    .replace(/\s+/g, "");
}

function hasHemoglobinGPerDlUnit(context: string) {
  const normalized = normalizeCbcUnitContext(context);
  return /(?:g|gm|gram|grams)\/dl|gdl|g%/.test(normalized);
}

function hasHemoglobinGPerLUnit(context: string) {
  const normalized = normalizeCbcUnitContext(context);
  return /(?:g|gram|grams)\/l/.test(normalized) && !hasHemoglobinGPerDlUnit(context);
}

function hasHematocritPercentUnit(context: string) {
  const normalized = normalizeCbcUnitContext(context);
  return /%|percent|pct/.test(normalized);
}

function hasHematocritFractionUnit(context: string) {
  const normalized = normalizeCbcUnitContext(context);
  return /l\/l|vol\/vol|v\/v/.test(normalized);
}

function hasCountTargetUnit(context: string) {
  const normalized = normalizeCbcUnitContext(context);
  return (
    /(?:x)?10(?:\^)?9\/?l\b/.test(normalized) ||
    /g\/l/.test(normalized) ||
    /k\/?ul/.test(normalized) ||
    /10(?:\^)?3\/?ul\b/.test(normalized) ||
    /10(?:\^)?3\/?mm3\b/.test(normalized) ||
    /10(?:\^)?3\/?cumm\b/.test(normalized) ||
    /thou(?:sand)?\/?(?:ul|mm3|cumm)\b/.test(normalized)
  );
}

function hasCountPerMicroliterUnit(context: string) {
  const normalized = normalizeCbcUnitContext(context);
  if (hasCountTargetUnit(context)) return false;
  return (
    /\/ul/.test(normalized) ||
    /perul/.test(normalized) ||
    /cells?\/ul/.test(normalized) ||
    /\/mm3/.test(normalized) ||
    /cells?\/mm3/.test(normalized) ||
    /cumm/.test(normalized) ||
    /cells?\/cumm/.test(normalized)
  );
}

function getTokenContext(text: string, token: { index: number; raw: string }, before = 28, after = 38) {
  const start = Math.max(0, token.index - before);
  const end = Math.min(text.length, token.index + token.raw.length + after);
  return text.slice(start, end);
}

function getLabelContext(text: string, index: number, length: number) {
  const start = Math.max(0, index - 8);
  const end = Math.min(text.length, index + length + 28);
  return text.slice(start, end);
}

function isInRange(value: number, min: number, max: number) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function normalizeHemoglobinValue(value: number, context: string) {
  const unitContext = normalizeCbcUnitContext(context);
  const normalized = /mmol\/?l|mg\/?(?:dl|l)/.test(unitContext)
    ? Number.NaN
    : hasHemoglobinGPerLUnit(context)
    ? value / 10
    : value;

  if (normalized < 3 || normalized > 25) return "";
  return formatNumericValue(normalized, 1);
}

function normalizeHematocritValue(value: number, context: string) {
  let normalized = Number.NaN;
  const unitContext = normalizeCbcUnitContext(context);

  if (hasHematocritPercentUnit(context)) {
    normalized = value;
  } else if (hasHematocritFractionUnit(context)) {
    normalized = value * 100;
  } else if (!/mmol|mg\/(?:dl|l)|mg(?:dl|l)|g\/(?:dl|l)|gdl|\/ul|\/mm3|cumm/.test(unitContext)) {
    normalized = value > 0 && value < 1 ? value * 100 : value;
  }

  if (normalized < 10 || normalized > 70) return "";
  return formatNumericValue(normalized, 1);
}

function normalizeWbcValue(value: number, context: string) {
  let normalized = Number.NaN;
  const unitContext = normalizeCbcUnitContext(context);

  if (hasCountTargetUnit(context)) {
    normalized = value;
  } else if (hasCountPerMicroliterUnit(context)) {
    normalized = value / 1000;
  } else if (!/mmol|mg\/(?:dl|l)|mg(?:dl|l)|g\/(?:dl|l)|gdl|\/ul|\/mm3|cumm|10(?:\^)?[0368]\/?l/.test(unitContext) && isInRange(value, 0.5, 100)) {
    normalized = value;
  }

  if (normalized < 0.5 || normalized > 100) return "";
  return formatNumericValue(normalized, 2);
}

function normalizePlateletValue(value: number, context: string) {
  let normalized = Number.NaN;
  const unitContext = normalizeCbcUnitContext(context);

  if (hasCountTargetUnit(context)) {
    normalized = value;
  } else if (hasCountPerMicroliterUnit(context)) {
    normalized = value / 1000;
  } else if (!/mmol|mg\/(?:dl|l)|mg(?:dl|l)|g\/(?:dl|l)|gdl|\/ul|\/mm3|cumm|10(?:\^)?[0368]\/?l/.test(unitContext) && isInRange(value, 10, 1000)) {
    normalized = value;
  }

  if (normalized < 10 || normalized > 1000) return "";
  return formatNumericValue(Math.round(normalized), 0);
}

function parseOcrNumber(value: string) {
  const compact = String(value || "").replace(/\s+/g, "");
  if (!compact) return Number.NaN;

  let normalized = compact;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/,/g, "");
  } else if (/^\d{1,3}(?:,\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else if (/^\d+,\d+$/.test(normalized)) {
    normalized = normalized.replace(",", ".");
  }

  return Number(normalized.replace(/[^\d.-]/g, ""));
}

function getNumericTokens(value: string) {
  const tokens: Array<{ index: number; raw: string; value: number }> = [];
  const pattern = /(?:<|>)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:[.,]\d+)?)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    const raw = match[1] || "";
    const rawIndex = match.index + Math.max(0, match[0].indexOf(raw));
    const previousChar = rawIndex > 0 ? value[rawIndex - 1] : "";
    const nextChars = value.slice(rawIndex + raw.length, rawIndex + raw.length + 2);
    if (/[xX^]/.test(previousChar) || /^\s*\^/.test(nextChars)) continue;

    const parsedValue = parseOcrNumber(raw);
    if (Number.isFinite(parsedValue)) {
      tokens.push({
        index: rawIndex,
        raw,
        value: parsedValue,
      });
    }
  }

  return tokens;
}

function extractLabeledNumericValue(
  line: string,
  pattern: RegExp,
  normalize: CbcNumericNormalizer,
) {
  const match = pattern.exec(line);
  if (!match) return "";

  const head = line.slice(0, match.index);
  const tail = line.slice(match.index + match[0].length);
  const tailTokens = getNumericTokens(tail);

  for (const token of tailTokens) {
    const prefix = tail.slice(0, token.index).toLowerCase();
    if (/\b(?:reference|normal\s+range|range|ref\.?)\b/.test(prefix)) continue;

    const normalized = normalize(token.value, `${getLabelContext(line, match.index, match[0].length)} ${getTokenContext(tail, token)}`, token.raw);
    if (normalized) return normalized;
  }

  const headTokens = getNumericTokens(head);
  for (const token of [...headTokens].reverse()) {
    const normalized = normalize(token.value, `${getLabelContext(line, match.index, match[0].length)} ${getTokenContext(head, token)}`, token.raw);
    if (normalized) return normalized;
  }

  return "";
}

function extractCbcTableValues(lines: string[]) {
  const fields: Partial<Record<CbcNumericFieldKey, string>> = {};

  for (let index = 0; index < lines.length - 1; index += 1) {
    const labelLine = lines[index];
    const labels = CBC_NUMERIC_FIELDS
      .map((field) => {
        const match = field.pattern.exec(labelLine);
        return match ? { ...field, index: match.index, labelContext: getLabelContext(labelLine, match.index, match[0].length) } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.index - b.index);

    if (labels.length < 2) continue;

    for (const valueLine of lines.slice(index + 1, index + 3)) {
      const tokens = getNumericTokens(valueLine);
      if (tokens.length < labels.length) continue;

      labels.forEach((field: any, fieldIndex: number) => {
        if (fields[field.key]) return;
        const token = tokens[fieldIndex];
        const normalized = field.normalize(token.value, `${field.labelContext} ${getTokenContext(valueLine, token)}`, token.raw);
        if (normalized) fields[field.key] = normalized;
      });
      break;
    }
  }

  return fields;
}

function extractCbcNumericField(
  lines: string[],
  pattern: RegExp,
  normalize: CbcNumericNormalizer,
) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!pattern.test(line)) continue;

    const sameLineValue = extractLabeledNumericValue(line, pattern, normalize);
    if (sameLineValue) return sameLineValue;
    if (getCbcLabelCount(line) > 1) continue;

    for (const nearbyLine of lines.slice(index + 1, index + 3)) {
      if (/[A-Za-z]{3,}/.test(nearbyLine) && CBC_NUMERIC_FIELDS.some((field) => field.pattern.test(nearbyLine))) {
        break;
      }

      for (const token of getNumericTokens(nearbyLine)) {
        const normalized = normalize(token.value, `${line} ${getTokenContext(nearbyLine, token)}`, token.raw);
        if (normalized) return normalized;
      }
    }
  }

  return "";
}

function normalizeBloodRh(value: string) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[()]/g, "");
  if (!normalized) return "";
  if (normalized === "+" || normalized === "positive" || normalized === "pos" || normalized === "reactive" || normalized === "rh+" || normalized === "rhd+" || normalized === "dpositive" || normalized === "dpos") return "+";
  if (normalized === "-" || normalized === "negative" || normalized === "neg" || normalized === "nonreactive" || normalized === "rh-" || normalized === "rhd-" || normalized === "dnegative" || normalized === "dneg") return "-";
  return "";
}

function normalizeAboValue(value: string) {
  const match = /\b(AB|A|B|O)\b/i.exec(String(value || ""));
  return match ? match[1].toUpperCase() : "";
}

function extractCbcBloodType(lines: string[]) {
  const labelPattern = /\b(?:blood\s*(?:type|group)|abo(?:\/?rh)?|abo\s*group|rh(?:esus)?(?:\s*type)?)\b/i;
  const aboLabelPattern = /\b(?:abo|abo\s*group|blood\s*group)\b/i;
  const rhLabelPattern = /\b(?:rh(?:esus)?|rh\s*d|rhd)\b/i;
  let detectedAbo = "";
  let detectedRh = "";

  for (const line of lines) {
    if (!labelPattern.test(line)) continue;

    const normalizedLine = line.replace(/\b(?:blood\s*(?:type|group)|abo(?:\/?rh)?|abo\s*group|rh(?:esus)?(?:\s*type)?)\b/gi, " ");
    const directMatch = /\b(AB|A|B|O)\s*(?:Rh(?:D|\(D\))?\s*)?([+-]|positive|negative|pos|neg|reactive|nonreactive)(?=\s|$|[.,;])/i.exec(normalizedLine);
    if (directMatch) {
      const bloodType = `${directMatch[1].toUpperCase()}${normalizeBloodRh(directMatch[2])}`;
      if (CBC_BLOOD_TYPE_OPTIONS.includes(bloodType)) return bloodType;
    }

    const rhFirstMatch = /(?:^|\s)(?:Rh(?:D|\(D\))?\s*)?([+-]|positive|negative|pos|neg|reactive|nonreactive)\s*(AB|A|B|O)\b/i.exec(normalizedLine);
    if (rhFirstMatch) {
      const bloodType = `${rhFirstMatch[2].toUpperCase()}${normalizeBloodRh(rhFirstMatch[1])}`;
      if (CBC_BLOOD_TYPE_OPTIONS.includes(bloodType)) return bloodType;
    }

    if (!detectedAbo && aboLabelPattern.test(line)) {
      detectedAbo = normalizeAboValue(normalizedLine);
    }
    if (!detectedRh && rhLabelPattern.test(line)) {
      const rhMatch = /\b([+-]|positive|negative|pos|neg|reactive|nonreactive)\b/i.exec(normalizedLine);
      detectedRh = normalizeBloodRh(rhMatch?.[1] || normalizedLine);
    }
  }

  if (detectedAbo && detectedRh) {
    const bloodType = `${detectedAbo}${detectedRh}`;
    if (CBC_BLOOD_TYPE_OPTIONS.includes(bloodType)) return bloodType;
  }

  return "";
}

function normalizeTwoDigitYear(value: number) {
  if (value >= 100) return value;
  return value >= 70 ? 1900 + value : 2000 + value;
}

function formatIsoDate(year: number, month: number, day: number) {
  const normalizedYear = normalizeTwoDigitYear(year);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";

  const date = new Date(Date.UTC(normalizedYear, month - 1, day));
  const isValid =
    date.getUTCFullYear() === normalizedYear &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day;
  if (!isValid) return "";

  return [
    String(normalizedYear).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function parseCbcDateValue(value: string) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  return extractDateCandidates(text)[0]?.date || "";
}

function extractDateCandidates(value: string) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const candidates: Array<{ date: string; index: number }> = [];
  if (!text) return candidates;

  function pushDate(match: RegExpExecArray | null, date: string) {
    if (!match || !date) return;
    if (candidates.some((candidate) => candidate.index === match.index && candidate.date === date)) return;
    candidates.push({ date, index: match.index });
  }

  let isoMatch: RegExpExecArray | null;
  const isoPattern = /\b(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g;
  while ((isoMatch = isoPattern.exec(text))) {
    pushDate(isoMatch, formatIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])));
  }

  const monthNamePattern = Object.keys(MONTH_INDEX).join("|");
  let monthFirstMatch: RegExpExecArray | null;
  const monthFirstPattern = new RegExp(`\\b(${monthNamePattern})\\.?[\\s./-]+(\\d{1,2})(?:st|nd|rd|th)?[,]?[\\s./-]+(\\d{2,4})\\b`, "gi");
  while ((monthFirstMatch = monthFirstPattern.exec(text))) {
    pushDate(
      monthFirstMatch,
      formatIsoDate(
        Number(monthFirstMatch[3]),
        MONTH_INDEX[monthFirstMatch[1].toLowerCase()],
        Number(monthFirstMatch[2]),
      ),
    );
  }

  let dayFirstMatch: RegExpExecArray | null;
  const dayFirstPattern = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s./-]+(${monthNamePattern})\\.?[,]?[\\s./-]+(\\d{2,4})\\b`, "gi");
  while ((dayFirstMatch = dayFirstPattern.exec(text))) {
    pushDate(
      dayFirstMatch,
      formatIsoDate(
        Number(dayFirstMatch[3]),
        MONTH_INDEX[dayFirstMatch[2].toLowerCase()],
        Number(dayFirstMatch[1]),
      ),
    );
  }

  let numericMatch: RegExpExecArray | null;
  const numericPattern = /\b(\d{1,2})[\s./-](\d{1,2})[\s./-](\d{2,4})\b/g;
  while ((numericMatch = numericPattern.exec(text))) {
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);
    const year = Number(numericMatch[3]);

    if (first > 12 && second <= 12) pushDate(numericMatch, formatIsoDate(year, second, first));
    else if (second > 12 && first <= 12) pushDate(numericMatch, formatIsoDate(year, first, second));
    else if (first <= 12 && second <= 12) pushDate(numericMatch, formatIsoDate(year, first, second));
  }

  return candidates.sort((a, b) => a.index - b.index);
}

function hasBirthDateLabel(value: string) {
  return /\b(?:date\s*of\s*birth|birth\s*date|birthdate|birthday|d\.?\s*o\.?\s*b\.?|dob)\b/i.test(
    String(value || "").toLowerCase(),
  );
}

const DATE_LABEL_PATTERNS = [
  {
    kind: "birth",
    score: 0,
    pattern: /\b(?:date\s*of\s*birth|birth\s*date|birthdate|birthday|d\.?\s*o\.?\s*b\.?|dob)\b/gi,
  },
  {
    kind: "issuance",
    score: 100,
    pattern: /\b(?:date\s*of\s*issuance|issuance\s*(?:date|time)|(?:released?|issued?|issuance|reported?|report(?:ed)?|result(?:s)?|validated|verified|approved|completed|finali[sz]ed|certified|posted)\s*(?:date|time)|(?:date|time)\s*(?:released?|issued?|issuance|reported?|report(?:ed)?|result(?:s)?|validated|verified|approved|completed|finali[sz]ed|certified|posted))\b/gi,
  },
  {
    kind: "exam",
    score: 90,
    pattern: /\b(?:(?:exam(?:ination)?|study|x[-\s]?ray|performed|test(?:ed)?|service|procedure|run|analy[sz]ed|analysis)\s*(?:date|time)|(?:date|time)\s*(?:of\s*)?(?:exam(?:ination)?|study|x[-\s]?ray|performed|test(?:ed)?|service|procedure|run|analy[sz]ed|analysis))\b/gi,
  },
  {
    kind: "printed",
    score: 70,
    pattern: /\b(?:(?:printed|print|generated|encoded|transcribed)\s*(?:date|time)?|(?:date|time)\s*(?:printed|print|generated|encoded|transcribed))\b/gi,
  },
  {
    kind: "collection",
    score: 60,
    pattern: /\b(?:(?:received|collected|collection|specimen|sample|drawn|extracted|obtained|taken)\s*(?:date|time)?|(?:date|time)\s*(?:received|collected|collection|specimen|sample|drawn|extracted|obtained|taken))\b/gi,
  },
  {
    kind: "request",
    score: 40,
    pattern: /\b(?:(?:requested|request|ordered|order|registered|transaction|visit|encounter)\s*(?:date|time)?|(?:date|time)\s*(?:requested|request|ordered|order|registered|transaction|visit|encounter))\b/gi,
  },
] as const;

function findNearestDateLabel(value: string, endIndex = String(value || "").length) {
  const text = String(value || "").slice(0, endIndex);
  let bestMatch: { index: number; end: number; score: number; kind: string } | null = null;

  for (const label of DATE_LABEL_PATTERNS) {
    const pattern = new RegExp(label.pattern.source, label.pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text))) {
      const end = match.index + match[0].length;
      if (
        !bestMatch ||
        end > bestMatch.end ||
        (end === bestMatch.end && label.score > bestMatch.score)
      ) {
        bestMatch = {
          index: match.index,
          end,
          kind: label.kind,
          score: label.score,
        };
      }
    }
  }

  return bestMatch;
}

function getDateCandidateLabelScore(value: string, candidateIndex: number) {
  const text = String(value || "");
  const searchStart = Math.max(0, candidateIndex - 80);
  const prefix = text.slice(searchStart, candidateIndex);
  const nearestLabel = findNearestDateLabel(prefix);

  if (nearestLabel) {
    if (nearestLabel.kind === "birth") return -1;
    return nearestLabel.score;
  }

  if (hasBirthDateLabel(prefix)) {
    return -1;
  }

  return /\b(?:date|time)\b/i.test(prefix) ? 20 : 0;
}

function getLabResultDateLabelScore(line: string) {
  const normalized = String(line || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return 0;

  const nearestLabel = findNearestDateLabel(normalized);
  if (nearestLabel) return nearestLabel.kind === "birth" ? 0 : nearestLabel.score;

  return /\b(?:date|time)\b/i.test(normalized) && parseCbcDateValue(normalized) ? 20 : 0;
}

function getNearbyDateContextScore(lines: string[], index: number, candidateIndex: number) {
  let bestScore = getDateCandidateLabelScore(lines[index], candidateIndex);
  let foundBirthContext = bestScore < 0;

  for (let offset = 1; offset <= 3; offset += 1) {
    for (const nearbyIndex of [index - offset, index + offset]) {
      if (nearbyIndex < 0 || nearbyIndex >= lines.length) continue;
      const nearbyLine = lines[nearbyIndex];
      const nearbyScore = getLabResultDateLabelScore(nearbyLine);
      if (nearbyScore > 0) {
        bestScore = Math.max(bestScore, nearbyScore - offset * 2);
      } else if (hasBirthDateLabel(nearbyLine)) {
        foundBirthContext = true;
      }
    }
  }

  if (bestScore <= 0 && foundBirthContext) {
    return -1;
  }

  return bestScore;
}

function extractDateByKeywordProximity(lines: string[]) {
  const candidates: Array<{ date: string; score: number; index: number }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const dateCandidates = extractDateCandidates(line);
    if (!dateCandidates.length) continue;

    for (const dateCandidate of dateCandidates) {
      const score = getNearbyDateContextScore(lines, index, dateCandidate.index);
      if (score > 0) {
        candidates.push({
          date: dateCandidate.date,
          score,
          index,
        });
      }
    }
  }

  return candidates;
}

function extractCbcDate(lines: string[]) {
  const candidates: Array<{ date: string; score: number; index: number }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const score = getLabResultDateLabelScore(line);
    if (!score) continue;

    const sameLineCandidates = extractDateCandidates(line)
      .map((dateCandidate) => {
        const candidateScore = getDateCandidateLabelScore(line, dateCandidate.index);
        return {
          date: dateCandidate.date,
          score: candidateScore < 0 ? 0 : candidateScore || score,
          index,
        };
      })
      .filter((candidate) => candidate.score > 0);
    if (sameLineCandidates.length) {
      candidates.push(...sameLineCandidates);
      continue;
    }

    for (const nearbyLine of lines.slice(index + 1, index + 3)) {
      if (getLabResultDateLabelScore(nearbyLine) === 0 && /\b(?:birth|birthday|dob)\b/i.test(nearbyLine)) {
        break;
      }
      const nearbyDate = parseCbcDateValue(nearbyLine);
      if (nearbyDate) {
        candidates.push({ date: nearbyDate, score: score - 1, index });
        break;
      }
    }
  }

  if (!candidates.length) {
    candidates.push(...extractDateByKeywordProximity(lines));
  }

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0]?.date || "";
}

export function extractCbcFields(rawText: string) {
  const lines = normalizeWhitespace(rawText)
    .split(/\n+/)
    .map(cleanOcrLine)
    .filter(Boolean);
  const tableFields = extractCbcTableValues(lines);
  const fields: Record<string, string> = {};

  for (const field of CBC_NUMERIC_FIELDS) {
    fields[field.key] = tableFields[field.key] || extractCbcNumericField(lines, field.pattern, field.normalize);
  }

  fields.bloodType = extractCbcBloodType(lines);
  fields.date = extractCbcDate(lines);

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => Boolean(value)));
}

type UrinalysisFieldKey = "glucose" | "protein";

const URINALYSIS_FIELDS: Array<{
  key: UrinalysisFieldKey;
  pattern: RegExp;
}> = [
  {
    key: "glucose",
    pattern: /\b(?:urine\s*)?(?:glucose|sugar)\b/i,
  },
  {
    key: "protein",
    pattern: /\b(?:urine\s*)?(?:protein|albumin)\b/i,
  },
];

function normalizeDipstickValue(value: string) {
  const raw = String(value || "").trim();
  const normalized = raw
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[±]/g, "+/-")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";
  if (/^(?:negative|neg|nil|none|absent|not\s+detected|not\s+seen|normal)$/i.test(normalized)) return "Negative";
  if (/^(?:trace|tr|traces|small\s+trace|\+\/-|plus\s*\/\s*minus)$/i.test(normalized)) return "Trace";
  if (/^(?:1\s*\+|\+|one\s+plus|small)$/i.test(normalized)) return "1+";
  if (/^(?:2\s*\+|\+\+|two\s+plus|moderate)$/i.test(normalized)) return "2+";
  if (/^(?:3\s*\+|\+\+\+|three\s+plus|large)$/i.test(normalized)) return "3+";
  if (/^(?:4\s*\+|\+\+\+\+|four\s+plus|very\s+large)$/i.test(normalized)) return "4+";

  const explicitPlus = /\b([1-4])\s*\+\b/.exec(normalized);
  if (explicitPlus) return `${explicitPlus[1]}+`;

  const repeatedPlus = /(?<!\+)(\+{1,4})(?!\+)/.exec(raw);
  if (repeatedPlus) return `${repeatedPlus[1].length}+`;

  return "";
}

function getDipstickTokens(value: string) {
  const tokens: Array<{ index: number; raw: string; value: string }> = [];
  const patterns = [
    /\b(?:negative|neg|nil|none|absent|not\s+detected|not\s+seen|normal|trace|traces?|small\s+trace|plus\s*\/\s*minus|one\s+plus|two\s+plus|three\s+plus|four\s+plus|very\s+large|small|moderate|large)\b/gi,
    /(?:\+\/-|[1-4]\s*\+|\+{1,4}|±)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value))) {
      const raw = match[0] || "";
      const normalized = normalizeDipstickValue(raw);
      if (!normalized) continue;
      tokens.push({
        index: match.index,
        raw,
        value: normalized,
      });
    }
  }

  return tokens.sort((a, b) => a.index - b.index);
}

function extractLabeledDipstickValue(line: string, labelPattern: RegExp) {
  const match = labelPattern.exec(line);
  if (!match) return "";

  const head = line.slice(0, match.index);
  const tail = line.slice(match.index + match[0].length);
  const tailTokens = getDipstickTokens(tail);
  if (tailTokens.length) return tailTokens[0].value;

  const headTokens = getDipstickTokens(head);
  return headTokens.length ? headTokens[headTokens.length - 1].value : "";
}

function extractUrinalysisTableValues(lines: string[]) {
  const fields: Partial<Record<UrinalysisFieldKey, string>> = {};

  for (let index = 0; index < lines.length - 1; index += 1) {
    const labelLine = lines[index];
    const labels = URINALYSIS_FIELDS
      .map((field) => {
        const match = field.pattern.exec(labelLine);
        return match ? { ...field, index: match.index } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.index - b.index);

    if (labels.length < 2) continue;

    for (const valueLine of lines.slice(index + 1, index + 3)) {
      const tokens = getDipstickTokens(valueLine);
      if (tokens.length < labels.length) continue;

      (labels as any[]).forEach((field, fieldIndex) => {
        if (fields[field.key]) return;
        const token = tokens[fieldIndex];
        if (token?.value) fields[field.key] = token.value;
      });
      break;
    }
  }

  return fields;
}

function extractUrinalysisDipstickField(lines: string[], pattern: RegExp) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!pattern.test(line)) continue;

    const sameLineValue = extractLabeledDipstickValue(line, pattern);
    if (sameLineValue) return sameLineValue;

    for (const nearbyLine of lines.slice(index + 1, index + 3)) {
      if (/[A-Za-z]{3,}/.test(nearbyLine) && URINALYSIS_FIELDS.some((field) => field.pattern.test(nearbyLine))) {
        break;
      }

      const tokens = getDipstickTokens(nearbyLine);
      if (tokens.length) return tokens[0].value;
    }
  }

  return "";
}

export function extractUrinalysisFields(rawText: string) {
  const lines = normalizeWhitespace(rawText)
    .split(/\n+/)
    .map(cleanOcrLine)
    .filter(Boolean);
  const tableFields = extractUrinalysisTableValues(lines);
  const fields: Record<string, string> = {};

  for (const field of URINALYSIS_FIELDS) {
    fields[field.key] = tableFields[field.key] || extractUrinalysisDipstickField(lines, field.pattern);
  }

  fields.date = extractCbcDate(lines);

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => Boolean(value)));
}

function getOcrSpaceConfig() {
  const apiKey = String(
    Deno.env.get("OCR_SPACE_API_KEY") ||
      Deno.env.get("OCRSPACE_API_KEY") ||
      "",
  ).trim();
  const language = String(Deno.env.get("OCR_SPACE_LANGUAGE") || "eng").trim() || "eng";
  const engine = String(Deno.env.get("OCR_SPACE_ENGINE") || "2").trim();

  if (!apiKey) {
    throw new OcrSpaceConfigurationError(
      "OCR.space is not configured. Set OCR_SPACE_API_KEY in Supabase Edge Function secrets.",
    );
  }

  return {
    apiKey,
    engine: ["1", "2", "3"].includes(engine) ? engine : "2",
    language,
  };
}

export function resolveOcrSpaceInputMimeType(mimeType?: string | null, fileName?: string | null) {
  const normalized = String(mimeType || "").split(";")[0].trim().toLowerCase();
  const name = String(fileName || "").toLowerCase();

  if (normalized === "application/pdf" || name.endsWith(".pdf")) return "application/pdf";
  if (normalized === "image/tiff" || normalized === "image/tif" || /\.(tiff?|tif)$/i.test(name)) return "image/tiff";
  if (normalized === "image/gif" || name.endsWith(".gif")) return "image/gif";
  if (/\.(png)$/i.test(name)) return "image/png";
  if (/\.(jpe?g)$/i.test(name)) return "image/jpeg";
  if (/\.(bmp)$/i.test(name)) return "image/bmp";
  if (normalized === "image/png") return normalized;
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/bmp") return normalized;

  return "";
}

function getOcrSpaceFileType(mimeType: string, fileName?: string | null) {
  const name = String(fileName || "").toLowerCase();
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "PDF";
  if (mimeType === "image/png" || name.endsWith(".png")) return "PNG";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg" || /\.(jpe?g)$/i.test(name)) return "JPG";
  if (mimeType === "image/gif" || name.endsWith(".gif")) return "GIF";
  if (mimeType === "image/tiff" || mimeType === "image/tif" || /\.(tiff?|tif)$/i.test(name)) return "TIF";
  if (mimeType === "image/bmp" || name.endsWith(".bmp")) return "BMP";
  return "";
}

function normalizeOcrSpaceMessage(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).join(" ");
  }
  return String(value || "").trim();
}

function getOcrSpaceError(payload: any, responseStatus = 502) {
  const message = normalizeOcrSpaceMessage(payload?.ErrorMessage || payload?.error);
  const details = normalizeOcrSpaceMessage(payload?.ErrorDetails);
  const pageError = normalizeOcrSpaceMessage(
    (payload?.ParsedResults || [])
      .map((item: any) => item?.ErrorMessage || item?.ErrorDetails)
      .filter(Boolean),
  );
  const combined = [message, details, pageError].filter(Boolean).join(" ").trim();
  const normalized = combined.toLowerCase();

  if (normalized.includes("apikey") || normalized.includes("api key")) {
    return {
      message: "OCR.space API key was rejected. Check OCR_SPACE_API_KEY in Supabase Edge Function secrets.",
      status: 503,
    };
  }
  if (normalized.includes("file size") || normalized.includes("too large") || normalized.includes("maximum")) {
    return {
      message: "OCR.space free API rejected the file size. Use a smaller lab result file or upgrade the OCR.space plan.",
      status: 400,
    };
  }
  if (normalized.includes("pdf") && (normalized.includes("page") || normalized.includes("pages"))) {
    return {
      message: "OCR.space free API rejected the PDF page count. Use a PDF with 3 pages or fewer.",
      status: 400,
    };
  }
  if (normalized.includes("quota") || normalized.includes("rate") || normalized.includes("limit")) {
    return {
      message: "OCR.space quota or rate limit was reached. Check the free API request limit or try again later.",
      status: 429,
    };
  }
  if (normalized.includes("not a valid") || normalized.includes("unsupported") || normalized.includes("file type")) {
    return {
      message: "OCR.space could not read this file type. Use PDF, PNG, JPG, GIF, TIF, or BMP.",
      status: 400,
    };
  }

  return {
    message: combined || "OCR.space could not process the lab result file.",
    status: responseStatus || 502,
  };
}

function getPageCount(payload: any) {
  const parsedResults = Array.isArray(payload?.ParsedResults) ? payload.ParsedResults : [];
  return parsedResults.length || 0;
}

function extractParsedText(payload: any) {
  const parsedResults = Array.isArray(payload?.ParsedResults) ? payload.ParsedResults : [];
  return parsedResults
    .map((item: any) => String(item?.ParsedText || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export async function readChestXrayWithOcrSpace(input: {
  content: ArrayBuffer | Uint8Array;
  fileName?: string | null;
  mimeType: string;
}) {
  const result = await readLabResultWithOcrSpace(input, "chest-xray");
  const fields = extractChestXrayFields(result.rawText);

  return {
    findings: fields.findings,
    pageCount: result.pageCount,
    rawText: result.rawText,
    result: fields.result,
    source: "ocr-space" as const,
  };
}

export async function readCbcWithOcrSpace(input: {
  content: ArrayBuffer | Uint8Array;
  fileName?: string | null;
  mimeType: string;
}) {
  const result = await readLabResultWithOcrSpace(input, "cbc");

  return {
    fields: extractCbcFields(result.rawText),
    pageCount: result.pageCount,
    rawText: result.rawText,
    source: "ocr-space" as const,
  };
}

export async function readUrinalysisWithOcrSpace(input: {
  content: ArrayBuffer | Uint8Array;
  fileName?: string | null;
  mimeType: string;
}) {
  const result = await readLabResultWithOcrSpace(input, "urinalysis");

  return {
    fields: extractUrinalysisFields(result.rawText),
    pageCount: result.pageCount,
    rawText: result.rawText,
    source: "ocr-space" as const,
  };
}

async function readLabResultWithOcrSpace(input: {
  content: ArrayBuffer | Uint8Array;
  fileName?: string | null;
  mimeType: string;
}, documentType: "chest-xray" | "cbc" | "urinalysis") {
  const config = getOcrSpaceConfig();
  const bytes = input.content instanceof Uint8Array ? input.content : new Uint8Array(input.content);
  const mimeType = resolveOcrSpaceInputMimeType(input.mimeType, input.fileName);
  const fileType = getOcrSpaceFileType(mimeType, input.fileName);

  if (!mimeType || !fileType) {
    throw new Error("Unsupported lab result file type. OCR.space supports PDF, PNG, JPG, GIF, TIF, and BMP.");
  }

  const fileName = String(input.fileName || `${documentType}.${fileType.toLowerCase()}`).trim();
  const formData = new FormData();
  formData.set("file", new Blob([bytes], { type: mimeType }), fileName);
  formData.set("language", config.language);
  formData.set("isOverlayRequired", "false");
  formData.set("detectOrientation", "true");
  formData.set("scale", "true");
  formData.set("isTable", documentType === "cbc" || documentType === "urinalysis" ? "true" : "false");
  formData.set("OCREngine", config.engine);
  formData.set("filetype", fileType);

  const response = await fetch(OCR_SPACE_API_URL, {
    method: "POST",
    headers: {
      apikey: config.apiKey,
    },
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.IsErroredOnProcessing) {
    const error = getOcrSpaceError(payload, response.status || 502);
    throw new OcrSpaceRequestError(error.message, error.status);
  }

  const ocrExitCode = Number(payload?.OCRExitCode);
  if (ocrExitCode >= 3) {
    const error = getOcrSpaceError(payload, 502);
    throw new OcrSpaceRequestError(error.message, error.status);
  }

  const rawText = extractParsedText(payload);

  return {
    pageCount: getPageCount(payload),
    rawText,
  };
}
