// @ts-nocheck

const CLOUDINARY_UPLOAD_RESOURCE_TYPE = "auto";
const DEFAULT_CLOUDINARY_BASE_FOLDER = "clinicka";

export type CloudinaryUploadKind =
  | "announcement"
  | "profile-photo"
  | "student-signature"
  | "staff-signature"
  | "lab";

export type CloudinaryUploadTicketInput = {
  kind: CloudinaryUploadKind;
  ownerId: string;
  fileName?: string | null;
  extra?: Record<string, string | number | null | undefined>;
};

export type CloudinaryUploadResponse = {
  bytes: number;
  format: string | null;
  original_filename: string | null;
  public_id: string;
  resource_type: string;
  secure_url: string;
  signature: string | null;
  version: string;
};

export class CloudinaryConfigurationError extends Error {}

export class CloudinaryRequestError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

function requiredEnv(name: string) {
  return String(Deno.env.get(name) || "").trim();
}

function normalizeBaseFolder(value?: string | null) {
  return sanitizeCloudinaryPath(String(value || DEFAULT_CLOUDINARY_BASE_FOLDER).trim()) ||
    DEFAULT_CLOUDINARY_BASE_FOLDER;
}

export function getCloudinaryConfig() {
  const cloudName = requiredEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requiredEnv("CLOUDINARY_API_KEY");
  const apiSecret = requiredEnv("CLOUDINARY_API_SECRET");
  const baseFolder = normalizeBaseFolder(Deno.env.get("CLOUDINARY_BASE_FOLDER"));

  if (!cloudName || !apiKey || !apiSecret) {
    throw new CloudinaryConfigurationError(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Supabase Edge Function secrets.",
    );
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    baseFolder,
  };
}

export function isCloudinaryEnabled() {
  try {
    getCloudinaryConfig();
    return true;
  } catch {
    return false;
  }
}

function sanitizeCloudinarySegment(value?: string | null, fallback = "item") {
  const cleaned = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function sanitizeCloudinaryPath(value?: string | null) {
  return String(value || "")
    .split("/")
    .map((segment) => sanitizeCloudinarySegment(segment, ""))
    .filter(Boolean)
    .join("/");
}

export function sanitizeCloudinaryFileName(fileName?: string | null, fallback = "file") {
  const cleaned = sanitizeCloudinarySegment(fileName, fallback);
  const withoutExtension = cleaned.replace(/\.[^.]+$/, "");
  return withoutExtension || fallback;
}

function getKindFolder(kind: CloudinaryUploadKind, ownerId: string, extra: Record<string, any>) {
  const { baseFolder } = getCloudinaryConfig();
  const ownerSegment = sanitizeCloudinarySegment(ownerId, "owner");

  if (kind === "announcement") return `${baseFolder}/announcements/${ownerSegment}`;
  if (kind === "profile-photo") return `${baseFolder}/profile/${ownerSegment}`;
  if (kind === "student-signature") return `${baseFolder}/student-signature/${ownerSegment}`;
  if (kind === "staff-signature") return `${baseFolder}/staff-signature/${ownerSegment}`;

  const labType = sanitizeCloudinarySegment(extra?.labType || "lab", "lab");
  return `${baseFolder}/labs/${labType}/${ownerSegment}`;
}

function getKindPrefix(kind: CloudinaryUploadKind, extra: Record<string, any>) {
  if (kind === "profile-photo") return "photo";
  if (kind === "student-signature" || kind === "staff-signature") return "signature";
  if (kind === "announcement") return "announcement";
  return sanitizeCloudinarySegment(extra?.labType || "lab", "lab");
}

export function buildCloudinaryFolder(
  kind: CloudinaryUploadKind,
  ownerId: string,
  extra: Record<string, any> = {},
) {
  return getKindFolder(kind, ownerId, extra);
}

export function buildCloudinaryPublicId(
  kind: CloudinaryUploadKind,
  ownerId: string,
  safeFileName?: string | null,
  extra: Record<string, any> = {},
) {
  const folder = buildCloudinaryFolder(kind, ownerId, extra);
  const prefix = getKindPrefix(kind, extra);
  const name = sanitizeCloudinaryFileName(safeFileName, prefix);
  return `${folder}/${prefix}_${Date.now()}_${name}`;
}

function encodeContextValue(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/=/g, "\\=");
}

function buildContextString(context: Record<string, unknown>) {
  return Object.entries(context)
    .filter(([, value]) => String(value ?? "").trim())
    .map(([key, value]) => `${key}=${encodeContextValue(value)}`)
    .join("|");
}

async function sha1Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeSignableParams(params: Record<string, unknown>) {
  return Object.entries(params)
    .filter(([key, value]) => {
      if (["file", "cloud_name", "resource_type", "api_key", "signature"].includes(key)) {
        return false;
      }
      return value !== undefined && value !== null && String(value).trim() !== "";
    })
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right));
}

export async function signCloudinaryUpload(params: Record<string, unknown>) {
  const { apiSecret } = getCloudinaryConfig();
  const payload = normalizeSignableParams(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return sha1Hex(`${payload}${apiSecret}`);
}

export async function createCloudinaryUploadTicket(input: CloudinaryUploadTicketInput) {
  const config = getCloudinaryConfig();
  const extra = input.extra || {};
  const folder = buildCloudinaryFolder(input.kind, input.ownerId, extra);
  const publicId = buildCloudinaryPublicId(input.kind, input.ownerId, input.fileName, extra);
  const timestamp = Math.floor(Date.now() / 1000);
  const context = {
    kind: input.kind,
    owner_id: input.ownerId,
    ...extra,
  };
  const contextString = buildContextString(context);
  const tags = ["clinicka", input.kind, extra?.labType]
    .map((tag) => sanitizeCloudinarySegment(tag, ""))
    .filter(Boolean)
    .join(",");
  const signedParams = {
    context: contextString,
    overwrite: "true",
    public_id: publicId,
    tags,
    timestamp,
  };
  const signature = await signCloudinaryUpload(signedParams);

  return {
    success: true,
    provider: "cloudinary",
    cloudName: config.cloudName,
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/${CLOUDINARY_UPLOAD_RESOURCE_TYPE}/upload`,
    timestamp,
    signature,
    apiKey: config.apiKey,
    folder,
    publicId,
    resourceType: CLOUDINARY_UPLOAD_RESOURCE_TYPE,
    context,
    contextString,
    tags,
    overwrite: true,
  };
}

function normalizeCloudinaryNumber(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

export function normalizeCloudinaryUploadResponse(payload: any): CloudinaryUploadResponse | null {
  const publicId = String(payload?.public_id || "").trim();
  const secureUrl = String(payload?.secure_url || payload?.url || "").trim();
  const resourceType = String(payload?.resource_type || "").trim();
  const version = String(payload?.version || "").trim();

  if (!publicId || !secureUrl || !resourceType || !version) return null;

  return {
    bytes: normalizeCloudinaryNumber(payload?.bytes),
    format: String(payload?.format || "").trim() || null,
    original_filename: String(payload?.original_filename || "").trim() || null,
    public_id: publicId,
    resource_type: resourceType,
    secure_url: secureUrl,
    signature: String(payload?.signature || "").trim() || null,
    version,
  };
}

export async function verifyCloudinaryUploadResponse(payload: any) {
  const normalized = normalizeCloudinaryUploadResponse(payload);
  if (!normalized?.signature) return false;

  const { apiSecret } = getCloudinaryConfig();
  const expected = await sha1Hex(
    `public_id=${normalized.public_id}&version=${normalized.version}${apiSecret}`,
  );
  return expected === normalized.signature;
}

function appendCloudinaryFormFields(formData: FormData, ticket: any) {
  formData.set("api_key", ticket.apiKey);
  formData.set("timestamp", String(ticket.timestamp));
  formData.set("signature", ticket.signature);
  formData.set("public_id", ticket.publicId);
  if (ticket.contextString) formData.set("context", ticket.contextString);
  if (ticket.tags) formData.set("tags", ticket.tags);
  if (ticket.overwrite !== undefined) formData.set("overwrite", String(Boolean(ticket.overwrite)));
}

async function readCloudinaryError(response: Response) {
  const raw = await response.text().catch(() => "");
  try {
    const payload = raw ? JSON.parse(raw) : null;
    return String(payload?.error?.message || payload?.message || payload?.error || raw || response.statusText).trim();
  } catch {
    return String(raw || response.statusText || "Cloudinary request failed.").trim();
  }
}

export async function uploadFileToCloudinary(file: File, input: CloudinaryUploadTicketInput) {
  const ticket = await createCloudinaryUploadTicket(input);
  const formData = new FormData();
  formData.set("file", file);
  appendCloudinaryFormFields(formData, ticket);

  const response = await fetch(ticket.uploadUrl, {
    method: "POST",
    body: formData,
  });
  const rawText = await response.text().catch(() => "");
  let rawPayload: any = null;
  try {
    rawPayload = rawText ? JSON.parse(rawText) : null;
  } catch {
    rawPayload = null;
  }

  if (!response.ok) {
    const detail = rawPayload
      ? String(rawPayload?.error?.message || rawPayload?.message || rawPayload?.error || "").trim()
      : rawText;
    throw new CloudinaryRequestError(detail || "Cloudinary upload failed.", response.status);
  }

  const upload = normalizeCloudinaryUploadResponse(rawPayload);
  if (!upload) {
    throw new CloudinaryRequestError("Cloudinary upload response was missing required metadata.");
  }

  return { ticket, upload };
}

export function isCloudinaryFile(file: any) {
  const provider = String(file?.storage_provider || "").trim().toLowerCase();
  const publicId = String(file?.cloudinary_public_id || "").trim();
  const url = String(file?.url || "").trim();
  return provider === "cloudinary" || Boolean(publicId) || /res\.cloudinary\.com/i.test(url);
}

export function buildCloudinaryDeliveryUrl(file: any) {
  const url = String(file?.url || "").trim();
  if (/^https?:\/\//i.test(url)) return url;

  const publicId = String(file?.cloudinary_public_id || "").trim();
  if (!publicId) return null;

  try {
    const { cloudName } = getCloudinaryConfig();
    const resourceType = String(file?.cloudinary_resource_type || "image").trim() || "image";
    const version = String(file?.cloudinary_version || "").trim();
    const encodedPublicId = publicId
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const versionPath = version ? `v${version}/` : "";
    return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${versionPath}${encodedPublicId}`;
  } catch {
    return null;
  }
}

export async function destroyCloudinaryAsset(publicId?: string | null, resourceType?: string | null) {
  const normalizedPublicId = String(publicId || "").trim();
  if (!normalizedPublicId) return;

  const config = getCloudinaryConfig();
  const normalizedResourceType = String(resourceType || "image").trim() || "image";
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    invalidate: "true",
    public_id: normalizedPublicId,
    timestamp,
  };
  const signature = await signCloudinaryUpload(params);
  const body = new URLSearchParams({
    api_key: config.apiKey,
    invalidate: "true",
    public_id: normalizedPublicId,
    signature,
    timestamp: String(timestamp),
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/${normalizedResourceType}/destroy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    throw new CloudinaryRequestError(await readCloudinaryError(response), response.status);
  }
}
