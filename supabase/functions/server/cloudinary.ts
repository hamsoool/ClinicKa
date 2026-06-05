// @ts-nocheck

const CLOUDINARY_UPLOAD_RESOURCE_TYPE = "auto";
const DEFAULT_CLOUDINARY_BASE_FOLDER = "clinicka";
const CLOUDINARY_UPLOAD_FOLDERS = {
  announcement: ["announcements"],
  "profile-photo": ["profile", "student_photo"],
  "student-signature": ["profile", "student_signature"],
  "staff-signature": ["staff-signature"],
} as const;
export const CLOUDINARY_LAB_UPLOAD_TYPES = ["cbc", "urinalysis", "xray"] as const;
const CLOUDINARY_LAB_UPLOAD_FOLDERS = {
  cbc: ["labs", "cbc"],
  urinalysis: ["labs", "urinalysis"],
  xray: ["labs", "xray"],
} as const;

export type CloudinaryUploadKind =
  | "announcement"
  | "profile-photo"
  | "student-signature"
  | "staff-signature"
  | "lab";
export type CloudinaryLabUploadType = (typeof CLOUDINARY_LAB_UPLOAD_TYPES)[number];

export type CloudinaryUploadTicketInput = {
  kind: CloudinaryUploadKind;
  ownerId: string;
  fileName?: string | null;
  extra?: Record<string, string | number | null | undefined>;
};

export type CloudinaryUploadResponse = {
  asset_folder: string | null;
  bytes: number;
  folder: string | null;
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

export function isCloudinaryLabUploadType(value: unknown): value is CloudinaryLabUploadType {
  return CLOUDINARY_LAB_UPLOAD_TYPES.includes(String(value || "").trim().toLowerCase() as CloudinaryLabUploadType);
}

function resolveCloudinaryLabUploadType(value: unknown) {
  if (isCloudinaryLabUploadType(value)) return value;
  throw new Error("Unsupported Cloudinary lab upload type.");
}

function getKindFolder(kind: CloudinaryUploadKind, _ownerId: string, extra: Record<string, any>) {
  const { baseFolder } = getCloudinaryConfig();
  const pathSegments = kind === "lab"
    ? CLOUDINARY_LAB_UPLOAD_FOLDERS[resolveCloudinaryLabUploadType(extra?.labType)]
    : CLOUDINARY_UPLOAD_FOLDERS[kind];

  return [baseFolder, ...pathSegments].join("/");
}

function getKindPrefix(kind: CloudinaryUploadKind, extra: Record<string, any>) {
  if (kind === "profile-photo") return "photo";
  if (kind === "student-signature" || kind === "staff-signature") return "signature";
  if (kind === "announcement") return "announcement";
  return resolveCloudinaryLabUploadType(extra?.labType);
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
  const prefix = getKindPrefix(kind, extra);
  const name = sanitizeCloudinaryFileName(safeFileName, prefix);
  return `${prefix}_${Date.now()}_${name}`;
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
    asset_folder: folder,
    context: contextString,
    overwrite: "true",
    public_id: publicId,
    tags,
    timestamp,
    use_asset_folder_as_public_id_prefix: "true",
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
    assetFolder: folder,
    publicId,
    resourceType: CLOUDINARY_UPLOAD_RESOURCE_TYPE,
    context,
    contextString,
    tags,
    overwrite: true,
    useAssetFolderAsPublicIdPrefix: true,
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
    asset_folder: String(payload?.asset_folder || "").trim() || null,
    bytes: normalizeCloudinaryNumber(payload?.bytes),
    folder: String(payload?.folder || "").trim() || null,
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

function buildCloudinaryFormFields(ticket: any) {
  const fields: Record<string, string> = {
    api_key: String(ticket.apiKey),
    timestamp: String(ticket.timestamp),
    signature: String(ticket.signature),
    public_id: String(ticket.publicId),
  };
  if (ticket.assetFolder) fields.asset_folder = String(ticket.assetFolder);
  if (ticket.contextString) fields.context = String(ticket.contextString);
  if (ticket.tags) fields.tags = String(ticket.tags);
  if (ticket.overwrite !== undefined) fields.overwrite = String(Boolean(ticket.overwrite));
  if (ticket.useAssetFolderAsPublicIdPrefix !== undefined) {
    fields.use_asset_folder_as_public_id_prefix = String(Boolean(ticket.useAssetFolderAsPublicIdPrefix));
  }
  return fields;
}

function escapeMultipartValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r|\n/g, " ");
}

function buildStreamingMultipartBody(
  fields: Record<string, string>,
  file: File,
) {
  const encoder = new TextEncoder();
  const boundary = `----clinicka-${crypto.randomUUID()}`;
  const fieldChunks = Object.entries(fields).map(([key, value]) =>
    encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="${escapeMultipartValue(key)}"\r\n\r\n${value}\r\n`,
    )
  );
  const fileName = escapeMultipartValue(file.name || "upload");
  const mimeType = String(file.type || "application/octet-stream").trim() || "application/octet-stream";
  const fileHeader = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const closingBoundary = encoder.encode(`\r\n--${boundary}--\r\n`);
  const preludeChunks = [...fieldChunks, fileHeader];
  const fileReader = file.stream().getReader();
  let preludeIndex = 0;
  let fileDone = false;
  let closingSent = false;

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (preludeIndex < preludeChunks.length) {
          controller.enqueue(preludeChunks[preludeIndex]);
          preludeIndex += 1;
          return;
        }

        if (!fileDone) {
          const { value, done } = await fileReader.read();
          if (!done) {
            controller.enqueue(value);
            return;
          }
          fileDone = true;
        }

        if (!closingSent) {
          controller.enqueue(closingBoundary);
          closingSent = true;
          return;
        }

        controller.close();
      },
      cancel() {
        return fileReader.cancel();
      },
    }),
  };
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
  const multipartUpload = buildStreamingMultipartBody(
    buildCloudinaryFormFields(ticket),
    file,
  );

  const response = await fetch(ticket.uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": multipartUpload.contentType,
    },
    body: multipartUpload.body,
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
