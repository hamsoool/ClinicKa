// @ts-nocheck
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_VISION_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const GOOGLE_VISION_BASE_URL = "https://vision.googleapis.com/v1";

let googleAccessTokenCache: { token: string; expiresAt: number } | null = null;

export class GoogleVisionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleVisionConfigurationError";
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
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9).%]+$/g, "")
    .trim();
}

function isAdministrativeLine(line: string) {
  const normalized = line.toLowerCase();
  if (!normalized) return true;
  if (normalized.length <= 2) return true;
  if (/^(name|patient|student|age|sex|gender|birth|birthday|date|address|clinic|hospital|physician|requested|requesting|radiologist|license|lic\.?|prepared|encoded|released|validated|verified|case|film|exam|examination|page|tel|phone|email|room|ward)\b/.test(normalized)) {
    return true;
  }
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

const SECTION_LABELS = [
  {
    key: "impression",
    pattern: "(?:impression|impressions|impress[il]on|impresslon)",
  },
  {
    key: "conclusion",
    pattern: "(?:conclusion|conclusions|diagnosis|interpretation)",
  },
  {
    key: "findings",
    pattern: "(?:(?:radiographic|x[-\\s]?ray|chest\\s*x[-\\s]?ray)\\s*)?(?:findings?|result|remarks?)",
  },
] as const;

const STOP_LABEL_PATTERN =
  "(?:impression|impressions|conclusion|conclusions|diagnosis|interpretation|findings?|result|remarks?|recommendations?|name|patient|student|age|sex|gender|birthday|date|physician|radiologist|license|prepared|encoded|released|validated|verified|request(?:ed|ing)?|exam(?:ination)?|case|film|page)";

function extractSectionText(text: string, labelPattern: string) {
  const match = sectionStartRegex(labelPattern).exec(text);
  if (!match) return "";

  const start = match.index + match[0].length;
  const tail = text.slice(start);
  const stopMatch = new RegExp(`\\n\\s*${STOP_LABEL_PATTERN}\\s*[:\\-]?`, "i").exec(tail);
  return stopMatch ? tail.slice(0, stopMatch.index) : tail;
}

function cleanupClinicalText(value: string) {
  const lines = normalizeWhitespace(value)
    .split(/\n+/)
    .map(cleanOcrLine)
    .filter(Boolean)
    .filter((line) => !isAdministrativeLine(line));

  return lines
    .join(" ")
    .replace(/\b(?:impression|impressions|conclusion|diagnosis|interpretation|findings?|result|remarks?)\s*[:\-]?\s*/gi, " ")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, "")
    .trim();
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

function extractChestXrayFields(rawText: string) {
  const cleanedLines = normalizeWhitespace(rawText)
    .split(/\n+/)
    .map(cleanOcrLine)
    .filter(Boolean);
  const cleanedText = cleanedLines.join("\n");

  for (const section of SECTION_LABELS) {
    const sectionText = cleanupClinicalText(extractSectionText(cleanedText, section.pattern));
    if (sectionText) {
      return {
        findings: sectionText,
        result: inferXrayResult(sectionText) || inferXrayResult(cleanedText),
      };
    }
  }

  const fallbackFindings = getFallbackFindings(cleanedLines);
  return {
    findings: fallbackFindings,
    result: inferXrayResult(fallbackFindings) || inferXrayResult(cleanedText),
  };
}

function getGoogleVisionConfig() {
  const rawJson =
    Deno.env.get("GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON") ||
    Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") ||
    "";
  let parsed: Record<string, string> = {};

  if (rawJson.trim()) {
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new GoogleVisionConfigurationError("GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
  }

  const projectId = String(
    parsed.project_id ||
      parsed.projectId ||
      Deno.env.get("GOOGLE_CLOUD_PROJECT_ID") ||
      Deno.env.get("GOOGLE_PROJECT_ID") ||
      "",
  ).trim();
  const clientEmail = String(
    parsed.client_email ||
      parsed.clientEmail ||
      Deno.env.get("GOOGLE_CLOUD_CLIENT_EMAIL") ||
      "",
  ).trim();
  const privateKey = String(
    parsed.private_key ||
      parsed.privateKey ||
      Deno.env.get("GOOGLE_CLOUD_PRIVATE_KEY") ||
      "",
  )
    .replace(/\\n/g, "\n")
    .trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new GoogleVisionConfigurationError(
      "Google Cloud Vision is not configured. Set GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON or GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_CLIENT_EMAIL, and GOOGLE_CLOUD_PRIVATE_KEY.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64UrlEncode(input: string | Uint8Array | ArrayBuffer) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : input;
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function createServiceAccountJwt(config: { clientEmail: string; privateKey: string }) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const claim = {
    iss: config.clientEmail,
    scope: GOOGLE_VISION_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(config.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function getGoogleAccessToken() {
  const now = Date.now();
  if (googleAccessTokenCache && googleAccessTokenCache.expiresAt > now + 60_000) {
    return googleAccessTokenCache.token;
  }

  const config = getGoogleVisionConfig();
  const assertion = await createServiceAccountJwt(config);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.access_token) {
    const message = payload?.error_description || payload?.error || "Unable to authenticate with Google Cloud Vision.";
    throw new Error(message);
  }

  const expiresIn = Number(payload.expires_in || 3600);
  googleAccessTokenCache = {
    token: payload.access_token,
    expiresAt: now + Math.max(60, expiresIn - 60) * 1000,
  };

  return payload.access_token;
}

export function resolveVisionInputMimeType(mimeType?: string | null, fileName?: string | null) {
  const normalized = String(mimeType || "").split(";")[0].trim().toLowerCase();
  const name = String(fileName || "").toLowerCase();

  if (normalized === "application/pdf" || name.endsWith(".pdf")) return "application/pdf";
  if (normalized === "image/tiff" || normalized === "image/tif" || /\.(tiff?|tif)$/i.test(name)) return "image/tiff";
  if (normalized === "image/gif" || name.endsWith(".gif")) return "image/gif";
  if (normalized.startsWith("image/")) return normalized;
  if (/\.(png)$/i.test(name)) return "image/png";
  if (/\.(jpe?g)$/i.test(name)) return "image/jpeg";
  if (/\.(webp)$/i.test(name)) return "image/webp";
  if (/\.(bmp)$/i.test(name)) return "image/bmp";

  return "";
}

function isFileAnnotationMimeType(mimeType: string) {
  return ["application/pdf", "image/tiff", "image/gif"].includes(mimeType);
}

function getVisionError(payload: any) {
  const topLevelError = payload?.error?.message || payload?.error;
  if (topLevelError) return String(topLevelError);

  const responseError = payload?.responses?.[0]?.error?.message;
  if (responseError) return String(responseError);

  const pageError = payload?.responses?.[0]?.responses?.find((item: any) => item?.error?.message)?.error?.message;
  if (pageError) return String(pageError);

  return "";
}

function extractTextFromImageAnnotation(response: any) {
  return String(
    response?.fullTextAnnotation?.text ||
      response?.textAnnotations?.[0]?.description ||
      "",
  ).trim();
}

function collectConfidenceValues(node: any) {
  const values: number[] = [];
  const stack = [node];

  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== "object") continue;

    const confidence = Number(item.confidence);
    if (Number.isFinite(confidence)) {
      values.push(confidence > 1 ? confidence / 100 : confidence);
    }

    for (const value of Object.values(item)) {
      if (Array.isArray(value)) {
        stack.push(...value);
      } else if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return values;
}

function averageConfidencePercent(...nodes: any[]) {
  const values = nodes.flatMap((node) => collectConfidenceValues(node));
  if (!values.length) return undefined;

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(Math.min(Math.max(average, 0), 1) * 100);
}

async function callGoogleVision(path: string, body: Record<string, unknown>) {
  const token = await getGoogleAccessToken();
  const response = await fetch(`${GOOGLE_VISION_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  const visionError = getVisionError(payload);

  if (!response.ok || visionError) {
    throw new Error(visionError || `Google Cloud Vision request failed (${response.status}).`);
  }

  return payload;
}

async function annotateImage(contentBase64: string, projectId: string) {
  const payload = await callGoogleVision(`/projects/${encodeURIComponent(projectId)}/images:annotate`, {
    requests: [
      {
        image: { content: contentBase64 },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      },
    ],
  });
  const response = payload?.responses?.[0] || {};
  const rawText = extractTextFromImageAnnotation(response);

  return {
    confidence: averageConfidencePercent(response?.fullTextAnnotation),
    pageCount: rawText ? 1 : 0,
    rawText,
    source: "google-vision-image" as const,
  };
}

async function annotateFile(contentBase64: string, mimeType: string, projectId: string) {
  const payload = await callGoogleVision(`/projects/${encodeURIComponent(projectId)}/files:annotate`, {
    requests: [
      {
        inputConfig: {
          content: contentBase64,
          mimeType,
        },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      },
    ],
  });
  const fileResponse = payload?.responses?.[0] || {};
  const pageResponses = Array.isArray(fileResponse?.responses) ? fileResponse.responses : [];
  const rawText = pageResponses
    .map((response) => extractTextFromImageAnnotation(response))
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return {
    confidence: averageConfidencePercent(...pageResponses.map((response) => response?.fullTextAnnotation)),
    pageCount: Number(fileResponse?.totalPages || pageResponses.length || 0),
    rawText,
    source: "google-vision-pdf" as const,
  };
}

export async function readChestXrayWithGoogleVision(input: {
  content: ArrayBuffer | Uint8Array;
  fileName?: string | null;
  mimeType: string;
}) {
  const config = getGoogleVisionConfig();
  const bytes = input.content instanceof Uint8Array ? input.content : new Uint8Array(input.content);
  const contentBase64 = bytesToBase64(bytes);
  const mimeType = resolveVisionInputMimeType(input.mimeType, input.fileName);

  if (!mimeType) {
    throw new Error("Unsupported Chest X-Ray file type. Upload a PDF or image file.");
  }

  const visionResult = isFileAnnotationMimeType(mimeType)
    ? await annotateFile(contentBase64, mimeType, config.projectId)
    : await annotateImage(contentBase64, config.projectId);
  const fields = extractChestXrayFields(visionResult.rawText);

  return {
    confidence: visionResult.confidence,
    findings: fields.findings,
    pageCount: visionResult.pageCount,
    rawText: visionResult.rawText,
    result: fields.result,
    source: visionResult.source,
  };
}
