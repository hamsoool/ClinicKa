// @ts-nocheck
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import {
  badRequest,
  buildCorsHeaders,
  forbidden,
  getManagedPasswordPolicyError,
  internalServerError,
  isAdminRole,
  isDoctorOrAdmin,
  isDoctorPosition,
  isStaffRole,
  isSuperAdminRole,
  normalizeEmail,
  requestLoggingEnabled,
  resolveCorsOrigin,
  supabase,
  unauthorized,
} from "./context.ts";
import type { Requester } from "./context.ts";
import { sendStatusNotificationEmail } from "./notifications.ts";
import {
  archivedAccountsMigrationRequired,
  authenticate,
  clearArchivedAuthState,
  deriveStudentIdFromEmail,
  formatStaffDisplayName,
  getArchivedAccountsTableState,
  getArchivedUserIds,
  invalidateArchivedCaches,
  isRejectedGoogleUser,
  loadStaffUsersByIds,
  purgeRejectedGoogleUser,
  reassignAdministratorOwnedRows,
  requireActiveRequester,
  roleLabel,
  setArchivedAuthState,
} from "./requester.ts";
import {
  getAdminSystemSettings,
  getSafeAdminSystemSettings,
  saveAdminSystemSettings,
  getStudentNotificationStateKey,
  normalizeStudentNotificationState,
} from "./settings.ts";
import {
  deleteStoredFiles,
  normalizeFileRows,
  normalizeProfileAssetRows,
  normalizeStaffSignatureRows,
} from "./storage.ts";
import {
  CloudinaryConfigurationError,
  CloudinaryRequestError,
  type CloudinaryLabUploadType,
  buildCloudinaryFolder,
  createCloudinaryUploadTicket,
  destroyCloudinaryAsset,
  isCloudinaryLabUploadType,
  isCloudinaryFile,
  normalizeCloudinaryUploadResponse,
  uploadFileToCloudinary,
  verifyCloudinaryUploadResponse,
} from "./cloudinary.ts";
import {
  OcrSpaceConfigurationError,
  OcrSpaceRequestError,
  readCbcWithOcrSpace,
  readChestXrayWithOcrSpace,
  readUrinalysisWithOcrSpace,
  resolveOcrSpaceInputMimeType,
} from "./ocr-space-ocr.ts";
import {
  getCachedAnalyticsSummary,
  getCachedApprovedStudents,
  getCachedStaffDashboardOverview,
  getCachedStaffSubmissionReportSummaries,
  getCachedStaffSubmissionSummaries,
  getCachedStudentRecords,
  getCachedSubmissionsList,
  getMappedSubmissions,
  invalidateDashboardReadCaches,
  invalidateStudentRecordsCache,
  requireSubmissionAccess,
  SUBMISSION_LIST_COLUMNS,
} from "./submissions.ts";
import { getCachedData, setCachedData } from "./redis.ts";

const app = new Hono().basePath("/server");

const PAYLOAD_SECRET = Deno.env.get("API_PAYLOAD_SECRET") || "default-secret-key-must-be-32-by";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getCryptoKey(secret: string) {
  let keyBytes = encoder.encode(secret);
  if (keyBytes.length < 32) {
    const padded = new Uint8Array(32);
    padded.set(keyBytes);
    keyBytes = padded;
  } else if (keyBytes.length > 32) {
    keyBytes = keyBytes.slice(0, 32);
  }
  return await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptPayload(data: any, secret: string): Promise<string> {
  const key = await getCryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = encoder.encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  let binString = "";
  for (let i = 0; i < combined.length; i++) {
    binString += String.fromCharCode(combined[i]);
  }
  return btoa(binString);
}

async function decryptPayload(encryptedBase64: string, secret: string): Promise<any> {
  const key = await getCryptoKey(secret);
  const binString = atob(encryptedBase64);
  const combined = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    combined[i] = binString.charCodeAt(i);
  }
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decryptedBytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(decoder.decode(decryptedBytes));
}

const OCR_SPACE_DEFAULT_MAX_BYTES = 1 * 1024 * 1024;
const LAB_UPLOAD_DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const ANNOUNCEMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const STAFF_SIGNATURE_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_ASSET_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_ASSET_ALLOWED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "heic",
  "heif",
  "webp",
]);
const PROFILE_SELECT_COLUMNS = "id,role,email,password_setup_completed,student_id,first_name,last_name,department,course,created_at,updated_at";
const STUDENT_SELECT_COLUMNS = "student_id,profile_id,first_name,last_name,middle_initial,department,course,year_level,age,sex,birthday,civil_status,contact_number,address,profile_photo_url,profile_photo_file_name,signature_url,signature_file_name,media_updated_at";
const STAFF_PROFILE_SELECT_COLUMNS = "id,profile_id,email,first_name,last_name,middle_initial,position,phone,is_active";
const ARCHIVED_ACCOUNT_SELECT_COLUMNS = "id,user_id,role,email,display_name,account_identifier,archive_reason,archived_at,snapshot";
const ARCHIVE_PROFILE_SELECT_COLUMNS = "id,role,email,first_name,last_name,department,course,student_id";
const ARCHIVE_STAFF_SELECT_COLUMNS = "id,profile_id,email,first_name,last_name,position,is_active";
const ARCHIVE_STUDENT_SELECT_COLUMNS = "student_id,profile_id,first_name,last_name,department,course,year_level";
const FILE_SELECT_COLUMNS = "id,submission_id,type,file_name,mime_type,url,storage_bucket,storage_path,storage_provider,cloudinary_public_id,cloudinary_resource_type,cloudinary_version,cloudinary_folder,uploaded_at,uploaded_by";
const FILE_SELECT_COLUMNS_LEGACY = "id,submission_id,type,file_name,mime_type,url,storage_bucket,storage_path,uploaded_at,uploaded_by";

function normalizeAcademicYear(value: unknown, fallback = "") {
  const match = String(value || "").trim().match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (!match) return fallback;
  const startYear = Number.parseInt(match[1], 10);
  const endYear = Number.parseInt(match[2], 10);
  return Number.isFinite(startYear) && endYear - startYear === 1
    ? `${startYear}-${endYear}`
    : fallback;
}

function normalizeSubmissionSlot(value: unknown) {
  const slot = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(slot) && slot >= 1 && slot <= 4 ? slot : null;
}

function inferAcademicYearFromDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const startYear = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function getSubmissionRowAcademicYear(row: any, fallback = "") {
  return normalizeAcademicYear(row?.academic_year, "") || inferAcademicYearFromDate(row?.submitted_at) || fallback;
}

function getNextSubmissionSlot(rows: any[], academicYear: string) {
  const currentAcademicYearRow = [...(rows || [])]
    .filter((row) => getSubmissionRowAcademicYear(row, academicYear) === academicYear)
    .sort(
      (a, b) =>
        new Date(b?.updated_at || b?.submitted_at || 0).getTime() -
        new Date(a?.updated_at || a?.submitted_at || 0).getTime(),
    )[0];
  const currentSlot = normalizeSubmissionSlot(currentAcademicYearRow?.year_level);
  if (currentSlot) return currentSlot;

  const maxSlot = (rows || []).reduce((max, row) => {
    const slot = normalizeSubmissionSlot(row?.year_level);
    return slot ? Math.max(max, slot) : max;
  }, 0);
  return maxSlot >= 4 ? null : maxSlot + 1;
}

class UploadValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function isSupportedOcrFile(file: any) {
  return Boolean(
    isCloudinaryFile(file) &&
    resolveOcrSpaceInputMimeType(
      file?.mime_type,
      file?.file_name || file?.storage_path || file?.url,
    ),
  );
}

function getOcrSpaceMaxBytes() {
  const configuredMaxBytes = Number(Deno.env.get("OCR_SPACE_MAX_BYTES") || "");
  return Number.isFinite(configuredMaxBytes) && configuredMaxBytes > 0
    ? Math.floor(configuredMaxBytes)
    : OCR_SPACE_DEFAULT_MAX_BYTES;
}

function getLabUploadMaxBytes() {
  const configuredMaxBytes = Number(Deno.env.get("LAB_UPLOAD_MAX_BYTES") || "");
  return Number.isFinite(configuredMaxBytes) && configuredMaxBytes > 0
    ? Math.floor(configuredMaxBytes)
    : LAB_UPLOAD_DEFAULT_MAX_BYTES;
}

function formatFileSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}

function resolveLabUploadMimeType(mimeType?: string | null, fileName?: string | null) {
  const ocrMimeType = resolveOcrSpaceInputMimeType(mimeType, fileName);
  if (ocrMimeType) return ocrMimeType;
  const normalized = String(mimeType || "").split(";")[0].trim().toLowerCase();
  const name = String(fileName || "").toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  if (normalized.startsWith("image/")) return normalized;
  if (normalized === "image/heic" || name.endsWith(".heic")) return "image/heic";
  if (normalized === "image/heif" || name.endsWith(".heif")) return "image/heif";
  if (name.endsWith(".avif")) return "image/avif";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".png")) return "image/png";
  if (/\.(jpe?g)$/i.test(name)) return "image/jpeg";
  if (name.endsWith(".gif")) return "image/gif";
  if (/\.(tiff?|bmp)$/i.test(name)) return "image/*";
  return "";
}

function runBackgroundTask(label: string, task: () => Promise<void>) {
  const promise = Promise.resolve()
    .then(task)
    .catch((error) => {
      console.log(`${label} warning:`, error);
    });
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === "function") {
    edgeRuntime.waitUntil(promise);
  }
}

async function cleanupStaleLabFiles(staleFiles: any[]) {
  if (!staleFiles.length) return;
  let cleanupError: unknown = null;
  try {
    await deleteStoredFiles(staleFiles);
  } catch (error) {
    cleanupError = error;
  }

  const { error } = await supabase.from("files").delete().in("id", staleFiles.map((item) => item.id));
  if (error) {
    throw new Error(error.message);
  }
  if (cleanupError) {
    throw cleanupError;
  }
}

function isLikelyChestXrayFile(file: any) {
  const type = String(file?.type || "").trim().toLowerCase();
  if (type === "xray") return true;

  const haystack = `${file?.file_name || ""} ${file?.storage_path || ""} ${file?.url || ""}`.toLowerCase();
  return /\b(xray|x-ray|chest|cxr)\b/.test(haystack);
}

function isLikelyCbcFile(file: any) {
  const type = String(file?.type || "").trim().toLowerCase();
  if (type === "cbc") return true;

  const haystack = `${file?.file_name || ""} ${file?.storage_path || ""} ${file?.url || ""}`.toLowerCase();
  return /\b(cbc|complete[-\s]?blood[-\s]?count|hematology|haematology|hemogram|blood[-\s]?count)\b/.test(haystack);
}

function isLikelyUrinalysisFile(file: any) {
  const type = String(file?.type || "").trim().toLowerCase();
  if (type === "urinalysis") return true;

  const haystack = `${file?.file_name || ""} ${file?.storage_path || ""} ${file?.url || ""}`.toLowerCase();
  return /\b(urinalysis|urine|u\/a|ua|routine[-\s]?urine|urine[-\s]?test)\b/.test(haystack);
}

function pickLatestFile(files: any[]) {
  return [...(files || [])].sort((a, b) => {
    const bTime = new Date(b?.uploaded_at || 0).getTime();
    const aTime = new Date(a?.uploaded_at || 0).getTime();
    return bTime - aTime;
  })[0] || null;
}

function normalizeMediaUrl(url?: string | null) {
  const trimmed = String(url || "").trim();
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  try {
    const hostname = new URL(trimmed).hostname.toLowerCase();
    return hostname === "res.cloudinary.com" || hostname.endsWith(".cloudinary.com")
      ? trimmed
      : undefined;
  } catch {
    return undefined;
  }
}

function isSupportedSignatureImage(file: File | null) {
  if (!file) return false;
  const mimeType = String(file.type || "").trim().toLowerCase();
  if (mimeType.startsWith("image/")) return true;
  const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "heic", "heif", "webp"].includes(extension);
}

function isSupportedProfileAssetMimeType(mimeType?: string | null, fileName?: string | null) {
  const normalizedMimeType = String(mimeType || "").split(";")[0].trim().toLowerCase();
  if (normalizedMimeType.startsWith("image/")) return normalizedMimeType;

  const extension = String(fileName || "").split(".").pop()?.toLowerCase() || "";
  return PROFILE_ASSET_ALLOWED_EXTENSIONS.has(extension)
    ? normalizedMimeType || `image/${extension === "jpg" ? "jpeg" : extension}`
    : "";
}

function getCloudinaryPublicIdPrefix(kind: string, fileType?: CloudinaryLabUploadType | null) {
  if (kind === "profile-photo") return "photo";
  if (kind === "student-signature" || kind === "staff-signature") return "signature";
  if (kind === "announcement") return "announcement";
  return fileType || "lab";
}

async function validateCloudinaryUpload(
  payload: any,
  options: {
    kind: "announcement" | "profile-photo" | "student-signature" | "staff-signature" | "lab";
    ownerId: string;
    fileType?: CloudinaryLabUploadType | null;
    maxBytes?: number;
    requireImage?: boolean;
  },
) {
  const upload = normalizeCloudinaryUploadResponse(payload);
  if (!upload) {
    throw new UploadValidationError("Cloudinary upload response is missing required metadata.");
  }

  const verified = await verifyCloudinaryUploadResponse(payload);
  if (!verified) {
    throw new UploadValidationError("Cloudinary upload response could not be verified.");
  }

  const extra = options.kind === "lab"
    ? (() => {
      if (!options.fileType) {
        throw new UploadValidationError("Laboratory upload type is required.");
      }
      return { labType: options.fileType };
    })()
    : {};
  const expectedFolder = buildCloudinaryFolder(options.kind, options.ownerId, extra);
  const expectedPrefix = `${getCloudinaryPublicIdPrefix(options.kind, options.fileType)}_`;
  const normalizedPublicId = String(upload.public_id || "").trim();
  const publicIdWithinFolder = normalizedPublicId.startsWith(`${expectedFolder}/`)
    ? normalizedPublicId.slice(expectedFolder.length + 1)
    : normalizedPublicId;

  if (!publicIdWithinFolder.startsWith(expectedPrefix)) {
    throw new UploadValidationError("Cloudinary upload destination is invalid.");
  }
  const reportedFolder = String(upload.asset_folder || upload.folder || "").trim();
  if (reportedFolder && reportedFolder !== expectedFolder) {
    throw new UploadValidationError("Cloudinary upload folder is invalid.");
  }

  if (!/^https:\/\/res\.cloudinary\.com\//i.test(upload.secure_url)) {
    throw new UploadValidationError("Cloudinary upload URL is invalid.");
  }

  if (!upload.bytes) {
    throw new UploadValidationError("Cloudinary upload size is invalid.");
  }

  if (options.requireImage && upload.resource_type !== "image") {
    throw new UploadValidationError("Uploaded asset must be an image.");
  }

  if (options.maxBytes && upload.bytes > options.maxBytes) {
    throw new UploadValidationError(`Uploaded asset must be ${formatFileSize(options.maxBytes)} or smaller.`);
  }

  return {
    upload,
    folder: expectedFolder,
  };
}

function getMimeTypeFromCloudinaryUpload(upload: any, fallbackMimeType?: string | null, fallbackFileName?: string | null) {
  const normalizedFallback = String(fallbackMimeType || "").split(";")[0].trim().toLowerCase();
  if (normalizedFallback) return normalizedFallback;

  const format = String(upload?.format || "").trim().toLowerCase();
  if (format === "jpg" || format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  if (format === "gif") return "image/gif";
  if (format === "pdf") return "application/pdf";
  if (format === "heic") return "image/heic";
  if (format === "heif") return "image/heif";
  if (format === "avif") return "image/avif";

  return resolveLabUploadMimeType("", fallbackFileName) || "application/octet-stream";
}

function buildCloudinaryFileMetadata(upload: any, folder: string) {
  return {
    storage_provider: "cloudinary",
    cloudinary_public_id: upload.public_id,
    cloudinary_resource_type: upload.resource_type,
    cloudinary_version: upload.version,
    cloudinary_folder: folder,
    storage_bucket: null,
    storage_path: null,
    url: upload.secure_url,
  };
}

function cloudinaryRouteError(c: any, error: unknown) {
  if (error instanceof CloudinaryConfigurationError) {
    return c.json({ error: error.message }, 503);
  }
  if (error instanceof CloudinaryRequestError) {
    return c.json({ error: error.message }, error.status || 502);
  }
  return null;
}

function isMissingFilesTableError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  return (
    message.includes("public.files") ||
    (message.includes("relation") && message.includes("files") && message.includes("does not exist")) ||
    (message.includes("could not find the table") && message.includes("files")) ||
    (message.includes("schema cache") && message.includes("files"))
  );
}

function isMissingCloudinaryFilesColumnError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  return (
    message.includes("schema cache") ||
    message.includes("storage_provider") ||
    message.includes("cloudinary_public_id") ||
    message.includes("cloudinary_resource_type") ||
    message.includes("cloudinary_version") ||
    message.includes("cloudinary_folder")
  );
}

async function selectFilesWithFallback(apply: (query: any) => any) {
  const primary = await apply(supabase.from("files").select(FILE_SELECT_COLUMNS));
  if (!primary.error || !isMissingCloudinaryFilesColumnError(primary.error)) {
    return primary;
  }

  return await apply(supabase.from("files").select(FILE_SELECT_COLUMNS_LEGACY));
}

async function insertFileMetadataWithFallback(payload: Record<string, unknown>) {
  const primary = await supabase
    .from("files")
    .insert(payload)
    .select(FILE_SELECT_COLUMNS)
    .single();

  if (!primary.error || !isMissingCloudinaryFilesColumnError(primary.error)) {
    return primary;
  }

  const fallbackPayload = {
    submission_id: payload.submission_id ?? null,
    type: payload.type ?? null,
    file_name: payload.file_name ?? null,
    mime_type: payload.mime_type ?? null,
    url: payload.url ?? null,
    storage_bucket: payload.storage_bucket ?? null,
    storage_path: payload.storage_path ?? null,
    uploaded_by: payload.uploaded_by ?? null,
  };

  return await supabase
    .from("files")
    .insert(fallbackPayload)
    .select(FILE_SELECT_COLUMNS_LEGACY)
    .single();
}

function isMissingDirectMediaColumnError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  return (
    message.includes("schema cache") ||
    message.includes("column") ||
    message.includes("file_url") ||
    message.includes("profile_photo_url") ||
    message.includes("signature_file_name")
  );
}

async function updateStudentProfileMediaColumns(options: {
  studentId: string;
  fileType: string;
  fileName: string;
  url: string;
}) {
  const targetStudentId = String(options.studentId || "").trim();
  const fileType = String(options.fileType || "").trim().toLowerCase();
  const url = normalizeMediaUrl(options.url);
  if (!targetStudentId || !url) return;

  const payload = fileType === "photo"
    ? {
      profile_photo_url: url,
      profile_photo_file_name: options.fileName || null,
      media_updated_at: new Date().toISOString(),
    }
    : {
      signature_url: url,
      signature_file_name: options.fileName || null,
      media_updated_at: new Date().toISOString(),
    };

  const { error } = await supabase
    .from("students")
    .update(payload)
    .eq("student_id", targetStudentId);

  if (error) {
    if (isMissingDirectMediaColumnError(error)) {
      console.log("Student media columns are not available yet:", error.message);
      return;
    }
    throw new Error(error.message);
  }
}

async function loadStudentProfileMediaColumns(studentId?: string | null, profileId?: string | null) {
  const targetStudentId = String(studentId || "").trim();
  const targetProfileId = String(profileId || "").trim();
  if (!targetStudentId && !targetProfileId) return null;

  let query = supabase
    .from("students")
    .select("profile_photo_url,profile_photo_file_name,signature_url,signature_file_name");

  query = targetStudentId
    ? query.eq("student_id", targetStudentId)
    : query.eq("profile_id", targetProfileId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingDirectMediaColumnError(error)) return null;
    throw new Error(error.message);
  }

  return {
    photoUrl: normalizeMediaUrl(data?.profile_photo_url || null) || null,
    signatureUrl: normalizeMediaUrl(data?.signature_url || null) || null,
    photoFileName: data?.profile_photo_file_name || null,
    signatureFileName: data?.signature_file_name || null,
  };
}

function buildLabFileFromRow(row: any, type: string) {
  const url = normalizeMediaUrl(row?.file_url || null);
  if (!url) return null;

  return {
    id: row?.file_id || `${type}-${row?.submission_id || "file"}`,
    submission_id: row?.submission_id || null,
    type,
    file_name: row?.file_name || `${type}-result`,
    mime_type: row?.mime_type || null,
    storage_provider: "cloudinary",
    storage_bucket: null,
    storage_path: null,
    cloudinary_public_id: row?.cloudinary_public_id || null,
    cloudinary_resource_type: row?.cloudinary_resource_type || "image",
    cloudinary_version: row?.cloudinary_version || null,
    uploaded_at: row?.media_updated_at || null,
    url,
  };
}

async function loadLabOcrRow(table: string, submissionId: string) {
  const primary = await supabase
    .from(table)
    .select("submission_id,file_id,file_url,file_name,mime_type,cloudinary_public_id,cloudinary_resource_type,cloudinary_version,media_updated_at")
    .eq("submission_id", submissionId)
    .maybeSingle();

  if (!primary.error || !isMissingDirectMediaColumnError(primary.error)) {
    return primary;
  }

  return await supabase
    .from(table)
    .select("submission_id,file_id")
    .eq("submission_id", submissionId)
    .maybeSingle();
}

async function upsertLabFileReference(options: {
  labTable: string;
  submissionId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  upload: any;
}) {
  const payload = {
    submission_id: options.submissionId,
    file_id: options.fileId,
    file_url: options.upload?.secure_url || null,
    file_name: options.fileName || options.upload?.public_id || null,
    mime_type: options.mimeType || null,
    cloudinary_public_id: options.upload?.public_id || null,
    cloudinary_resource_type: options.upload?.resource_type || "image",
    cloudinary_version: options.upload?.version || null,
    media_updated_at: new Date().toISOString(),
  };

  const result = await supabase
    .from(options.labTable)
    .upsert(payload);

  if (!result.error || !isMissingDirectMediaColumnError(result.error)) {
    if (result.error) throw new Error(result.error.message);
    return;
  }

  const legacyResult = await supabase
    .from(options.labTable)
    .upsert({ submission_id: options.submissionId, file_id: options.fileId });

  if (legacyResult.error) {
    throw new Error(legacyResult.error.message);
  }
}

async function loadLatestStaffSignature(profileId: string) {
  const targetProfileId = String(profileId || "").trim();
  if (!targetProfileId) return null;

  const filesResponse = await selectFilesWithFallback((query) =>
    query
      .eq("uploaded_by", targetProfileId)
      .is("submission_id", null)
      .order("uploaded_at", { ascending: false })
      .limit(50)
  );

  const { data, error } = filesResponse;

  if (error) throw new Error(error.message);

  const normalizedRows = normalizeStaffSignatureRows(await normalizeFileRows(data || []));
  return pickLatestFile(normalizedRows);
}

async function insertStaffSignatureMetadata(payload: Record<string, unknown>) {
  const { data: insertedFile, error: fileInsertError } = await insertFileMetadataWithFallback({
    ...payload,
    type: "staff_signature",
  });

  if (fileInsertError || !insertedFile) {
    throw new Error(fileInsertError?.message || "Failed to save staff signature metadata");
  }

  return insertedFile;
}

async function completeStaffSignatureUpload(options: {
  profileId: string;
  fileName: string;
  mimeType?: string | null;
  cloudinary: any;
}) {
  const { upload, folder } = await validateCloudinaryUpload(options.cloudinary, {
    kind: "staff-signature",
    ownerId: options.profileId,
    maxBytes: STAFF_SIGNATURE_MAX_BYTES,
    requireImage: true,
  });
  const resolvedMimeType = isSupportedProfileAssetMimeType(
    getMimeTypeFromCloudinaryUpload(upload, options.mimeType, options.fileName),
    options.fileName,
  );

  if (!resolvedMimeType) {
    throw new UploadValidationError("Staff signature must be an image file.");
  }

  const { error: signatureUpdateError } = await supabase
    .from("staff_users")
    .update({
      signature_url: upload.secure_url,
    })
    .eq("profile_id", options.profileId);

  if (signatureUpdateError) {
    throw new Error(signatureUpdateError.message);
  }

  let insertedFile: any = null;
  try {
    insertedFile = await insertStaffSignatureMetadata({
      submission_id: null,
      file_name: options.fileName,
      mime_type: resolvedMimeType || "application/octet-stream",
      ...buildCloudinaryFileMetadata(upload, folder),
      uploaded_by: options.profileId,
    });
  } catch (metadataError) {
    console.log("Staff signature metadata warning:", metadataError);
  }

  try {
    if (insertedFile?.id) {
      const { data: staleRows, error: staleRowsError } = await selectFilesWithFallback((query) =>
        query
          .eq("uploaded_by", options.profileId)
          .is("submission_id", null)
          .neq("id", insertedFile.id)
      );

      if (staleRowsError) {
        throw new Error(staleRowsError.message);
      }

      const staleSignatureRows = normalizeStaffSignatureRows(staleRows || []);
      const staleIds = staleSignatureRows.map((row) => row?.id).filter(Boolean);
      if (staleIds.length) {
        const { error: staleDeleteError } = await supabase.from("files").delete().in("id", staleIds);
        if (staleDeleteError) {
          throw new Error(staleDeleteError.message);
        }
        runBackgroundTask("Staff signature cleanup", async () => {
          await deleteStoredFiles(staleSignatureRows);
        });
      }
    }
  } catch (metadataCleanupError) {
    console.log("Staff signature metadata cleanup warning:", metadataCleanupError);
  }

  invalidateDashboardReadCaches();

  return {
    signatureUrl: upload.secure_url,
    signatureFileName: options.fileName || upload.public_id,
  };
}

async function findChestXrayOcrFile(submissionId: string) {
  const { data: labRow, error: labError } = await loadLabOcrRow("lab_chest_xray", submissionId);

  if (labError) throw new Error(labError.message);

  const directFile = buildLabFileFromRow(labRow, "xray");
  if (directFile && isSupportedOcrFile(directFile)) return directFile;

  const fileId = String(labRow?.file_id || "").trim();
  if (fileId) {
    const { data: linkedFile, error: linkedFileError } = await selectFilesWithFallback((query) =>
      query.eq("id", fileId).maybeSingle()
    );

    if (linkedFileError) throw new Error(linkedFileError.message);
    if (linkedFile && isSupportedOcrFile(linkedFile)) return linkedFile;
  }

  const { data: files, error: filesError } = await selectFilesWithFallback((query) =>
    query
      .eq("submission_id", submissionId)
      .order("uploaded_at", { ascending: false })
  );

  if (filesError) throw new Error(filesError.message);

  const supportedFiles = (files || []).filter(isSupportedOcrFile);
  const typeMatched = supportedFiles.filter((file) => String(file?.type || "").toLowerCase() === "xray");
  if (typeMatched.length) return pickLatestFile(typeMatched);

  const hinted = supportedFiles.filter(isLikelyChestXrayFile);
  if (hinted.length) return pickLatestFile(hinted);

  return supportedFiles.length === 1 ? supportedFiles[0] : null;
}

async function findCbcOcrFile(submissionId: string) {
  const { data: labRow, error: labError } = await loadLabOcrRow("lab_cbc", submissionId);

  if (labError) throw new Error(labError.message);

  const directFile = buildLabFileFromRow(labRow, "cbc");
  if (directFile && isSupportedOcrFile(directFile)) return directFile;

  const fileId = String(labRow?.file_id || "").trim();
  if (fileId) {
    const { data: linkedFile, error: linkedFileError } = await selectFilesWithFallback((query) =>
      query.eq("id", fileId).maybeSingle()
    );

    if (linkedFileError) throw new Error(linkedFileError.message);
    if (linkedFile && isSupportedOcrFile(linkedFile)) return linkedFile;
  }

  const { data: files, error: filesError } = await selectFilesWithFallback((query) =>
    query
      .eq("submission_id", submissionId)
      .order("uploaded_at", { ascending: false })
  );

  if (filesError) throw new Error(filesError.message);

  const supportedFiles = (files || []).filter(isSupportedOcrFile);
  const typeMatched = supportedFiles.filter((file) => String(file?.type || "").toLowerCase() === "cbc");
  if (typeMatched.length) return pickLatestFile(typeMatched);

  const hinted = supportedFiles.filter(isLikelyCbcFile);
  if (hinted.length) return pickLatestFile(hinted);

  return supportedFiles.length === 1 ? supportedFiles[0] : null;
}

async function findUrinalysisOcrFile(submissionId: string) {
  const { data: labRow, error: labError } = await loadLabOcrRow("lab_urinalysis", submissionId);

  if (labError) throw new Error(labError.message);

  const directFile = buildLabFileFromRow(labRow, "urinalysis");
  if (directFile && isSupportedOcrFile(directFile)) return directFile;

  const fileId = String(labRow?.file_id || "").trim();
  if (fileId) {
    const { data: linkedFile, error: linkedFileError } = await selectFilesWithFallback((query) =>
      query.eq("id", fileId).maybeSingle()
    );

    if (linkedFileError) throw new Error(linkedFileError.message);
    if (linkedFile && isSupportedOcrFile(linkedFile)) return linkedFile;
  }

  const { data: files, error: filesError } = await selectFilesWithFallback((query) =>
    query
      .eq("submission_id", submissionId)
      .order("uploaded_at", { ascending: false })
  );

  if (filesError) throw new Error(filesError.message);

  const supportedFiles = (files || []).filter(isSupportedOcrFile);
  const typeMatched = supportedFiles.filter((file) => String(file?.type || "").toLowerCase() === "urinalysis");
  if (typeMatched.length) return pickLatestFile(typeMatched);

  const hinted = supportedFiles.filter(isLikelyUrinalysisFile);
  if (hinted.length) return pickLatestFile(hinted);

  return supportedFiles.length === 1 ? supportedFiles[0] : null;
}

async function fetchFileFromUrl(file: any) {
  if (!isCloudinaryFile(file)) return null;
  const url = String(file?.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;

  const response = await fetch(url);
  if (!response.ok) return null;

  return await response.blob();
}

async function fetchUploadedFileBlob(file: any) {
  return await fetchFileFromUrl(file);
}

async function loadChestXrayOcrInput(file: any) {
  const blob = await fetchUploadedFileBlob(file);
  if (!blob) {
    throw new Error("The Chest X-Ray result file could not be downloaded from storage.");
  }

  const maxOcrBytes = getOcrSpaceMaxBytes();
  if (blob.size > maxOcrBytes) {
    throw new Error(`OCR.space scanning supports files up to ${formatFileSize(maxOcrBytes)} with the configured plan.`);
  }

  const fileName = String(file?.file_name || file?.storage_path || "chest-xray-result").trim();
  const mimeType = resolveOcrSpaceInputMimeType(file?.mime_type || blob.type, fileName);
  if (!mimeType) {
    throw new Error("Unsupported Chest X-Ray file type. Upload a PDF or image file.");
  }

  return {
    content: await blob.arrayBuffer(),
    fileName,
    mimeType,
  };
}

async function loadCbcOcrInput(file: any) {
  const blob = await fetchUploadedFileBlob(file);
  if (!blob) {
    throw new Error("The CBC result file could not be downloaded from storage.");
  }

  const maxOcrBytes = getOcrSpaceMaxBytes();
  if (blob.size > maxOcrBytes) {
    throw new Error(`OCR.space scanning supports files up to ${formatFileSize(maxOcrBytes)} with the configured plan.`);
  }

  const fileName = String(file?.file_name || file?.storage_path || "cbc-result").trim();
  const mimeType = resolveOcrSpaceInputMimeType(file?.mime_type || blob.type, fileName);
  if (!mimeType) {
    throw new Error("Unsupported CBC file type. Upload a PDF or image file.");
  }

  return {
    content: await blob.arrayBuffer(),
    fileName,
    mimeType,
  };
}

async function loadUrinalysisOcrInput(file: any) {
  const blob = await fetchUploadedFileBlob(file);
  if (!blob) {
    throw new Error("The Urinalysis result file could not be downloaded from storage.");
  }

  const maxOcrBytes = getOcrSpaceMaxBytes();
  if (blob.size > maxOcrBytes) {
    throw new Error(`OCR.space scanning supports files up to ${formatFileSize(maxOcrBytes)} with the configured plan.`);
  }

  const fileName = String(file?.file_name || file?.storage_path || "urinalysis-result").trim();
  const mimeType = resolveOcrSpaceInputMimeType(file?.mime_type || blob.type, fileName);
  if (!mimeType) {
    throw new Error("Unsupported Urinalysis file type. Upload a PDF or image file.");
  }

  return {
    content: await blob.arrayBuffer(),
    fileName,
    mimeType,
  };
}

if (requestLoggingEnabled) {
  app.use('*', logger(console.log));
}

app.use(
  "/*",
  cors({
    origin: (origin) => resolveCorsOrigin(origin) || null,
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.use("/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
});

app.use("/*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && c.req.method !== "OPTIONS") {
    const contentType = c.req.header("content-type") || "";
    if (contentType.includes("text/plain")) {
      const rawBody = await c.req.text();
      if (rawBody) {
        try {
          const decrypted = await decryptPayload(rawBody, PAYLOAD_SECRET);
          c.req.json = async () => decrypted;
        } catch (err) {
          console.error("Decryption failed:", err);
          return badRequest("Invalid encrypted payload");
        }
      }
    }
  }

  await next();

  const resContentType = c.res.headers.get("content-type") || "";
  if (resContentType.includes("application/json")) {
    const clone = c.res.clone();
    try {
      const data = await clone.json();
      const encrypted = await encryptPayload(data, PAYLOAD_SECRET);
      const newHeaders = new Headers(c.res.headers);
      newHeaders.set("Content-Type", "text/plain");
      c.res = new Response(encrypted, {
        status: c.res.status,
        headers: newHeaders,
      });
    } catch (e) {
      console.error("Encryption failed:", e);
    }
  }
});

app.options('*', (c) => new Response(null, {
  status: 204,
  headers: buildCorsHeaders(c.req.header('Origin')),
}));

function getRequesterStudentId(requester: Requester) {
  return String(requester.student?.student_id || requester.profile?.student_id || '').trim();
}

function isMissingStudentNotificationsTableError(error: any) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('student_notifications')
    && (message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find the table'))
  );
}

function isDuplicateStudentNotificationError(error: any) {
  return String(error?.code || '').trim() === '23505'
    || String(error?.message || error || '').toLowerCase().includes('duplicate key');
}

function normalizeNotificationTimestamp(value: unknown) {
  const date = new Date(String(value || '').trim());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeStudentNotificationItem(value: any) {
  if (!value || typeof value !== 'object') return null;

  const status = String(value.status || '').trim().toLowerCase();
  if (status !== 'approved' && status !== 'returned') return null;

  const notificationKey = String(value.notificationKey || '').trim();
  const submissionId = String(value.submissionId || '').trim();
  const title = String(value.title || '').trim();
  const message = String(value.message || '').trim();
  const actionLabel = String(value.actionLabel || '').trim();
  const actionPath = String(value.actionPath || '').trim();
  const yearLabel = String(value.yearLabel || '').trim();

  if (!notificationKey || !submissionId || !title || !message || !actionLabel || !actionPath || !yearLabel) {
    return null;
  }

  return {
    notificationKey,
    submissionId,
    status,
    title,
    message,
    note: String(value.note || '').trim() || null,
    actionLabel,
    actionPath,
    yearLabel,
    timestamp: normalizeNotificationTimestamp(value.timestamp),
    read: Boolean(value.read),
  };
}

function mapStudentNotificationRow(row: any) {
  return {
    id: row.id,
    notificationKey: row.notification_key,
    submissionId: row.submission_id,
    status: row.status,
    title: row.title,
    message: row.message,
    note: row.note || '',
    actionLabel: row.action_label,
    actionPath: row.action_path,
    yearLabel: row.year_label,
    timestamp: row.occurred_at,
    read: Boolean(row.is_read),
  };
}

async function listStudentNotifications(studentId: string) {
  const { data, error } = await supabase
    .from('student_notifications')
    .select('id,notification_key,submission_id,status,title,message,note,action_label,action_path,year_label,occurred_at,is_read')
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingStudentNotificationsTableError(error)) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data || []).map(mapStudentNotificationRow);
}

async function findProfileIdForStudentId(studentId: string) {
  const targetStudentId = String(studentId || "").trim();
  if (!targetStudentId) return "";

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("profile_id")
    .eq("student_id", targetStudentId)
    .maybeSingle();

  if (studentError) {
    throw new Error(studentError.message);
  }
  if (student?.profile_id) return student.profile_id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("student_id", targetStudentId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  return profile?.id || "";
}

app.post("/invalidate-cache", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  const { studentId } = await c.req.json().catch(() => ({}));

  invalidateDashboardReadCaches();
  if (studentId) {
    invalidateStudentRecordsCache(studentId);
  }

  return c.json({ success: true });
});

app.get("/health", (c) => c.json({ status: "ok" }));

// Authentication and shared session helpers.
app.post("/auth/reject-google-account", async (c) => {
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return unauthorized();

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return unauthorized();
  }

  const user = authData.user;
  if (!isRejectedGoogleUser(user)) {
    return c.json({ success: true, deleted: false });
  }

  try {
    await purgeRejectedGoogleUser(user);
    return c.json({ success: true, deleted: true });
  } catch (error) {
    console.log('Failed to purge rejected Google user:', error);
    return internalServerError(c, 'Failed to reject unauthorized Google account', error);
  }
});

app.get("/me", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  return c.json({
    profile: requester.profile,
    student: requester.student,
    staff: requester.staff,
  });
});

// Student routes.
app.put("/student-profile", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const data = await c.req.json();
    const studentId = requester.profile.student_id || requester.student?.student_id || data.studentId;

    if (!studentId) {
      return badRequest('Student ID is required');
    }

    const firstName = String(data.firstName || '').trim() || null;
    const lastName = String(data.lastName || '').trim() || null;
    const middleInitial = String(data.middleInitial || '').trim() || null;
    const department = String(data.department || '').trim() || null;
    const course = String(data.course || '').trim() || null;
    const yearLevel = normalizeSubmissionSlot(data.yearLevel);
    const age = data.age ? Number(data.age) : null;
    const sex = String(data.sex || '').trim() || null;
    const birthday = String(data.birthday || '').trim() || null;
    const civilStatus = String(data.civilStatus || '').trim() || null;
    const contactNumber = String(data.contactNumber || '').trim() || null;
    const address = String(data.address || '').trim() || null;

    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        department,
        course,
        student_id: studentId,
      })
      .eq('id', requester.profile.id)
      .select(PROFILE_SELECT_COLUMNS)
      .single();

    if (profileError || !updatedProfile) {
      throw new Error(profileError?.message || 'Failed to update profile');
    }

    const studentPayload = {
      student_id: studentId,
      profile_id: requester.profile.id,
      first_name: firstName,
      last_name: lastName,
      middle_initial: middleInitial,
      department,
      course,
      year_level: yearLevel,
      age: Number.isFinite(age) ? age : null,
      sex,
      birthday,
      civil_status: civilStatus,
      contact_number: contactNumber,
      address,
    };

    const { data: updatedStudent, error: studentError } = await supabase
      .from('students')
      .upsert(studentPayload, {
        onConflict: 'student_id',
      })
      .select(STUDENT_SELECT_COLUMNS)
      .single();

    if (studentError || !updatedStudent) {
      throw new Error(studentError?.message || 'Failed to update student record');
    }

    invalidateDashboardReadCaches();
    invalidateStudentRecordsCache(studentId);

    return c.json({
      success: true,
      profile: updatedProfile,
      student: updatedStudent,
    });
  } catch (error) {
    console.log('Error updating student profile:', error);
    return internalServerError(c, 'Failed to update student profile', error);
  }
});

app.put("/staff-profile", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'staff') return forbidden();

  try {
    const data = await c.req.json();
    let firstName = String(data.firstName || "").trim();
    let lastName = String(data.lastName || "").trim();
    const email = normalizeEmail(data.email) || null;
    const phone = String(data.phone || "").trim() || null;
    const applyAcrossRoles = data.applyAcrossRoles !== false;

    if (!firstName && !lastName && data.name) {
      const nameParts = String(data.name).split(/\s+/).filter(Boolean);
      firstName = nameParts.slice(0, -1).join(" ").trim() || nameParts[0] || "";
      lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    }

    if (!firstName || !lastName || !email) {
      return badRequest("First name, last name, and email are required");
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const preservedPosition = requester.staff?.position || "Clinic Staff";

    let updatedProfile = requester.profile;
    if (applyAcrossRoles) {
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
        })
        .eq("id", requester.profile.id)
        .select(PROFILE_SELECT_COLUMNS)
        .single();

      if (profileError || !profileRow) {
        throw new Error(profileError?.message || "Failed to update profile");
      }

      updatedProfile = profileRow;
    }

    const staffPayload = {
      profile_id: requester.profile.id,
      email,
      name: fullName,
      first_name: firstName,
      last_name: lastName,
      position: preservedPosition,
      phone,
    };

    const { data: updatedStaff, error: staffError } = await supabase
      .from("staff_users")
      .upsert(staffPayload, {
        onConflict: "profile_id",
      })
      .select(STAFF_PROFILE_SELECT_COLUMNS)
      .single();

    if (staffError || !updatedStaff) {
      throw new Error(staffError?.message || "Failed to update staff profile");
    }

    if (applyAcrossRoles && requester.profile.student_id) {
      const { error: studentError } = await supabase
        .from("students")
        .upsert({
          student_id: requester.profile.student_id,
          profile_id: requester.profile.id,
          first_name: firstName,
          last_name: lastName,
          contact_number: phone,
        }, {
          onConflict: "student_id",
        });

      if (studentError) {
        throw new Error(studentError.message);
      }
    }

    invalidateDashboardReadCaches();

    return c.json({
      success: true,
      profile: updatedProfile,
      staff: updatedStaff,
    });
  } catch (error) {
    console.log("Error updating staff profile:", error);
    return internalServerError(c, "Failed to update staff profile", error);
  }
});

app.get("/staff-signature", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const { data: staffRow, error: staffError } = await supabase
      .from("staff_users")
      .select("signature_url")
      .eq("profile_id", requester.profile.id)
      .maybeSingle();

    if (staffError) {
      throw new Error(staffError.message);
    }

    const directSignatureUrl = normalizeMediaUrl(staffRow?.signature_url || null);
    if (directSignatureUrl) {
      return c.json({
        success: true,
        signatureUrl: directSignatureUrl,
        signatureFileName: null,
      });
    }

    const latestSignature = await loadLatestStaffSignature(requester.profile.id);
    return c.json({
      success: true,
      signatureUrl: latestSignature?.url || null,
      signatureFileName: latestSignature?.file_name || null,
    });
  } catch (error) {
    console.log("Error loading staff signature:", error);
    return internalServerError(c, "Failed to load staff signature", error);
  }
});

app.post("/announcement-image/prepare", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const payload = await c.req.json();
    const fileName = String(payload?.fileName || "").trim();
    const fileSize = Number(payload?.size || 0);
    const resolvedMimeType = isSupportedProfileAssetMimeType(payload?.mimeType, fileName);
    const ownerId = String(requester.profile.id || "").trim();

    if (!fileName) {
      return badRequest("fileName is required");
    }
    if (!ownerId) {
      return badRequest("Announcement owner is required");
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return badRequest("Announcement image size is required");
    }
    if (fileSize > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
      return badRequest("Announcement image must be 5 MB or smaller.");
    }
    if (!resolvedMimeType) {
      return badRequest("Announcement image must be an image file.");
    }

    return c.json({
      ...(await createCloudinaryUploadTicket({
        kind: "announcement",
        ownerId,
        fileName,
      })),
      mimeType: resolvedMimeType,
    });
  } catch (error) {
    const cloudinaryError = cloudinaryRouteError(c, error);
    if (cloudinaryError) return cloudinaryError;
    console.log("Error preparing announcement image upload:", error);
    return internalServerError(c, "Failed to prepare announcement image upload", error);
  }
});

app.post("/announcement-image/complete", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const payload = await c.req.json();
    const fileName = String(payload?.fileName || "").trim();
    const ownerId = String(requester.profile.id || "").trim();
    const { upload } = await validateCloudinaryUpload(payload?.cloudinary, {
      kind: "announcement",
      ownerId,
      maxBytes: ANNOUNCEMENT_IMAGE_MAX_BYTES,
      requireImage: true,
    });
    const resolvedMimeType = isSupportedProfileAssetMimeType(
      getMimeTypeFromCloudinaryUpload(upload, payload?.mimeType, fileName),
      fileName,
    );

    if (!resolvedMimeType) {
      return badRequest("Announcement image must be an image file.");
    }

    return c.json({
      success: true,
      imagePath: upload.secure_url,
      imageUrl: upload.secure_url,
      publicId: upload.public_id,
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return c.json({ error: error.message }, error.status || 400);
    }
    const cloudinaryError = cloudinaryRouteError(c, error);
    if (cloudinaryError) return cloudinaryError;
    console.log("Error completing announcement image upload:", error);
    return internalServerError(c, "Failed to complete announcement image upload", error);
  }
});

app.post("/staff-signature/prepare", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const payload = await c.req.json();
    const fileName = String(payload?.fileName || "").trim();
    const fileSize = Number(payload?.size || 0);
    const profileId = String(requester.profile.id || "").trim();
    const resolvedMimeType = isSupportedProfileAssetMimeType(payload?.mimeType, fileName);

    if (!fileName) {
      return badRequest("fileName is required");
    }
    if (!profileId) {
      return badRequest("Staff profile is required");
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return badRequest("Staff signature size is required");
    }
    if (fileSize > STAFF_SIGNATURE_MAX_BYTES) {
      return badRequest("Staff signature must be 5 MB or smaller.");
    }
    if (!resolvedMimeType) {
      return badRequest("Staff signature must be an image file.");
    }

    return c.json({
      ...(await createCloudinaryUploadTicket({
        kind: "staff-signature",
        ownerId: profileId,
        fileName,
      })),
      mimeType: resolvedMimeType,
    });
  } catch (error) {
    const cloudinaryError = cloudinaryRouteError(c, error);
    if (cloudinaryError) return cloudinaryError;
    console.log("Error preparing staff signature upload:", error);
    return internalServerError(c, "Failed to prepare staff signature upload", error);
  }
});

app.post("/staff-signature/complete", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const payload = await c.req.json();
    const result = await completeStaffSignatureUpload({
      profileId: String(requester.profile.id || "").trim(),
      fileName: String(payload?.fileName || "").trim(),
      mimeType: payload?.mimeType,
      cloudinary: payload?.cloudinary,
    });

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return c.json({ error: error.message }, error.status || 400);
    }
    const cloudinaryError = cloudinaryRouteError(c, error);
    if (cloudinaryError) return cloudinaryError;
    console.log("Error completing staff signature upload:", error);
    return internalServerError(c, "Failed to complete staff signature upload", error);
  }
});

app.post("/staff-signature", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const profileId = String(requester.profile.id || "").trim();

    if (!file) {
      return badRequest("file is required");
    }
    if (!profileId) {
      return badRequest("Staff profile is required");
    }
    if (!isSupportedSignatureImage(file)) {
      return badRequest("Staff signature must be an image file.");
    }
    if (file.size > STAFF_SIGNATURE_MAX_BYTES) {
      return badRequest("Staff signature must be 5 MB or smaller.");
    }

    const { upload } = await uploadFileToCloudinary(file, {
      kind: "staff-signature",
      ownerId: profileId,
      fileName: file.name,
    });
    const result = await completeStaffSignatureUpload({
      profileId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      cloudinary: upload,
    });

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return c.json({ error: error.message }, error.status || 400);
    }
    const cloudinaryError = cloudinaryRouteError(c, error);
    if (cloudinaryError) return cloudinaryError;
    console.log("Error uploading staff signature:", error);
    return internalServerError(c, "Failed to upload staff signature", error);
  }
});

app.post("/student-profile-asset/prepare", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== "student") return forbidden();

  try {
    const payload = await c.req.json();
    const fileType = String(payload?.fileType || "").trim().toLowerCase();
    const requestedStudentId = String(payload?.studentId || "").trim();
    const fileName = String(payload?.fileName || "").trim();
    const fileSize = Number(payload?.size || 0);
    const resolvedMimeType = isSupportedProfileAssetMimeType(payload?.mimeType, fileName);
    const studentId =
      requester.profile.student_id ||
      requester.student?.student_id ||
      requestedStudentId;

    if (!fileType || !fileName) {
      return badRequest("fileType and fileName are required");
    }
    if (fileType !== "photo" && fileType !== "signature") {
      return badRequest("Unsupported profile asset type");
    }
    if (!studentId) {
      return badRequest("Student ID is required");
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return badRequest("Profile asset size is required");
    }
    if (fileSize > PROFILE_ASSET_MAX_BYTES) {
      return badRequest("Profile photo and signature must be 5 MB or smaller.");
    }
    if (!resolvedMimeType) {
      return badRequest("Profile photo and signature must be an image file.");
    }

    return c.json({
      ...(await createCloudinaryUploadTicket({
        kind: fileType === "photo" ? "profile-photo" : "student-signature",
        ownerId: studentId,
        fileName,
      })),
      mimeType: resolvedMimeType,
    });
  } catch (error) {
    const cloudinaryError = cloudinaryRouteError(c, error);
    if (cloudinaryError) return cloudinaryError;
    console.log("Error preparing student profile asset upload:", error);
    return internalServerError(c, "Failed to prepare student profile asset upload", error);
  }
});

app.post("/student-profile-asset/complete", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== "student") return forbidden();

  let insertedFile: any = null;
  let rollbackCloudinary: any = null;
  let shouldRollbackCloudinary = true;

  try {
    const payload = await c.req.json();
    const fileType = String(payload?.fileType || "").trim().toLowerCase();
    const requestedStudentId = String(payload?.studentId || "").trim();
    const fileName = String(payload?.fileName || "").trim();
    const studentId =
      requester.profile.student_id ||
      requester.student?.student_id ||
      requestedStudentId;

    if (!fileType || !fileName) {
      return badRequest("fileType and fileName are required");
    }
    if (fileType !== "photo" && fileType !== "signature") {
      return badRequest("Unsupported profile asset type");
    }
    if (!studentId) {
      return badRequest("Student ID is required");
    }
    const { upload, folder } = await validateCloudinaryUpload(payload?.cloudinary, {
      kind: fileType === "photo" ? "profile-photo" : "student-signature",
      ownerId: studentId,
      maxBytes: PROFILE_ASSET_MAX_BYTES,
      requireImage: true,
    });
    rollbackCloudinary = upload;
    const resolvedMimeType = isSupportedProfileAssetMimeType(
      getMimeTypeFromCloudinaryUpload(upload, payload?.mimeType, fileName),
      fileName,
    );
    if (!resolvedMimeType) {
      return badRequest("Profile photo and signature must be an image file.");
    }

    let staleMetadataRows: any[] = [];
    try {
      const { data: inserted, error: fileInsertError } = await insertFileMetadataWithFallback({
        submission_id: null,
        type: fileType,
        file_name: fileName,
        mime_type: resolvedMimeType || "application/octet-stream",
        ...buildCloudinaryFileMetadata(upload, folder),
        uploaded_by: requester.profile.id,
      });

      if (fileInsertError || !inserted) {
        throw new Error(fileInsertError?.message || "Failed to save student profile asset metadata");
      } else {
        insertedFile = inserted;

        const { data: staleRows, error: staleMetadataError } = await selectFilesWithFallback((query) =>
          query
            .eq("uploaded_by", requester.profile.id)
            .is("submission_id", null)
            .eq("type", fileType)
            .neq("id", insertedFile.id)
        );

        if (staleMetadataError) {
          throw new Error(staleMetadataError.message);
        }

        staleMetadataRows = staleRows || [];
        const staleMetadataIds = staleMetadataRows.map((item) => item?.id).filter(Boolean);
        if (staleMetadataIds.length) {
          const { error: staleDeleteError } = await supabase.from("files").delete().in("id", staleMetadataIds);
          if (staleDeleteError) {
            throw new Error(staleDeleteError.message);
          }
        }
      }
    } catch (metadataError) {
      console.log("Student profile asset metadata warning:", metadataError);
    }

    await updateStudentProfileMediaColumns({
      studentId,
      fileType,
      fileName: fileName || upload.public_id,
      url: upload.secure_url,
    });

    runBackgroundTask("Profile asset cleanup", async () => {
      if (staleMetadataRows?.length) {
        await deleteStoredFiles(staleMetadataRows);
      }
    });

    invalidateStudentRecordsCache(studentId);
    shouldRollbackCloudinary = false;

    return c.json({
      success: true,
      url: upload.secure_url,
      fileName: fileName || upload.public_id,
    });
  } catch (error) {
    if (insertedFile?.id) {
      try {
        await supabase.from("files").delete().eq("id", insertedFile.id);
      } catch (rollbackError) {
        console.log("Profile asset rollback metadata warning:", rollbackError);
      }
    }

    if (shouldRollbackCloudinary && rollbackCloudinary?.public_id) {
      try {
        await destroyCloudinaryAsset(
          rollbackCloudinary.public_id,
          rollbackCloudinary.resource_type || "image",
        );
      } catch (cleanupError) {
        console.log("Profile asset rollback Cloudinary warning:", cleanupError);
      }
    }

    if (error instanceof UploadValidationError) {
      return c.json({ error: error.message }, error.status || 400);
    }
    const cloudinaryError = cloudinaryRouteError(c, error);
    if (cloudinaryError) return cloudinaryError;
    console.log("Error completing student profile asset upload:", error);
    return internalServerError(c, "Failed to complete student profile asset upload", error);
  }
});

app.post("/student-profile-asset", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  let rollbackCloudinary: any = null;
  let shouldRollbackCloudinary = true;

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const fileType = String(formData.get('fileType') || '').trim().toLowerCase();
    const requestedStudentId = String(formData.get('studentId') || '').trim();
    const studentId =
      requester.profile.student_id ||
      requester.student?.student_id ||
      requestedStudentId;

    if (!file || !fileType) {
      return badRequest('file and fileType are required');
    }

    if (fileType !== 'photo' && fileType !== 'signature') {
      return badRequest('Unsupported profile asset type');
    }

    if (!studentId) {
      return badRequest('Student ID is required');
    }
    if (file.size > PROFILE_ASSET_MAX_BYTES) {
      return badRequest('Profile photo and signature must be 5 MB or smaller.');
    }
    const resolvedMimeType = isSupportedProfileAssetMimeType(file.type, file.name);
    if (!resolvedMimeType) {
      return badRequest('Profile photo and signature must be an image file.');
    }

    const cloudinaryResult = await uploadFileToCloudinary(file, {
      kind: fileType === 'photo' ? 'profile-photo' : 'student-signature',
      ownerId: studentId,
      fileName: file.name,
    });
    const { upload, folder } = await validateCloudinaryUpload(cloudinaryResult.upload, {
      kind: fileType === 'photo' ? 'profile-photo' : 'student-signature',
      ownerId: studentId,
      maxBytes: PROFILE_ASSET_MAX_BYTES,
      requireImage: true,
    });
    rollbackCloudinary = upload;

    const { data: insertedFile, error: fileInsertError } = await insertFileMetadataWithFallback({
      submission_id: null,
      type: fileType,
      file_name: file.name,
      mime_type: resolvedMimeType || 'application/octet-stream',
      ...buildCloudinaryFileMetadata(upload, folder),
      uploaded_by: requester.profile.id,
    });

    if (fileInsertError || !insertedFile) {
      console.log('Student profile asset metadata warning:', fileInsertError?.message || 'Insert returned no row');
    } else {
      try {
        const { data: staleRows, error: staleRowsError } = await selectFilesWithFallback((query) =>
          query
            .eq('uploaded_by', requester.profile.id)
            .is('submission_id', null)
            .eq('type', fileType)
            .neq('id', insertedFile.id)
        );

        if (staleRowsError) {
          throw new Error(staleRowsError.message);
        }

        const staleIds = (staleRows || []).map((item) => item?.id).filter(Boolean);
        if (staleIds.length) {
          const { error: staleDeleteError } = await supabase.from('files').delete().in('id', staleIds);
          if (staleDeleteError) {
            throw new Error(staleDeleteError.message);
          }
          runBackgroundTask('Profile asset cleanup', async () => {
            await deleteStoredFiles(staleRows || []);
          });
        }
      } catch (metadataCleanupError) {
        console.log('Profile asset cleanup warning:', metadataCleanupError);
      }
    }

    await updateStudentProfileMediaColumns({
      studentId,
      fileType,
      fileName: file.name || upload.public_id,
      url: upload.secure_url,
    });

    shouldRollbackCloudinary = false;

    return c.json({
      success: true,
      url: upload.secure_url,
      fileName: file.name || upload.public_id,
    });
  } catch (error) {
    if (shouldRollbackCloudinary && rollbackCloudinary?.public_id) {
      try {
        await destroyCloudinaryAsset(
          rollbackCloudinary.public_id,
          rollbackCloudinary.resource_type || "image",
        );
      } catch (cleanupError) {
        console.log("Profile asset rollback Cloudinary warning:", cleanupError);
      }
    }
    if (error instanceof UploadValidationError) {
      return c.json({ error: error.message }, error.status || 400);
    }
    const cloudinaryError = cloudinaryRouteError(c, error);
    if (cloudinaryError) return cloudinaryError;
    console.log('Error uploading student profile asset:', error);
    return internalServerError(c, 'Failed to upload student profile asset', error);
  }
});

app.get("/student-profile-assets", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const requestedStudentId = String(c.req.query("studentId") || "").trim();
    const requesterStudentId =
      requester.profile.student_id || requester.student?.student_id || "";
    const targetStudentId = requestedStudentId || requesterStudentId;

    if (requester.profile.role === "student" && targetStudentId !== requesterStudentId) {
      return forbidden();
    }

    const targetProfileId = requester.profile.role === "student"
      ? requester.student?.profile_id || requester.profile.id
      : targetStudentId
        ? await findProfileIdForStudentId(targetStudentId)
        : requester.student?.profile_id || requester.profile.id;
    if (!targetProfileId && !targetStudentId) {
      return c.json({
        success: true,
        photoUrl: null,
        signatureUrl: null,
        photoFileName: null,
        signatureFileName: null,
      });
    }

    const directAssets = await loadStudentProfileMediaColumns(targetStudentId, targetProfileId);
    if (directAssets?.photoUrl && directAssets?.signatureUrl) {
      return c.json({
        success: true,
        ...directAssets,
      });
    }

    let assetRows: any[] = [];
    if (targetProfileId && (!directAssets?.photoUrl || !directAssets?.signatureUrl)) {
      const { data, error: assetError } = await selectFilesWithFallback((query) =>
        query
          .eq("uploaded_by", targetProfileId)
          .is("submission_id", null)
          .order("uploaded_at", { ascending: false })
          .limit(50)
      );

      if (assetError && !isMissingFilesTableError(assetError)) {
        throw new Error(assetError.message);
      }

      assetRows = assetError ? [] : (data || []);
    }

    const normalizedRows = normalizeProfileAssetRows(await normalizeFileRows(assetRows || []));
    const latestByType = (normalizedRows || []).reduce((acc, row) => {
      const type = String(row?.type || "").trim().toLowerCase();
      if (!type || acc[type]) return acc;
      acc[type] = row;
      return acc;
    }, {} as Record<string, any>);

    return c.json({
      success: true,
      photoUrl: directAssets?.photoUrl || latestByType.photo?.url || null,
      signatureUrl: directAssets?.signatureUrl || latestByType.signature?.url || null,
      photoFileName: directAssets?.photoFileName || latestByType.photo?.file_name || null,
      signatureFileName: directAssets?.signatureFileName || latestByType.signature?.file_name || null,
    });
  } catch (error) {
    return internalServerError(c, "Failed to load student profile assets", error);
  }
});

app.post("/submit-record", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const data = await c.req.json();
    const studentId = requester.profile.student_id || data.studentId;

    if (!studentId) {
      return badRequest('Student ID is required');
    }

    const studentPayload = {
      student_id: studentId,
      profile_id: requester.profile.id,
      first_name: data.firstName,
      last_name: data.lastName,
      middle_initial: data.middleInitial || null,
      department: data.department || null,
      course: data.course || null,
      age: data.age ? Number(data.age) : null,
      sex: data.sex || null,
      birthday: data.birthday || null,
      civil_status: data.civilStatus || null,
      contact_number: data.contactNumber || null,
      address: data.address || null,
    };

    const { error: studentError } = await supabase.from('students').upsert(studentPayload, {
      onConflict: 'student_id',
    });

    if (studentError) throw new Error(studentError.message);

    const { data: insertedSubmission, error: submissionError } = await supabase
      .from('submissions')
      .insert({
        student_id: studentId,
        year_level: requestedSlot,
        academic_year: activeAcademicYear,
        status: 'pending',
        first_name: data.firstName,
        last_name: data.lastName,
        middle_initial: data.middleInitial || null,
        department: data.department || null,
        course: data.course || null,
        age: data.age ? Number(data.age) : null,
        sex: data.sex || null,
        birthday: data.birthday || null,
        civil_status: data.civilStatus || null,
        contact_number: data.contactNumber || null,
        address: data.address || null,
        allergy_details: data.allergyDetails || null,
        had_operation: data.hadOperation || null,
        operation_details: data.operationDetails || null,
        weight: data.weight || null,
        height: data.height || null,
        bmi: data.bmi || null,
        data_privacy_consent: Boolean(data.dataPrivacyConsent),
      })
      .select(SUBMISSION_LIST_COLUMNS)
      .single();

    if (submissionError || !insertedSubmission) {
      throw new Error(submissionError?.message || 'Failed to create submission');
    }

    const submissionId = insertedSubmission.id;

    await Promise.all([
      supabase.from('emergency_contacts').upsert({
        submission_id: submissionId,
        name: data.emergencyContact?.name || null,
        relationship: data.emergencyContact?.relationship || null,
        phone: data.emergencyContact?.phone || null,
        address: data.emergencyContact?.address || null,
      }),
      supabase.from('medical_history').upsert({
        submission_id: submissionId,
        allergy: Boolean(data.medicalHistory?.allergy),
        asthma: Boolean(data.medicalHistory?.asthma),
        chicken_pox: Boolean(data.medicalHistory?.chickenPox),
        diabetes: Boolean(data.medicalHistory?.diabetes),
        dysmenorrhea: Boolean(data.medicalHistory?.dysmenorrhea),
        epilepsy_seizure: Boolean(data.medicalHistory?.epilepsySeizure),
        heart_disorder: Boolean(data.medicalHistory?.heartDisorder),
        hepatitis: Boolean(data.medicalHistory?.hepatitis),
        hypertension: Boolean(data.medicalHistory?.hypertension),
        measles: Boolean(data.medicalHistory?.measles),
        mumps: Boolean(data.medicalHistory?.mumps),
        anxiety_disorder: Boolean(data.medicalHistory?.anxietyDisorder),
        panic_attack: Boolean(data.medicalHistory?.panicAttack),
        pneumonia: Boolean(data.medicalHistory?.pneumonia),
        ptb_primary_complex: Boolean(data.medicalHistory?.ptbPrimaryComplex),
        typhoid_fever: Boolean(data.medicalHistory?.typhoidFever),
        covid19: Boolean(data.medicalHistory?.covid19),
        uti: Boolean(data.medicalHistory?.uti),
      }),
    ]);

    invalidateDashboardReadCaches();
    return c.json({ success: true, recordId: submissionId });
  } catch (error) {
    console.log('Error submitting medical record:', error);
    return internalServerError(c, 'Failed to submit record', error);
  }
});

app.get("/student-records", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    if (!requester.profile.student_id && !isStaffRole(requester.profile.role)) {
      return badRequest('Student ID not found in profile');
    }

    const records = await getCachedStudentRecords(requester.profile.student_id);

    return c.json({ records });
  } catch (error) {
    console.log('Error fetching student records:', error);
    return internalServerError(c, 'Failed to fetch records', error);
  }
});

app.get("/student-records/:studentId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const studentId = c.req.param('studentId');
    const targetStudentId = isStaffRole(requester.profile.role) ? studentId : requester.profile.student_id;

    const records = await getCachedStudentRecords(targetStudentId);

    return c.json({ records });
  } catch (error) {
    console.log('Error fetching student records:', error);
    return internalServerError(c, 'Failed to fetch records', error);
  }
});

app.get("/staff/certificate-records/:studentId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const studentId = String(c.req.param("studentId") || "").trim();
    if (!studentId) return badRequest("Student ID is required");

    const records = await getCachedStudentRecords(studentId);
    return c.json({
      records: (records || []).filter(
        (record: any) => String(record?.status || "").toLowerCase() === "approved",
      ),
    });
  } catch (error) {
    console.log("Error fetching staff certificate records:", error);
    return internalServerError(c, "Failed to fetch certificate records", error);
  }
});

// Staff review routes.
app.get("/submissions", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const submissions = await getCachedSubmissionsList();
    return c.json({ submissions });
  } catch (error) {
    console.log('Error fetching submissions:', error);
    return internalServerError(c, 'Failed to fetch submissions', error);
  }
});

app.get("/staff/dashboard-overview", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    return c.json(await getCachedStaffDashboardOverview());
  } catch (error) {
    console.log('Error fetching staff dashboard overview:', error);
    return internalServerError(c, 'Failed to fetch staff dashboard overview', error);
  }
});

app.get("/staff/submission-report-summaries", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    return c.json(await getCachedStaffSubmissionReportSummaries());
  } catch (error) {
    console.log('Error fetching staff submission report summaries:', error);
    return internalServerError(c, 'Failed to fetch submission report summaries', error);
  }
});

app.get("/reporting-term", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    return c.json(await getSafeAdminSystemSettings());
  } catch (error) {
    console.log('Error fetching reporting term settings:', error);
    return internalServerError(c, 'Failed to fetch reporting term settings', error);
  }
});

app.get("/academic-year", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const settings = await getSafeAdminSystemSettings();
    return c.json({
      academicYear: settings.academicYear,
      semester: settings.semester,
      acceptingSubmissions: settings.acceptingSubmissions,
    });
  } catch (error) {
    console.log('Error fetching academic year settings:', error);
    return internalServerError(c, 'Failed to fetch academic year settings', error);
  }
});

app.get("/session-policy", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const settings = await getSafeAdminSystemSettings();
    return c.json({
      sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    });
  } catch (error) {
    console.log('Error fetching session policy:', error);
    return internalServerError(c, 'Failed to fetch session policy', error);
  }
});

app.get("/staff/submission-summaries", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const searchQuery = String(c.req.query('search') || '').trim();
    const statusFilter = String(c.req.query('status') || 'action_needed').trim();
    const departmentFilter = String(c.req.query('department') || '').trim();
    const yearFilter = String(c.req.query('year') || '').trim();
    const sortOrder = String(c.req.query('sort') || 'desc').trim();
    const page = c.req.query('page');
    const pageSize = c.req.query('pageSize');

    return c.json(
      await getCachedStaffSubmissionSummaries({
        searchQuery,
        statusFilter,
        departmentFilter,
        yearFilter,
        sortOrder,
        page,
        pageSize,
      }),
    );
  } catch (error) {
    console.log('Error fetching staff submission summaries:', error);
    return internalServerError(c, 'Failed to fetch staff submission summaries', error);
  }
});

app.get("/staff/approved-students", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const searchQuery = String(c.req.query('search') || '').trim();
    const departmentFilter = String(c.req.query('department') || '').trim();
    const yearFilter = String(c.req.query('year') || '').trim();
    const courseFilter = String(c.req.query('course') || '').trim();
    const fromDate = String(c.req.query('fromDate') || '').trim();
    const toDate = String(c.req.query('toDate') || '').trim();
    const page = c.req.query('page');
    const pageSize = c.req.query('pageSize');

    return c.json(
      await getCachedApprovedStudents({
        searchQuery,
        departmentFilter,
        yearFilter,
        courseFilter,
        fromDate,
        toDate,
        page,
        pageSize,
      }),
    );
  } catch (error) {
    console.log('Error fetching approved student summaries:', error);
    return internalServerError(c, 'Failed to fetch approved student summaries', error);
  }
});

app.get("/submission/:id", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const id = c.req.param('id');
    const access = await requireSubmissionAccess(requester, id);
    if (access.response) return access.response;

    const [submission] = await getMappedSubmissions(
      supabase.from('submissions').select(SUBMISSION_LIST_COLUMNS).eq('id', id),
    );

    return c.json({ submission });
  } catch (error) {
    console.log('Error fetching submission:', error);
    return internalServerError(c, 'Failed to fetch submission', error);
  }
});

app.put("/submission/:id/status", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const id = c.req.param('id');
    const { status, staffNotes } = await c.req.json();
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const now = new Date().toISOString();

    if (normalizedStatus === 'in_review') {
      const reviewerId = String(requester.staff?.id || '').trim();
      if (!reviewerId) {
        return badRequest('Staff account is not linked to this user.');
      }

      const { data: claimedRows, error: claimError } = await supabase
        .from('submissions')
        .update({
          status: normalizedStatus,
          staff_notes: staffNotes || null,
          reviewed_by: reviewerId,
          updated_at: now,
        })
        .eq('id', id)
        .in('status', ['pending', 'resubmitted'])
        .select('id');

      if (claimError) throw new Error(claimError.message);

      if ((claimedRows || []).length === 0) {
        const { data: currentSubmission, error: currentSubmissionError } = await supabase
          .from('submissions')
          .select('id,status,reviewed_by')
          .eq('id', id)
          .maybeSingle();

        if (currentSubmissionError) throw new Error(currentSubmissionError.message);
        if (!currentSubmission) {
          return c.json({ error: 'Submission not found.' }, 404);
        }

        if (currentSubmission.status === 'in_review' && currentSubmission.reviewed_by === reviewerId) {
          const { error: ownUpdateError } = await supabase
            .from('submissions')
            .update({
              staff_notes: staffNotes || null,
              updated_at: now,
            })
            .eq('id', id)
            .eq('reviewed_by', reviewerId);

          if (ownUpdateError) throw new Error(ownUpdateError.message);

          invalidateDashboardReadCaches();
          return c.json({ success: true });
        }

        if (currentSubmission.status === 'in_review' && currentSubmission.reviewed_by) {
          const reviewerDirectory = await loadStaffUsersByIds([currentSubmission.reviewed_by]);
          const reviewerName =
            formatStaffDisplayName(reviewerDirectory[currentSubmission.reviewed_by])
            || 'another clinic staff member';

          return c.json(
            {
              error: 'Submission already being reviewed.',
              details: `This submission is already being reviewed by ${reviewerName}.`,
              reviewedBy: currentSubmission.reviewed_by,
              reviewerName,
            },
            409,
          );
        }

        return c.json(
          {
            error: 'Submission is no longer available to claim.',
            details: 'This submission changed status. Refresh the review queue and try again.',
          },
          409,
        );
      }

      invalidateDashboardReadCaches();
      return c.json({ success: true });
    }

    const { error } = await supabase
      .from('submissions')
      .update({
        status: normalizedStatus,
        staff_notes: staffNotes || null,
        reviewed_by: requester.staff?.id || null,
        updated_at: now,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);

    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error updating submission status:', error);
    return internalServerError(c, 'Failed to update status', error);
  }
});

app.post("/notifications/status-email", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const { submissionId, status, staffNotes } = await c.req.json();
    if (!submissionId || !status) {
      return badRequest('submissionId and status are required');
    }

    const result = await sendStatusNotificationEmail(submissionId, status, staffNotes || null);
    return c.json(result);
  } catch (error) {
    console.log('Error sending status email notification:', error);
    return internalServerError(c, 'Failed to send status email notification', error);
  }
});

app.get("/student-notifications/state", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const requestedStudentId = String(c.req.query('studentId') || '').trim();
    const requesterStudentId = getRequesterStudentId(requester);
    const studentId = requestedStudentId || requesterStudentId;
    if (!studentId) return badRequest('studentId is required');
    if (studentId !== requesterStudentId) return forbidden();

    const { data, error } = await supabase
      .from('kv_store_2a5e1a6b')
      .select('value')
      .eq('key', getStudentNotificationStateKey(requester, studentId))
      .maybeSingle();

    if (error) {
      if (isMissingKvStoreError(error)) {
        return c.json({
          state: normalizeStudentNotificationState({}),
        });
      }
      throw new Error(error.message);
    }

    return c.json({
      state: normalizeStudentNotificationState(data?.value || {}),
    });
  } catch (error) {
    console.log('Error fetching student notification state:', error);
    return internalServerError(c, 'Failed to fetch notification state', error);
  }
});

app.put("/student-notifications/state", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const payload = await c.req.json();
    const requestedStudentId = String(payload?.studentId || '').trim();
    const requesterStudentId = getRequesterStudentId(requester);
    const studentId = requestedStudentId || requesterStudentId;
    if (!studentId) return badRequest('studentId is required');
    if (studentId !== requesterStudentId) return forbidden();

    const state = normalizeStudentNotificationState(payload?.state || {});
    const { error } = await supabase
      .from('kv_store_2a5e1a6b')
      .upsert({
        key: getStudentNotificationStateKey(requester, studentId),
        value: state,
      });

    if (error) {
      if (isMissingKvStoreError(error)) {
        return c.json({ success: true, persisted: false });
      }
      throw new Error(error.message);
    }

    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error saving student notification state:', error);
    return internalServerError(c, 'Failed to save notification state', error);
  }
});

app.get("/student-notifications", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const requestedStudentId = String(c.req.query('studentId') || '').trim();
    const requesterStudentId = getRequesterStudentId(requester);
    const studentId = requestedStudentId || requesterStudentId;
    if (!studentId) return badRequest('studentId is required');
    if (studentId !== requesterStudentId) return forbidden();

    return c.json({
      notifications: await listStudentNotifications(studentId),
    });
  } catch (error) {
    console.log('Error fetching student notifications:', error);
    return internalServerError(c, 'Failed to fetch student notifications', error);
  }
});

app.post("/student-notifications/sync", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const payload = await c.req.json();
    const requestedStudentId = String(payload?.studentId || '').trim();
    const requesterStudentId = getRequesterStudentId(requester);
    const studentId = requestedStudentId || requesterStudentId;
    if (!studentId) return badRequest('studentId is required');
    if (studentId !== requesterStudentId) return forbidden();

    const incomingItems = Array.isArray(payload?.notifications)
      ? payload.notifications.map(normalizeStudentNotificationItem).filter(Boolean)
      : [];
    const dedupedItems = [...new Map(incomingItems.map((item) => [item.notificationKey, item])).values()].slice(0, 50);

    if (dedupedItems.length) {
      const notificationKeys = dedupedItems.map((item) => item.notificationKey);
      const { data: existingRows, error: existingError } = await supabase
        .from('student_notifications')
        .select('notification_key')
        .eq('student_id', studentId)
        .in('notification_key', notificationKeys);

      if (existingError && !isMissingStudentNotificationsTableError(existingError)) {
        throw new Error(existingError.message);
      }

      const existingKeys = new Set((existingRows || []).map((row) => String(row.notification_key || '').trim()));
      const rowsToInsert = dedupedItems
        .filter((item) => !existingKeys.has(item.notificationKey))
        .map((item) => ({
          student_id: studentId,
          submission_id: item.submissionId,
          notification_key: item.notificationKey,
          status: item.status,
          title: item.title,
          message: item.message,
          note: item.note,
          action_label: item.actionLabel,
          action_path: item.actionPath,
          year_label: item.yearLabel,
          occurred_at: item.timestamp,
          is_read: Boolean(item.read),
          updated_at: new Date().toISOString(),
        }));

      if (rowsToInsert.length) {
        const { error: insertError } = await supabase
          .from('student_notifications')
          .insert(rowsToInsert);

        if (insertError && !isMissingStudentNotificationsTableError(insertError) && !isDuplicateStudentNotificationError(insertError)) {
          throw new Error(insertError.message);
        }
      }
    }

    return c.json({
      notifications: await listStudentNotifications(studentId),
    });
  } catch (error) {
    console.log('Error syncing student notifications:', error);
    return internalServerError(c, 'Failed to sync student notifications', error);
  }
});

app.patch("/student-notifications/:id", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const notificationId = String(c.req.param('id') || '').trim();
    const studentId = getRequesterStudentId(requester);
    if (!notificationId) return badRequest('notification id is required');
    if (!studentId) return badRequest('studentId is required');

    const payload = await c.req.json();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof payload?.read === 'boolean') {
      updates.is_read = payload.read;
    }

    const { data, error } = await supabase
      .from('student_notifications')
      .update(updates)
      .eq('id', notificationId)
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .select('id,notification_key,submission_id,status,title,message,note,action_label,action_path,year_label,occurred_at,is_read')
      .maybeSingle();

    if (error) {
      if (isMissingStudentNotificationsTableError(error)) {
        return badRequest('Student notifications are not available yet.');
      }
      throw new Error(error.message);
    }
    if (!data) return forbidden();

    return c.json({
      notification: mapStudentNotificationRow(data),
    });
  } catch (error) {
    console.log('Error updating student notification:', error);
    return internalServerError(c, 'Failed to update student notification', error);
  }
});

app.post("/student-notifications/mark-all-read", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const payload = await c.req.json().catch(() => ({}));
    const requestedStudentId = String(payload?.studentId || '').trim();
    const requesterStudentId = getRequesterStudentId(requester);
    const studentId = requestedStudentId || requesterStudentId;
    if (!studentId) return badRequest('studentId is required');
    if (studentId !== requesterStudentId) return forbidden();

    const { error } = await supabase
      .from('student_notifications')
      .update({
        is_read: true,
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .eq('is_read', false);

    if (error) {
      if (isMissingStudentNotificationsTableError(error)) {
        return c.json({ success: true });
      }
      throw new Error(error.message);
    }

    return c.json({ success: true });
  } catch (error) {
    console.log('Error marking all student notifications as read:', error);
    return internalServerError(c, 'Failed to update student notifications', error);
  }
});

app.delete("/student-notifications/:id", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const notificationId = String(c.req.param('id') || '').trim();
    const studentId = getRequesterStudentId(requester);
    if (!notificationId) return badRequest('notification id is required');
    if (!studentId) return badRequest('studentId is required');

    const { error } = await supabase
      .from('student_notifications')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('student_id', studentId)
      .is('deleted_at', null);

    if (error) {
      if (isMissingStudentNotificationsTableError(error)) {
        return c.json({ success: true });
      }
      throw new Error(error.message);
    }

    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting student notification:', error);
    return internalServerError(c, 'Failed to delete student notification', error);
  }
});

app.post("/student-notifications/clear", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const payload = await c.req.json().catch(() => ({}));
    const requestedStudentId = String(payload?.studentId || '').trim();
    const requesterStudentId = getRequesterStudentId(requester);
    const studentId = requestedStudentId || requesterStudentId;
    if (!studentId) return badRequest('studentId is required');
    if (studentId !== requesterStudentId) return forbidden();

    const { error } = await supabase
      .from('student_notifications')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .is('deleted_at', null);

    if (error) {
      if (isMissingStudentNotificationsTableError(error)) {
        return c.json({ success: true });
      }
      throw new Error(error.message);
    }

    return c.json({ success: true });
  } catch (error) {
    console.log('Error clearing student notifications:', error);
    return internalServerError(c, 'Failed to clear student notifications', error);
  }
});

app.put("/submission/:id/measurements", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const id = c.req.param('id');
    const measurements = await c.req.json();

    await Promise.all([
      supabase.from('staff_measurements').upsert({
        submission_id: id,
        blood_pressure: measurements.bloodPressure || null,
        cardiac_rate: measurements.cardiacRate || null,
        respiratory_rate: measurements.respiratoryRate || null,
        temperature: measurements.temperature || null,
        weight: measurements.weight || null,
        height: measurements.height || null,
        bmi: measurements.bmi || null,
        updated_by: requester.staff?.id || null,
        updated_at: new Date().toISOString(),
      }),
      supabase.from('lab_chest_xray').upsert({
        submission_id: id,
        xray_date: measurements.xrayDate || null,
        xray_result: measurements.xrayResult || null,
        xray_findings: measurements.xrayFindings || null,
      }),
      supabase.from('lab_cbc').upsert({
        submission_id: id,
        hemoglobin: measurements.hemoglobin || null,
        hematocrit: measurements.hematocrit || null,
        wbc: measurements.wbc || null,
        platelet_count: measurements.plateletCount || null,
        blood_type: measurements.bloodType || null,
        glucose: measurements.glucose || null,
        protein: measurements.protein || null,
      }),
      supabase.from('lab_urinalysis').upsert({
        submission_id: id,
        glucose: measurements.urinalysisGlucose || null,
        protein: measurements.urinalysisProtein || null,
      }),
      supabase.from('submissions').update({
        updated_at: new Date().toISOString(),
      }).eq('id', id),
    ]);

    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error updating measurements:', error);
    return internalServerError(c, 'Failed to update measurements', error);
  }
});

app.post("/submission/:id/chest-xray-ocr", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const id = c.req.param("id");
    const access = await requireSubmissionAccess(requester, id);
    if (access.response) return access.response;

    const file = await findChestXrayOcrFile(id);
    if (!file) {
      return badRequest("No Chest X-Ray result file was found for this submission.");
    }

    const input = await loadChestXrayOcrInput(file);
    const result = await readChestXrayWithOcrSpace(input);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.log("Error reading Chest X-Ray with OCR.space:", error);

    if (error instanceof OcrSpaceConfigurationError) {
      return c.json({ error: error.message }, 503);
    }
    if (error instanceof OcrSpaceRequestError) {
      return c.json({ error: error.message }, error.status || 502);
    }

    const message = error instanceof Error ? error.message : "Failed to read the Chest X-Ray result file.";
    if (/unsupported|not found|could not be downloaded|supports files up to|file type/i.test(message)) {
      return badRequest(message);
    }

    return internalServerError(c, "Failed to read Chest X-Ray result with OCR.space", error);
  }
});

app.post("/submission/:id/cbc-ocr", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const id = c.req.param("id");
    const access = await requireSubmissionAccess(requester, id);
    if (access.response) return access.response;

    const file = await findCbcOcrFile(id);
    if (!file) {
      return badRequest("No CBC result file was found for this submission.");
    }

    const input = await loadCbcOcrInput(file);
    const result = await readCbcWithOcrSpace(input);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.log("Error reading CBC with OCR.space:", error);

    if (error instanceof OcrSpaceConfigurationError) {
      return c.json({ error: error.message }, 503);
    }
    if (error instanceof OcrSpaceRequestError) {
      return c.json({ error: error.message }, error.status || 502);
    }

    const message = error instanceof Error ? error.message : "Failed to read the CBC result file.";
    if (/unsupported|not found|could not be downloaded|supports files up to|file type/i.test(message)) {
      return badRequest(message);
    }

    return internalServerError(c, "Failed to read CBC result with OCR.space", error);
  }
});

app.post("/submission/:id/urinalysis-ocr", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const id = c.req.param("id");
    const access = await requireSubmissionAccess(requester, id);
    if (access.response) return access.response;

    const file = await findUrinalysisOcrFile(id);
    if (!file) {
      return badRequest("No Urinalysis result file was found for this submission.");
    }

    const input = await loadUrinalysisOcrInput(file);
    const result = await readUrinalysisWithOcrSpace(input);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.log("Error reading Urinalysis with OCR.space:", error);

    if (error instanceof OcrSpaceConfigurationError) {
      return c.json({ error: error.message }, 503);
    }
    if (error instanceof OcrSpaceRequestError) {
      return c.json({ error: error.message }, error.status || 502);
    }

    const message = error instanceof Error ? error.message : "Failed to read the Urinalysis result file.";
    if (/unsupported|not found|could not be downloaded|supports files up to|file type/i.test(message)) {
      return badRequest(message);
    }

    return internalServerError(c, "Failed to read Urinalysis result with OCR.space", error);
  }
});

app.post("/upload-file/prepare", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const payload = await c.req.json();
    const recordId = String(payload?.recordId || "").trim();
    const fileType = String(payload?.fileType || "").trim().toLowerCase();
    const fileName = String(payload?.fileName || "").trim();
    const fileSize = Number(payload?.size || 0);
    const originalFileSize = Number(payload?.originalFileSize ?? fileSize);

    if (!recordId || !fileType || !fileName) {
      return badRequest("recordId, fileType, and fileName are required");
    }
    if (!isCloudinaryLabUploadType(fileType)) {
      return badRequest("Unsupported laboratory file type");
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return badRequest("Laboratory result file size is required.");
    }
    if (!Number.isFinite(originalFileSize) || originalFileSize <= 0) {
      return badRequest("originalFileSize is required.");
    }

    const maxLabUploadBytes = getLabUploadMaxBytes();
    if (fileSize > maxLabUploadBytes) {
      return badRequest(`Laboratory result files must be ${formatFileSize(maxLabUploadBytes)} or smaller.`);
    }

    const supportedMimeType = resolveLabUploadMimeType(payload?.mimeType, fileName);
    if (!supportedMimeType) {
      return badRequest("Laboratory result files must be PDF, PNG, JPG, HEIC/HEIF, WebP, AVIF, GIF, TIF, BMP, or another supported image file.");
    }
    const access = await requireSubmissionAccess(requester, recordId, {
      columns: "id,student_id",
    });
    if (access.response) return access.response;

    return c.json({
      ...(await createCloudinaryUploadTicket({
        kind: "lab",
        ownerId: recordId,
        fileName,
        extra: { labType: fileType },
      })),
      mimeType: supportedMimeType,
    });
  } catch (error) {
    const cloudinaryError = cloudinaryRouteError(c, error);
    if (cloudinaryError) return cloudinaryError;
    console.log("Error preparing file upload:", error);
    return internalServerError(c, "Failed to prepare file upload", error);
  }
});

app.post("/upload-file/complete", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  let insertedFile: any = null;
  let rollbackCloudinary: any = null;
  let shouldRollbackCloudinary = true;
  let submissionStudentId = "";

  try {
    const payload = await c.req.json();
    const recordId = String(payload?.recordId || "").trim();
    const fileType = String(payload?.fileType || "").trim().toLowerCase();
    const fileName = String(payload?.fileName || "").trim();
    const uploadedFileName = String(payload?.uploadedFileName || fileName).trim() || fileName;
    const originalFileSize = Number(payload?.originalFileSize ?? payload?.originalSize ?? 0);

    if (!recordId || !fileType || !fileName) {
      return badRequest("recordId, fileType, and fileName are required");
    }
    if (!isCloudinaryLabUploadType(fileType)) {
      return badRequest("Unsupported laboratory file type");
    }
    if (!Number.isFinite(originalFileSize) || originalFileSize <= 0) {
      return badRequest("originalFileSize is required");
    }

    const access = await requireSubmissionAccess(requester, recordId, {
      columns: "id,student_id",
    });
    if (access.response) return access.response;
    submissionStudentId = String(access.submission?.student_id || "").trim();

    const { upload, folder } = await validateCloudinaryUpload(payload?.cloudinary, {
      kind: "lab",
      ownerId: recordId,
      fileType,
      maxBytes: getLabUploadMaxBytes(),
    });
    rollbackCloudinary = upload;

    const finalizedMimeType = resolveLabUploadMimeType(
      getMimeTypeFromCloudinaryUpload(upload, payload?.uploadedMimeType || payload?.mimeType, uploadedFileName),
      uploadedFileName,
    );
    if (!finalizedMimeType) {
      return badRequest("Laboratory result files must be PDF, PNG, JPG, HEIC/HEIF, WebP, AVIF, GIF, TIF, BMP, or another supported image file.");
    }

    const { data: inserted, error: fileInsertError } = await insertFileMetadataWithFallback({
      submission_id: recordId,
      type: fileType,
      file_name: fileName,
      mime_type: finalizedMimeType || "application/octet-stream",
      ...buildCloudinaryFileMetadata(upload, folder),
      uploaded_by: requester.profile.id,
    });

    if (fileInsertError || !inserted) {
      throw new Error(fileInsertError?.message || "Failed to save file metadata");
    }
    insertedFile = inserted;

    const labTable =
      fileType === "xray"
        ? "lab_chest_xray"
        : fileType === "cbc"
          ? "lab_cbc"
          : "lab_urinalysis";
    await upsertLabFileReference({
      labTable,
      submissionId: recordId,
      fileId: insertedFile.id,
      fileName: fileName || upload.public_id,
      mimeType: finalizedMimeType || "application/octet-stream",
      upload,
    });

    if (submissionStudentId) invalidateStudentRecordsCache(submissionStudentId);

    runBackgroundTask("Laboratory file cleanup", async () => {
      const { data: existingFiles, error: existingFilesError } = await selectFilesWithFallback((query) =>
        query
          .eq("submission_id", recordId)
          .eq("type", fileType)
      );

      if (existingFilesError) {
        throw new Error(existingFilesError.message);
      }

      const staleFiles = (existingFiles || []).filter((item) => item?.id && item.id !== insertedFile.id);
      if (!staleFiles.length) return;

      await cleanupStaleLabFiles(staleFiles);
      if (submissionStudentId) invalidateStudentRecordsCache(submissionStudentId);
    });

    shouldRollbackCloudinary = false;

    return c.json({
      success: true,
      url: upload.secure_url,
      fileName: fileName || upload.public_id,
      directUpload: true,
      optimized: false,
      originalSize: originalFileSize,
      storedSize: upload.bytes,
      optimizationPending: false,
    });
  } catch (error) {
    if (insertedFile?.id) {
      try {
        await supabase.from("files").delete().eq("id", insertedFile.id);
      } catch (rollbackError) {
        console.log("Laboratory upload rollback metadata warning:", rollbackError);
      }
    }
    if (shouldRollbackCloudinary && rollbackCloudinary?.public_id) {
      try {
        await destroyCloudinaryAsset(
          rollbackCloudinary.public_id,
          rollbackCloudinary.resource_type || "image",
        );
      } catch (cleanupError) {
        console.log("Laboratory upload rollback Cloudinary warning:", cleanupError);
      }
    }

    if (error instanceof UploadValidationError) {
      return c.json({ error: error.message }, error.status || 400);
    }
    const cloudinaryError = cloudinaryRouteError(c, error);
    if (cloudinaryError) return cloudinaryError;

    console.log("Error completing file upload:", error);
    return internalServerError(c, "Failed to complete file upload", error);
  }
});

app.post("/upload-file", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  let insertedFile: any = null;
  let rollbackCloudinary: any = null;
  let shouldRollbackCloudinary = true;

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const recordId = String(formData.get('recordId') || '').trim();
    const fileType = String(formData.get('fileType') || '').trim().toLowerCase();

    if (!file || !recordId || !fileType) {
      return badRequest('file, recordId, and fileType are required');
    }
    if (!isCloudinaryLabUploadType(fileType)) {
      return badRequest('Unsupported laboratory file type');
    }
    const maxLabUploadBytes = getLabUploadMaxBytes();
    if (file.size > maxLabUploadBytes) {
      return badRequest(`Laboratory result files must be ${formatFileSize(maxLabUploadBytes)} or smaller.`);
    }
    const mimeType = String(file.type || '').trim().toLowerCase();
    const supportedMimeType = resolveLabUploadMimeType(mimeType, file.name);
    if (!supportedMimeType) {
      return badRequest('Laboratory result files must be PDF, PNG, JPG, HEIC/HEIF, WebP, AVIF, GIF, TIF, BMP, or another supported image file.');
    }

    const access = await requireSubmissionAccess(requester, recordId, {
      columns: "id,student_id",
    });
    if (access.response) return access.response;
    const submissionStudentId = String(access.submission?.student_id || "").trim();

    const cloudinaryResult = await uploadFileToCloudinary(file, {
      kind: "lab",
      ownerId: recordId,
      fileName: file.name,
      extra: { labType: fileType },
    });
    const { upload, folder } = await validateCloudinaryUpload(cloudinaryResult.upload, {
      kind: "lab",
      ownerId: recordId,
      fileType,
      maxBytes: maxLabUploadBytes,
    });
    rollbackCloudinary = upload;
    const finalizedMimeType = resolveLabUploadMimeType(
      getMimeTypeFromCloudinaryUpload(upload, supportedMimeType, file.name),
      file.name,
    );
    if (!finalizedMimeType) {
      return badRequest('Laboratory result files must be PDF, PNG, JPG, HEIC/HEIF, WebP, AVIF, GIF, TIF, BMP, or another supported image file.');
    }

    const { data: inserted, error: fileInsertError } = await insertFileMetadataWithFallback({
      submission_id: recordId,
      type: fileType,
      file_name: file.name,
      mime_type: finalizedMimeType || 'application/octet-stream',
      ...buildCloudinaryFileMetadata(upload, folder),
      uploaded_by: requester.profile.id,
    });

    if (fileInsertError || !inserted) {
      throw new Error(fileInsertError?.message || 'Failed to save file metadata');
    }
    insertedFile = inserted;

    const labTable =
      fileType === 'xray'
        ? 'lab_chest_xray'
        : fileType === 'cbc'
          ? 'lab_cbc'
          : 'lab_urinalysis';
    await upsertLabFileReference({
      labTable,
      submissionId: recordId,
      fileId: insertedFile.id,
      fileName: file.name || upload.public_id,
      mimeType: finalizedMimeType || "application/octet-stream",
      upload,
    });

    if (submissionStudentId) invalidateStudentRecordsCache(submissionStudentId);

    runBackgroundTask("Laboratory file cleanup", async () => {
      const { data: existingFiles, error: existingFilesError } = await selectFilesWithFallback((query) =>
        query
          .eq('submission_id', recordId)
          .eq('type', fileType)
      );

      if (existingFilesError) {
        throw new Error(existingFilesError.message);
      }

      const staleFiles = (existingFiles || []).filter((item) => item?.id && item.id !== insertedFile.id);
      if (!staleFiles.length) return;

      await cleanupStaleLabFiles(staleFiles);
      if (submissionStudentId) invalidateStudentRecordsCache(submissionStudentId);
    });
    shouldRollbackCloudinary = false;

    return c.json({
      success: true,
      url: upload.secure_url,
      fileName: file.name || upload.public_id,
      optimized: false,
      optimizationPending: false,
      originalSize: file.size,
      storedSize: upload.bytes,
    });
  } catch (error) {
    if (insertedFile?.id) {
      try {
        await supabase.from("files").delete().eq("id", insertedFile.id);
      } catch (rollbackError) {
        console.log("Laboratory upload rollback metadata warning:", rollbackError);
      }
    }
    if (shouldRollbackCloudinary && rollbackCloudinary?.public_id) {
      try {
        await destroyCloudinaryAsset(
          rollbackCloudinary.public_id,
          rollbackCloudinary.resource_type || "image",
        );
      } catch (cleanupError) {
        console.log("Laboratory upload rollback Cloudinary warning:", cleanupError);
      }
    }
    if (error instanceof UploadValidationError) {
      return c.json({ error: error.message }, error.status || 400);
    }
    const cloudinaryError = cloudinaryRouteError(c, error);
    if (cloudinaryError) return cloudinaryError;
    console.log('Error in file upload:', error);
    return internalServerError(c, 'Failed to upload file', error);
  }
});

app.get("/analytics", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const analytics = await getCachedAnalyticsSummary();
    return c.json(analytics);
  } catch (error) {
    console.log('Error fetching analytics:', error);
    return internalServerError(c, 'Failed to fetch analytics', error);
  }
});

// Administrator routes.
app.get("/staff-users", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const cacheKey = "admin:staff_users";
    const cached = await getCachedData<any>(cacheKey);
    if (cached) return c.json(cached);

    const [{ data: staff, error }, archivedState] = await Promise.all([
      supabase
        .from('staff_users')
        .select('id,profile_id,first_name,last_name,name,position,is_active,email')
        .order('last_name', { ascending: true }),
      getArchivedUserIds(),
    ]);

    if (error) throw new Error(error.message);
    const archivedUserIds = archivedState.userIds;

    const responseData = {
      staff: (staff || [])
        .filter((member) => !member.profile_id || !archivedUserIds.has(member.profile_id))
        .map((member) => ({
          id: member.id,
          userId: member.profile_id || member.id,
          name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.name || 'Unnamed Staff',
          role: isDoctorPosition(member.position) ? 'Clinic Doctor' : (member.position || 'Clinic Staff'),
          position: member.position || 'Clinic Staff',
          status: member.is_active ? 'Active' : 'Inactive',
          email: member.email || '',
        })),
    };

    await setCachedData(cacheKey, responseData, 300);
    return c.json(responseData);
  } catch (error) {
    console.log('Error fetching staff users:', error);
    return internalServerError(c, 'Failed to fetch staff users', error);
  }
});

app.get("/user-accounts", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role)) return forbidden();

  try {
    const cacheKey = "admin:user_accounts";
    const cached = await getCachedData<any>(cacheKey);
    if (cached) return c.json(cached);

    const [
      { data: profiles, error: profilesError },
      { data: staffUsers, error: staffError },
      archivedState,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,student_id,first_name,last_name,email,role,created_at,updated_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('staff_users')
        .select('profile_id,first_name,last_name,email,is_active,position'),
      getArchivedUserIds(),
    ]);

    if (profilesError) throw new Error(profilesError.message);
    if (staffError) throw new Error(staffError.message);

    const staffByProfileId = (staffUsers || []).reduce((acc, staff) => {
      if (staff.profile_id) acc[staff.profile_id] = staff;
      return acc;
    }, {} as Record<string, any>);
    const archivedUserIds = archivedState.userIds;

    const responseData = {
      users: (profiles || [])
        .filter((profile) => !archivedUserIds.has(profile.id))
        .map((profile) => {
          const linkedStaff = staffByProfileId[profile.id];
          const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
            || [linkedStaff?.first_name, linkedStaff?.last_name].filter(Boolean).join(' ').trim()
            || profile.email
            || 'Unnamed User';

          return {
            userId: profile.id,
            id: profile.student_id || profile.id,
            name,
            email: profile.email || linkedStaff?.email || '',
            role: roleLabel(profile.role, linkedStaff?.position),
            roleKey: profile.role,
            position: linkedStaff?.position || null,
            status: linkedStaff?.is_active === false ? 'Inactive' : 'Active',
            lastActive: profile.updated_at || profile.created_at,
            canArchive: profile.role === 'student' || profile.role === 'staff',
          };
        }),
    };

    await setCachedData(cacheKey, responseData, 300);
    return c.json(responseData);
  } catch (error) {
    console.log('Error fetching user accounts:', error);
    return internalServerError(c, 'Failed to fetch user accounts', error);
  }
});

app.get("/super-admin/administrators", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');

  try {
    const cacheKey = "admin:super_admin_administrators";
    const cached = await getCachedData<any>(cacheKey);
    if (cached) return c.json(cached);

    const [{ data: profiles, error }, archiveState] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,first_name,last_name,email,role,created_at,updated_at')
        .eq('role', 'admin')
        .order('created_at', { ascending: false }),
      getArchivedAccountsTableState(),
    ]);

    if (error) throw new Error(error.message);
    let archivedAdministrators: any[] = [];
    let archivedUserIds = new Set<string>();

    if (archiveState.available) {
      const { data: archivedAccounts, error: archivedError } = await supabase
        .from('archived_accounts')
        .select('id,user_id,account_identifier,display_name,email,archive_reason,archived_at')
        .eq('role', 'admin')
        .order('archived_at', { ascending: false });

      if (archivedError) throw new Error(archivedError.message);

      archivedAdministrators = (archivedAccounts || []).map((account) => ({
        archiveId: account.id,
        userId: account.user_id,
        id: account.account_identifier || account.user_id,
        name: account.display_name || account.email || 'Archived Administrator',
        email: account.email || '',
        role: 'Administrator',
        roleKey: 'admin',
        status: 'Archived',
        archivedAt: account.archived_at,
        archivedReason: account.archive_reason || '',
      }));
      archivedUserIds = new Set(
        (archivedAccounts || [])
          .map((account) => String(account.user_id || '').trim())
          .filter(Boolean),
      );
    }

    const responseData = {
      administrators: (profiles || [])
        .filter((profile) => !archivedUserIds.has(profile.id))
        .map((profile) => {
          const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
            || profile.email
            || 'Unnamed Administrator';

          return {
            userId: profile.id,
            id: profile.id,
            name,
            email: profile.email || '',
            role: 'Administrator',
            roleKey: 'admin',
            status: 'Active',
            createdAt: profile.created_at,
            lastActive: profile.updated_at || profile.created_at,
          };
        }),
      archivedAdministrators,
    };

    await setCachedData(cacheKey, responseData, 300);
    return c.json(responseData);
  } catch (error) {
    console.log('Error fetching administrators:', error);
    return internalServerError(c, 'Failed to fetch administrators', error);
  }
});

app.post("/super-admin/administrators", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');

  try {
    const { email, password, firstName, lastName } = await c.req.json();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) return badRequest('email and password are required');
    const passwordError = getManagedPasswordPolicyError(password, {
      email: normalizedEmail,
      firstName,
      lastName,
    });
    if (passwordError) return badRequest(passwordError);

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || null,
        last_name: lastName || null,
      },
    });
    if (createError || !created?.user) throw new Error(createError?.message || 'Failed to create administrator');

    const userId = created.user.id;

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      role: 'admin',
      email: normalizedEmail,
      first_name: firstName || null,
      last_name: lastName || null,
      student_id: null,
      department: null,
      course: null,
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId).catch(() => null);
      throw new Error(profileError.message);
    }

    invalidateDashboardReadCaches();
    return c.json({ success: true, userId });
  } catch (error) {
    console.log('Error creating administrator:', error);
    return internalServerError(c, 'Failed to create administrator', error);
  }
});

app.post("/super-admin/administrators/:userId/archive", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');

  try {
    const userId = c.req.param('userId');
    if (!userId) return badRequest('userId is required');
    if (userId === requester.profile.id) return badRequest('You cannot archive your own super administrator account.');

    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) return archivedAccountsMigrationRequired();

    let reason: string | undefined;
    try {
      const body = await c.req.json();
      reason = body?.reason;
    } catch {
      reason = undefined;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,role,email,first_name,last_name,created_at,updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) return badRequest('Administrator account not found.');
    if (!isAdminRole(profile.role)) {
      return badRequest('Only administrator accounts can be archived here.');
    }

    await reassignAdministratorOwnedRows(userId, requester.profile.id);

    const displayName =
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
      || profile.email
      || 'Unnamed Administrator';

    const { error: archiveError } = await supabase
      .from('archived_accounts')
      .upsert({
        user_id: userId,
        role: profile.role,
        email: profile.email || null,
        display_name: displayName,
        account_identifier: profile.id,
        archived_by: requester.profile.id,
        archive_reason: reason?.trim() || null,
        snapshot: {
          profile: {
            role: profile.role,
            first_name: profile.first_name || null,
            last_name: profile.last_name || null,
            created_at: profile.created_at || null,
            updated_at: profile.updated_at || null,
          },
        },
        archived_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (archiveError) throw new Error(archiveError.message);

    await setArchivedAuthState(userId);
    invalidateArchivedCaches();
    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error archiving administrator:', error);
    return internalServerError(c, 'Failed to archive administrator', error);
  }
});

app.post("/super-admin/administrators/:archiveId/restore", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');

  try {
    const archiveId = c.req.param('archiveId');
    if (!archiveId) return badRequest('archiveId is required');

    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) return archivedAccountsMigrationRequired();

    const { data: archivedAccount, error: archiveLookupError } = await supabase
      .from('archived_accounts')
      .select(ARCHIVED_ACCOUNT_SELECT_COLUMNS)
      .eq('id', archiveId)
      .maybeSingle();

    if (archiveLookupError) throw new Error(archiveLookupError.message);
    if (!archivedAccount) return badRequest('Archived administrator not found.');
    if (!isAdminRole(archivedAccount.role)) {
      return badRequest('Only archived administrator accounts can be restored here.');
    }

    const userId = archivedAccount.user_id;

    const { error: archiveDeleteError } = await supabase
      .from('archived_accounts')
      .delete()
      .eq('id', archiveId);

    if (archiveDeleteError) throw new Error(archiveDeleteError.message);

    await clearArchivedAuthState(userId);
    invalidateArchivedCaches();
    invalidateDashboardReadCaches();

    return c.json({ success: true });
  } catch (error) {
    console.log('Error restoring administrator:', error);
    return internalServerError(c, 'Failed to restore administrator', error);
  }
});

app.delete("/super-admin/administrators/:userId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');
  return forbidden('Administrator accounts can no longer be deleted. Archive the account instead.');
});

app.get("/admin/system-settings", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    return c.json(await getAdminSystemSettings());
  } catch (error) {
    console.log('Error fetching admin system settings:', error);
    return internalServerError(c, 'Failed to fetch admin system settings', error);
  }
});

app.put("/admin/system-settings", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const payload = await c.req.json();
    return c.json(await saveAdminSystemSettings(payload));
  } catch (error) {
    console.log('Error saving admin system settings:', error);
    return internalServerError(c, 'Failed to save admin system settings', error);
  }
});

app.get("/archived-accounts", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role) && !isSuperAdminRole(requester.profile.role)) return forbidden();

  try {
    const cacheKey = "admin:archived_accounts";
    const cached = await getCachedData<any>(cacheKey);
    if (cached) return c.json(cached);

    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) {
      return c.json({ users: [] });
    }

    const { data: archivedAccounts, error } = await supabase
      .from('archived_accounts')
      .select('id,user_id,account_identifier,display_name,email,role,archived_at,archive_reason')
      .order('archived_at', { ascending: false });

    if (error) throw new Error(error.message);

    const responseData = {
      users: (archivedAccounts || []).map((account) => ({
        archiveId: account.id,
        userId: account.user_id,
        id: account.account_identifier || account.user_id,
        name: account.display_name || account.email || 'Archived Account',
        email: account.email || '',
        role: roleLabel(account.role),
        roleKey: account.role,
        status: 'Archived',
        archivedAt: account.archived_at,
        archivedReason: account.archive_reason || '',
      })),
    };

    await setCachedData(cacheKey, responseData, 300);
    return c.json(responseData);
  } catch (error) {
    console.log('Error fetching archived accounts:', error);
    return internalServerError(c, 'Failed to fetch archived accounts', error);
  }
});

app.post("/admin/archive-account", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role) && !isSuperAdminRole(requester.profile.role)) return forbidden();

  try {
    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) return archivedAccountsMigrationRequired();

    const { userId, reason } = await c.req.json();
    if (!userId) return badRequest('userId is required');
    if (userId === requester.profile.id) {
      return badRequest(
        isSuperAdminRole(requester.profile.role)
          ? 'You cannot archive your own super administrator account.'
          : 'You cannot archive your own administrator account.',
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(ARCHIVE_PROFILE_SELECT_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) return badRequest('User account not found.');
    if (isSuperAdminRole(requester.profile.role)) {
      if (!isAdminRole(profile.role)) {
        return badRequest('Only administrator accounts can be archived here.');
      }
      await reassignAdministratorOwnedRows(userId, requester.profile.id);
    } else if (!['student', 'staff'].includes(profile.role)) {
      return badRequest('Only student and clinic staff accounts can be archived.');
    }

    const [{ data: linkedStaff }, { data: linkedStudent }, { data: submissions, error: submissionsError }] = await Promise.all([
      supabase.from('staff_users').select(ARCHIVE_STAFF_SELECT_COLUMNS).eq('profile_id', userId).maybeSingle(),
      profile.student_id
        ? supabase.from('students').select(ARCHIVE_STUDENT_SELECT_COLUMNS).eq('student_id', profile.student_id).maybeSingle()
        : Promise.resolve({ data: null }),
      profile.student_id
        ? supabase.from('submissions').select('id,submitted_at').eq('student_id', profile.student_id)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    if (submissionsError) throw new Error(submissionsError.message);

    const displayName =
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
      || [linkedStaff?.first_name, linkedStaff?.last_name].filter(Boolean).join(' ').trim()
      || profile.email
      || 'Unnamed User';

    const archivePayload = {
      user_id: userId,
      role: profile.role,
      email: profile.email || linkedStaff?.email || null,
      display_name: displayName,
      account_identifier: profile.student_id || linkedStaff?.id || profile.id,
      archived_by: requester.profile.id,
      archive_reason: reason?.trim() || null,
      snapshot: {
        profile: {
          role: profile.role,
          first_name: profile.first_name || null,
          last_name: profile.last_name || null,
          department: profile.department || null,
          course: profile.course || null,
          student_id: profile.student_id || null,
        },
        student: linkedStudent
          ? {
            student_id: linkedStudent.student_id,
            department: linkedStudent.department || null,
            course: linkedStudent.course || null,
            year_level: linkedStudent.year_level || null,
          }
          : null,
        staff: linkedStaff
          ? {
            position: linkedStaff.position || null,
            is_active: linkedStaff.is_active ?? null,
          }
          : null,
        submissions: {
          count: submissions?.length || 0,
          last_submitted_at: (submissions || [])
            .map((entry) => entry.submitted_at)
            .filter(Boolean)
            .sort()
            .slice(-1)[0] || null,
        },
      },
      archived_at: new Date().toISOString(),
    };

    const { error: archiveError } = await supabase
      .from('archived_accounts')
      .upsert(archivePayload, { onConflict: 'user_id' });

    if (archiveError) throw new Error(archiveError.message);

    if (linkedStaff?.profile_id) {
      const { error: staffUpdateError } = await supabase
        .from('staff_users')
        .update({ is_active: false })
        .eq('profile_id', linkedStaff.profile_id);

      if (staffUpdateError) throw new Error(staffUpdateError.message);
    }

    await setArchivedAuthState(userId);
    invalidateArchivedCaches();
    invalidateDashboardReadCaches();

    return c.json({ success: true });
  } catch (error) {
    console.log('Error archiving account:', error);
    return internalServerError(c, 'Failed to archive account', error);
  }
});

app.post("/admin/restore-account/:archiveId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role) && !isSuperAdminRole(requester.profile.role)) return forbidden();

  try {
    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) return archivedAccountsMigrationRequired();

    const archiveId = c.req.param('archiveId');
    if (!archiveId) return badRequest('archiveId is required');

    const { data: archivedAccount, error: archiveLookupError } = await supabase
      .from('archived_accounts')
      .select(ARCHIVED_ACCOUNT_SELECT_COLUMNS)
      .eq('id', archiveId)
      .maybeSingle();

    if (archiveLookupError) throw new Error(archiveLookupError.message);
    if (!archivedAccount) return badRequest('Archived account not found.');
    if (isSuperAdminRole(requester.profile.role)) {
      if (!isAdminRole(archivedAccount.role)) {
        return badRequest('Only archived administrator accounts can be restored here.');
      }
    } else if (isAdminRole(archivedAccount.role)) {
      return badRequest('Administrator accounts can only be restored by a super administrator.');
    }

    const userId = archivedAccount.user_id;

    const { error: archiveDeleteError } = await supabase.from('archived_accounts').delete().eq('id', archiveId);
    if (archiveDeleteError) throw new Error(archiveDeleteError.message);

    if (archivedAccount.role === 'staff') {
      const { error: staffUpdateError } = await supabase
        .from('staff_users')
        .update({ is_active: true })
        .eq('profile_id', userId);

      if (staffUpdateError) throw new Error(staffUpdateError.message);
    }

    await clearArchivedAuthState(userId);
    invalidateArchivedCaches();
    invalidateDashboardReadCaches();

    return c.json({ success: true });
  } catch (error) {
    console.log('Error restoring account:', error);
    return internalServerError(c, 'Failed to restore account', error);
  }
});

app.delete("/admin/archive-account/:archiveId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  return forbidden('Permanent deletion of archived accounts is no longer available. Restore the account instead.');
});

app.post("/admin/create-account", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role)) return forbidden();

  try {
    const { email, password, role = 'student', firstName, lastName, studentId, department, course } = await c.req.json();
    if (!email || !password) return badRequest('email and password are required');
    const passwordError = getManagedPasswordPolicyError(password, {
      email,
      firstName,
      lastName,
      studentId,
    });
    if (passwordError) return badRequest(passwordError);
    if (!['student', 'staff'].includes(role)) {
      return badRequest('Only super administrators can create administrator accounts.');
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || null,
        last_name: lastName || null,
      },
    });
    if (createError || !created?.user) throw new Error(createError?.message || 'Failed to create user');

    const userId = created.user.id;

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      role,
      email: email.toLowerCase(),
      first_name: firstName || null,
      last_name: lastName || null,
      student_id: role === 'student' ? (studentId || null) : null,
      department: department || null,
      course: course || null,
      created_at: new Date().toISOString(),
    });
    if (profileError) throw new Error(profileError.message);

    if (role === 'student' && studentId) {
      const { error: studentError } = await supabase.from('students').upsert({
        student_id: studentId,
        profile_id: userId,
        first_name: firstName || null,
        last_name: lastName || null,
        department: department || null,
        course: course || null,
      }, { onConflict: 'student_id' });
      if (studentError) throw new Error(studentError.message);
    }

    invalidateDashboardReadCaches();
    return c.json({ success: true, userId });
  } catch (error) {
    console.log('Error creating account:', error);
    return internalServerError(c, 'Failed to create account', error);
  }
});

app.post("/admin/create-staff", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role)) return forbidden();

  try {
    const { email, password, firstName, lastName, position = 'Clinic Staff' } = await c.req.json();
    if (!email || !password || !firstName || !lastName) return badRequest('email, password, firstName, and lastName are required');
    const passwordError = getManagedPasswordPolicyError(password, {
      email,
      firstName,
      lastName,
    });
    if (passwordError) return badRequest(passwordError);
    if (!['Clinic Staff', 'Clinic Doctor'].includes(position)) return badRequest('position must be either Clinic Staff or Clinic Doctor');

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });
    if (createError || !created?.user) throw new Error(createError?.message || 'Failed to create user');

    const userId = created.user.id;
    const normalizedEmail = email.toLowerCase();

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      role: 'staff',
      email: normalizedEmail,
      first_name: firstName,
      last_name: lastName,
      created_at: new Date().toISOString(),
    });
    if (profileError) throw new Error(profileError.message);

    const { error: staffError } = await supabase.from('staff_users').upsert({
      profile_id: userId,
      email: normalizedEmail,
      name: `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      position,
      is_active: true,
    }, { onConflict: 'profile_id' });
    if (staffError) throw new Error(staffError.message);

    invalidateDashboardReadCaches();
    return c.json({ success: true, userId });
  } catch (error) {
    console.log('Error creating staff:', error);
    return internalServerError(c, 'Failed to create staff', error);
  }
});

app.post("/issue-certificate", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();
  if (!isDoctorOrAdmin(requester)) {
    return c.json({ error: 'Only Clinic Doctors can issue certificates.' }, 403);
  }

  try {
    const {
      submissionId,
      findingsNormal,
      diagnosis,
      remarks,
      purpose,
      controlNo,
      issuedDate,
      licenseNo,
      signatoryName,
    } = await c.req.json();

    if (!submissionId) return badRequest('submissionId is required');

    const issuedDateText = String(issuedDate || '').trim();
    const issuedTimestamp = issuedDateText
      ? new Date(`${issuedDateText}T00:00:00`).toISOString()
      : new Date().toISOString();

    const baseCertificatePayload = {
      submission_id: submissionId,
      findings_normal: findingsNormal ?? true,
      diagnosis: diagnosis || null,
      remarks: remarks || null,
      purpose: purpose || null,
      control_no: controlNo || null,
      license_no: licenseNo || null,
      issued_by: requester.staff?.id || null,
      issued_date: issuedDateText || null,
      issued_at: issuedTimestamp,
    };
    const normalizedSignatoryName = String(signatoryName || "").trim();
    const certificatePayload = normalizedSignatoryName
      ? { ...baseCertificatePayload, signatory_name: normalizedSignatoryName }
      : baseCertificatePayload;

    let { error } = await supabase
      .from('certificates')
      .upsert(certificatePayload, { onConflict: 'submission_id' });

    if (
      error &&
      normalizedSignatoryName &&
      String(error.message || "").toLowerCase().includes("signatory_name")
    ) {
      ({ error } = await supabase
        .from('certificates')
        .upsert(baseCertificatePayload, { onConflict: 'submission_id' }));
    }

    if (
      error &&
      String(error.message || "").toLowerCase().includes("issued_by")
    ) {
      const { issued_by, ...basePayloadWithoutIssuer } = baseCertificatePayload;
      const fallbackCertificatePayload = normalizedSignatoryName
        ? { ...basePayloadWithoutIssuer, signatory_name: normalizedSignatoryName }
        : basePayloadWithoutIssuer;

      ({ error } = await supabase
        .from('certificates')
        .upsert(fallbackCertificatePayload, { onConflict: 'submission_id' }));
    }

    if (error) throw new Error(error.message);

    const { data: submissionRow } = await supabase
      .from('submissions')
      .select('student_id')
      .eq('id', submissionId)
      .maybeSingle();

    if (submissionRow?.student_id) {
      invalidateStudentRecordsCache(String(submissionRow.student_id));
    }
    invalidateDashboardReadCaches();

    return c.json({ success: true });
  } catch (error) {
    console.log('Error issuing certificate:', error);
    return internalServerError(c, 'Failed to issue certificate', error);
  }
});

Deno.serve(app.fetch);
