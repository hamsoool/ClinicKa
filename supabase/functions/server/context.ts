// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

export const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
export const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
export const requestLoggingEnabled = Deno.env.get("ENABLE_REQUEST_LOGGING") === "true";
export const debugErrorsEnabled = Deno.env.get("DEBUG_ERRORS") === "true";
export const minPasswordLength = 8;
const configuredSignedUrlSeconds = Number(
  Deno.env.get("SIGNED_STORAGE_URL_EXPIRES_SECONDS") || "900",
);
export const signedStorageUrlExpiresSeconds =
  Number.isFinite(configuredSignedUrlSeconds) && configuredSignedUrlSeconds > 0
    ? Math.min(configuredSignedUrlSeconds, 60 * 60)
    : 900;
export const allowVercelPreviewOrigins =
  Deno.env.get("ALLOW_VERCEL_PREVIEW_ORIGINS") === "true";

export function normalizeOrigin(origin?: string | null) {
  const value = String(origin || "").trim().replace(/\/+$/, "");
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export const allowedCorsOrigins = new Set(
  [
    Deno.env.get("SITE_URL"),
    Deno.env.get("VITE_SITE_URL"),
    Deno.env.get("APP_ORIGIN"),
    ...(Deno.env.get("ALLOWED_ORIGINS") || "").split(","),
    "https://clinicka.vercel.app/",
    "https://clinic-ka.vercel.app/",
  ]
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean),
);

export function resolveCorsOrigin(origin?: string | null) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return "";
  if (allowedCorsOrigins.has(normalizedOrigin)) return normalizedOrigin;
  if (
    allowVercelPreviewOrigins &&
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalizedOrigin)
  ) {
    return normalizedOrigin;
  }
  return "";
}

export function buildCorsHeaders(origin?: string | null) {
  const allowedOrigin = resolveCorsOrigin(origin);
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function internalServerError(c: any, message: string, error: unknown) {
  const body = debugErrorsEnabled
    ? { error: message, details: String(error) }
    : { error: message };
  return c.json(body, 500);
}

export function passwordLengthError() {
  return `password must be at least ${minPasswordLength} characters`;
}

function getPasswordCharacterCount(password?: string | null) {
  return Array.from(String(password || "")).length;
}

export function getManagedPasswordPolicyError(
  password?: string | null,
  _input?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    studentId?: string | null;
  },
) {
  const resolvedPassword = String(password || "");
  if (!/\S/u.test(resolvedPassword)) {
    return "password cannot be blank or only spaces";
  }
  if (getPasswordCharacterCount(resolvedPassword) < minPasswordLength) {
    return passwordLengthError();
  }

  return null;
}

export const supabase = createClient(supabaseUrl, serviceRoleKey);
export const bucketName = "medical-files";
export const storageBuckets = [
  bucketName,
  "profile",
  "student_signature",
  "staff_signature",
  "lab_chest_xray",
  "lab_cbc",
  "lab_urinalysis",
];

export type TimedValue<T> = {
  value: T;
  expiresAt: number;
};

export type Requester = {
  user: any;
  profile: any;
  student: any;
  staff: any;
  archivedAccount?: any;
};

export const isAdminRole = (role?: string) => role === "admin";
export const isSuperAdminRole = (role?: string) => role === "super_admin";
export const isStaffRole = (role?: string) => role === "staff" || isAdminRole(role);

const DOCTOR_POSITIONS = ["clinic doctor", "doctor"];

export function isDoctorPosition(position?: string | null) {
  if (!position) return false;
  return DOCTOR_POSITIONS.includes(position.trim().toLowerCase());
}

export function isDoctorOrAdmin(requester: Requester) {
  if (isAdminRole(requester.profile.role)) return true;
  if (
    requester.profile.role === "staff" &&
    isDoctorPosition(requester.staff?.position)
  ) {
    return true;
  }
  return false;
}

export function normalizeEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

export function normalizeNamePart(value?: string | null) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export function isMissingRelationError(error: any) {
  const message = String(error?.message || error?.details || error || "").toLowerCase();
  return (
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

export function getValidCachedValue<T>(
  cached: TimedValue<T> | null | undefined,
) {
  if (!cached) return null;
  return cached.expiresAt > Date.now() ? cached.value : null;
}

export function createTimedValue<T>(value: T, ttlMs: number): TimedValue<T> {
  return {
    value,
    expiresAt: Date.now() + ttlMs,
  };
}

export function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export function unauthorized(message = "Unauthorized") {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export function forbidden(message = "Forbidden") {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export function archivedAccountForbidden() {
  return forbidden(
    "This account has been archived. Please contact an administrator for assistance.",
  );
}

