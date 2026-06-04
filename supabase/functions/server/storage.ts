// @ts-nocheck
import {
  bucketName,
  signedStorageUrlExpiresSeconds,
  storageBuckets,
  supabase,
} from "./context.ts";

const SIGNED_URL_REFRESH_BUFFER_SECONDS = 60;
const SIGNED_URL_CACHE_MAX_ENTRIES = 500;
const signedUrlCache = new Map<string, { url: string | null; expiresAt: number }>();
const signedUrlPromises = new Map<string, Promise<string | null>>();

export function inferStorageBucket(file: any) {
  const explicitBucket = String(file?.storage_bucket || "").trim();
  if (explicitBucket) return explicitBucket;

  const storagePath = String(file?.storage_path || "").replace(/^\/+/, "");
  const firstSegment = storagePath.split("/")[0]?.trim();
  if (firstSegment && storageBuckets.includes(firstSegment)) return firstSegment;

  const type = String(file?.type || "").toLowerCase();
  if (type === "photo") return "profile";
  if (type === "profile" || type === "profile_photo" || type === "student_photo") return "profile";
  if (type === "signature" || type === "student_signature") return "student_signature";
  if (type === "staff_signature" || type === "staff-signature" || type === "staff_signatures") return "staff_signatures";
  if (type === "xray") return "lab_chest_xray";
  if (type === "cbc") return "lab_cbc";
  if (type === "urinalysis") return "lab_urinalysis";

  return bucketName;
}

export function normalizeStoragePath(
  storagePath?: string | null,
  targetBucket?: string | null,
) {
  const path = String(storagePath || "").replace(/^\/+/, "");
  const normalizedBucket = String(targetBucket || "").trim();
  if (!path) return "";
  if (normalizedBucket && path.startsWith(`${normalizedBucket}/`)) {
    return path.slice(normalizedBucket.length + 1);
  }
  return path;
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
        bucket === "staff_signature" ||
        bucket === "staff_signatures" ||
        haystack.includes("staff_signature") ||
        haystack.includes("staff-signature") ||
        haystack.includes("staff_signatures") ||
        haystack.includes("staff-signatures");

      return isStaffSignature ? { ...file, type: "staff_signature" } : null;
    })
    .filter(Boolean);
}

async function createTemporaryFileUrl(file: any) {
  const resolvedBucket = inferStorageBucket(file);
  const storagePath = normalizeStoragePath(file?.storage_path, resolvedBucket);
  if (!resolvedBucket || !storagePath) {
    return String(file?.url || "").trim() || null;
  }

  const cacheKey = `${resolvedBucket}:${storagePath}`;
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const inFlight = signedUrlPromises.get(cacheKey);
  if (inFlight) return inFlight;

  const nextPromise = (async () => {
    const { data, error } = await supabase.storage
      .from(resolvedBucket)
      .createSignedUrl(storagePath, signedStorageUrlExpiresSeconds);

    const url = error ? null : data?.signedUrl || null;
    const cacheTtlSeconds = Math.max(
      30,
      signedStorageUrlExpiresSeconds - SIGNED_URL_REFRESH_BUFFER_SECONDS,
    );
    if (signedUrlCache.size >= SIGNED_URL_CACHE_MAX_ENTRIES) {
      const oldestKey = signedUrlCache.keys().next().value;
      if (oldestKey) signedUrlCache.delete(oldestKey);
    }
    signedUrlCache.set(cacheKey, {
      url,
      expiresAt: Date.now() + cacheTtlSeconds * 1000,
    });

    return url;
  })().finally(() => {
    signedUrlPromises.delete(cacheKey);
  });

  signedUrlPromises.set(cacheKey, nextPromise);
  return nextPromise;
}

export async function normalizeFileRows(files: any[] | null | undefined) {
  return Promise.all(
    (files || []).map(async (file) => {
      const storageBucket = inferStorageBucket(file);
      return {
        ...file,
        storage_bucket: storageBucket,
        url: await createTemporaryFileUrl(file),
      };
    }),
  );
}

const profileAssetStorageConfigs = [
  { type: "photo", bucket: "profile" },
  { type: "signature", bucket: "student_signature" },
] as const;

const submissionStorageConfigs = [
  { bucket: "lab_chest_xray", type: "xray" },
  { bucket: "lab_cbc", type: "cbc" },
  { bucket: "lab_urinalysis", type: "urinalysis" },
  { bucket: bucketName, type: "" },
] as const;

const staffSignatureStorageConfigs = [
  { bucket: "staff_signatures", prefixFor: (profileId: string) => `${profileId}/` },
  { bucket: "staff_signatures", prefixFor: (profileId: string) => `staff-signatures/${profileId}/` },
  { bucket: "staff_signature", prefixFor: (profileId: string) => `${profileId}/` },
  { bucket: "staff_signature", prefixFor: (profileId: string) => `staff-signatures/${profileId}/` },
  { bucket: "student_signature", prefixFor: (profileId: string) => `staff-signatures/${profileId}/` },
] as const;

function getStorageItemTime(item: any) {
  const time = new Date(
    String(item?.updated_at || item?.created_at || item?.last_accessed_at || 0),
  ).getTime();
  return Number.isFinite(time) ? time : 0;
}

export async function listProfileAssetsFromStorage(studentId: string) {
  const targetStudentId = String(studentId || "").trim();
  if (!targetStudentId) return [] as any[];

  const prefixes = [`${targetStudentId}/`, `profiles/${targetStudentId}/`];
  const rows = await Promise.all(
    profileAssetStorageConfigs.map(async ({ type, bucket }) => {
      const candidates: Array<{
        name: string;
        prefix: string;
        updatedAt: number;
      }> = [];

      await Promise.all(
        prefixes.map(async (prefix) => {
          try {
            const { data, error } = await supabase.storage.from(bucket).list(prefix, {
              limit: 100,
              offset: 0,
            });

            if (error || !data?.length) return;

            for (const item of data) {
              const name = String(item?.name || "").trim();
              if (!name || (!item?.id && !item?.metadata)) continue;
              candidates.push({
                name,
                prefix,
                updatedAt: getStorageItemTime(item),
              });
            }
          } catch {
            // Missing legacy asset folders should not fail the whole records response.
          }
        }),
      );

      const latest = candidates.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (!latest) return null;

      const storagePath = `${latest.prefix}${latest.name}`;
      const row = {
        id: `profile-${bucket}-${targetStudentId}-${storagePath}`,
        submission_id: null,
        type,
        file_name: latest.name,
        storage_bucket: bucket,
        storage_path: storagePath,
        mime_type: null,
        uploaded_at: new Date(latest.updatedAt || Date.now()).toISOString(),
        uploaded_by: null,
      };
      const url = await createTemporaryFileUrl(row);
      return url ? { ...row, url } : null;
    }),
  );

  return rows.filter(Boolean);
}

function inferSubmissionFileType(fileName: string, bucket?: string | null) {
  const haystack = `${bucket || ""} ${fileName || ""}`.trim().toLowerCase();
  if (
    String(bucket || "").trim().toLowerCase() === "lab_chest_xray" ||
    haystack.includes("xray") ||
    haystack.includes("x-ray") ||
    haystack.includes("chest")
  ) {
    return "xray";
  }
  if (
    String(bucket || "").trim().toLowerCase() === "lab_cbc" ||
    haystack.includes("cbc") ||
    haystack.includes("blood") ||
    haystack.includes("hematology")
  ) {
    return "cbc";
  }
  if (
    String(bucket || "").trim().toLowerCase() === "lab_urinalysis" ||
    haystack.includes("urinalysis") ||
    haystack.includes("urine")
  ) {
    return "urinalysis";
  }
  return "other";
}

export async function listSubmissionFilesFromStorage(submissionId: string) {
  const targetSubmissionId = String(submissionId || "").trim();
  if (!targetSubmissionId) return [] as any[];

  const prefix = `${targetSubmissionId}/`;
  const rows = await Promise.all(
    submissionStorageConfigs.map(async ({ bucket, type }) => {
      try {
        const { data, error } = await supabase.storage.from(bucket).list(prefix, {
          limit: 100,
          offset: 0,
        });

        if (error || !data?.length) return [] as any[];

        const files = await Promise.all(
          data
            .filter((item) => item?.name && (item?.id || item?.metadata))
            .map(async (item) => {
              const fileName = String(item.name || "").trim();
              if (!fileName) return null;

              const storagePath = `${prefix}${fileName}`;
              const row = {
                id: `submission-${bucket}-${targetSubmissionId}-${storagePath}`,
                submission_id: targetSubmissionId,
                type: type || inferSubmissionFileType(fileName, bucket),
                file_name: fileName,
                storage_bucket: bucket,
                storage_path: storagePath,
                mime_type: null,
                uploaded_at: new Date(getStorageItemTime(item) || Date.now()).toISOString(),
                uploaded_by: null,
              };
              const url = await createTemporaryFileUrl(row);
              return url ? { ...row, url } : null;
            }),
        );

        return files.filter(Boolean);
      } catch {
        return [] as any[];
      }
    }),
  );

  return rows.flat();
}

export async function listStaffSignatureFromStorage(profileId: string) {
  const targetProfileId = String(profileId || "").trim();
  if (!targetProfileId) return [] as any[];

  const rows = await Promise.all(
    staffSignatureStorageConfigs.map(async ({ bucket, prefixFor }) => {
      const prefix = prefixFor(targetProfileId);
      try {
        const { data, error } = await supabase.storage.from(bucket).list(prefix, {
          limit: 100,
          offset: 0,
        });

        if (error || !data?.length) return null;

        const latest = data
          .filter((item) => item?.name && (item?.id || item?.metadata))
          .sort((a, b) => getStorageItemTime(b) - getStorageItemTime(a))[0];
        if (!latest?.name) return null;

        const storagePath = `${prefix}${latest.name}`;
        const row = {
          id: `staff-signature-${bucket}-${targetProfileId}-${storagePath}`,
          submission_id: null,
          type: "staff_signature",
          file_name: latest.name,
          storage_bucket: bucket,
          storage_path: storagePath,
          mime_type: null,
          uploaded_at: new Date(getStorageItemTime(latest) || Date.now()).toISOString(),
          uploaded_by: targetProfileId,
        };
        const url = await createTemporaryFileUrl(row);
        return url ? { ...row, url } : null;
      } catch {
        return null;
      }
    }),
  );

  return rows.filter(Boolean);
}

function isMissingStorageBucketError(error: any) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("bucket") && message.includes("not found");
}

const ensuredStorageBuckets = new Set<string>();

export async function ensureBucket() {
  await ensureStorageBucket(bucketName);
}

export async function ensureStorageBucket(targetBucket: string) {
  const normalizedBucket = String(targetBucket || "").trim();
  if (!normalizedBucket) return;
  if (ensuredStorageBuckets.has(normalizedBucket)) return;

  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((bucket) => bucket.name === normalizedBucket);

  if (!exists) {
    await supabase.storage.createBucket(normalizedBucket, { public: false });
  }
  ensuredStorageBuckets.add(normalizedBucket);
}

export async function deleteStoredFiles(files: any[]) {
  const filesByBucket = (files || []).reduce((acc, file) => {
    const resolvedBucket = inferStorageBucket(file);
    const storagePath = normalizeStoragePath(file?.storage_path, resolvedBucket);
    if (!resolvedBucket || !storagePath) return acc;
    acc[resolvedBucket] = acc[resolvedBucket] || [];
    acc[resolvedBucket].push(storagePath);
    return acc;
  }, {} as Record<string, string[]>);

  for (const [targetBucket, paths] of Object.entries(filesByBucket)) {
    if (!paths.length) continue;
    const uniquePaths = [...new Set(paths)];
    const { error } = await supabase.storage.from(targetBucket).remove(uniquePaths);
    if (error) {
      throw new Error(error.message);
    }
  }
}

async function listStoragePaths(bucket: string, prefix: string) {
  const cleanedPrefix = String(prefix || "").replace(/^\/+/, "");
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(cleanedPrefix, {
      limit: 1000,
      offset,
    });

    if (error) {
      if (isMissingStorageBucketError(error)) return [];
      throw new Error(error.message);
    }

    if (!data?.length) break;

    for (const item of data) {
      if (!item?.name) continue;
      if (!item?.id && !item?.metadata) continue;
      const fullPath = cleanedPrefix ? `${cleanedPrefix}${item.name}` : item.name;
      paths.push(fullPath);
    }

    if (data.length < 1000) break;
    offset += data.length;
  }

  return paths;
}

async function deleteStoragePrefix(bucket: string, prefix: string) {
  const paths = await listStoragePaths(bucket, prefix);
  if (!paths.length) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw new Error(error.message);
}

export async function deleteStoragePrefixes(buckets: string[], prefixes: string[]) {
  for (const bucket of buckets) {
    for (const prefix of prefixes) {
      if (!prefix) continue;
      await deleteStoragePrefix(bucket, prefix);
    }
  }
}
