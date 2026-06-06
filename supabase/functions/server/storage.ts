// @ts-nocheck
import {
  buildCloudinaryDeliveryUrl,
  destroyCloudinaryAsset,
  isCloudinaryFile,
} from "./cloudinary.ts";

function normalizeCloudinaryUrl(url?: string | null) {
  const trimmed = String(url || "").trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return /res\.cloudinary\.com/i.test(trimmed) ? trimmed : null;
}

export function normalizeProfileAssetType(file: any) {
  const rawType = String(file?.type || "").trim().toLowerCase();
  const bucket = String(file?.storage_bucket || "").trim().toLowerCase();
  const haystack = [
    rawType,
    file?.file_name,
    file?.storage_path,
    file?.url,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (
    rawType === "staff_signature" ||
    rawType === "staff-signature" ||
    bucket === "staff_signature" ||
    bucket === "staff_signatures" ||
    haystack.includes("staff_signature") ||
    haystack.includes("staff-signature") ||
    haystack.includes("staff_signatures") ||
    haystack.includes("staff-signatures")
  ) {
    return "";
  }

  if (["photo", "profile", "profile_photo", "student_photo"].includes(rawType)) {
    return "photo";
  }
  if (["signature", "student_signature", "student-signature"].includes(rawType)) {
    return "signature";
  }

  if (bucket === "profile") return "photo";
  if (bucket === "student_signature") return "signature";

  if (
    haystack.includes("student_signature") ||
    /(^|[\/_\-\s])signature([._\-\s]|$)/.test(haystack) ||
    /(^|[\/_\-\s])sign([._\-\s]|$)/.test(haystack)
  ) {
    return "signature";
  }

  if (
    haystack.includes("profile") ||
    haystack.includes("photo") ||
    haystack.includes("1x1") ||
    haystack.includes("picture")
  ) {
    return "photo";
  }

  return "";
}

export function normalizeProfileAssetRows(files: any[] | null | undefined) {
  return (files || [])
    .map((file) => {
      const type = normalizeProfileAssetType(file);
      return type ? { ...file, type } : null;
    })
    .filter(Boolean);
}

export function normalizeStaffSignatureRows(files: any[] | null | undefined) {
  return (files || [])
    .map((file) => {
      const rawType = String(file?.type || "").trim().toLowerCase();
      const bucket = String(file?.storage_bucket || "").trim().toLowerCase();
      const uploadedBy = String(file?.uploaded_by || "").trim();
      const isUnassignedSignature = rawType === "signature" && !String(file?.submission_id || "").trim();
      const haystack = [
        rawType,
        bucket,
        file?.file_name,
        file?.storage_path,
        file?.url,
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
        .join(" ");
      const isStaffSignature =
        rawType === "staff_signature" ||
        rawType === "staff-signature" ||
        isUnassignedSignature ||
        bucket === "staff_signature" ||
        bucket === "staff_signatures" ||
        haystack.includes("staff_signature") ||
        haystack.includes("staff-signature") ||
        haystack.includes("staff_signatures") ||
        haystack.includes("staff-signatures");

      return isStaffSignature && uploadedBy ? { ...file, type: "staff_signature" } : null;
    })
    .filter(Boolean);
}

function getCloudinaryFileUrl(file: any) {
  if (isCloudinaryFile(file)) {
    return buildCloudinaryDeliveryUrl(file);
  }
  return normalizeCloudinaryUrl(file?.url);
}

export async function normalizeFileRows(files: any[] | null | undefined) {
  return Promise.all(
    (files || []).map(async (file) => {
      const url = getCloudinaryFileUrl(file);
      if (!url) {
        return {
          ...file,
          url: null,
        };
      }

      return {
        ...file,
        storage_provider: "cloudinary",
        storage_bucket: null,
        url,
      };
    }),
  );
}

export async function deleteStoredFiles(files: any[]) {
  const cloudinaryFiles = (files || []).filter(isCloudinaryFile);
  for (const file of cloudinaryFiles) {
    await destroyCloudinaryAsset(
      file?.cloudinary_public_id,
      file?.cloudinary_resource_type || "image",
    );
  }
}
