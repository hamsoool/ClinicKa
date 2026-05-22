// @ts-nocheck
import {
  bucketName,
  signedStorageUrlExpiresSeconds,
  storageBuckets,
  supabase,
} from "./context.ts";

export function inferStorageBucket(file: any) {
  const explicitBucket = String(file?.storage_bucket || "").trim();
  if (explicitBucket) return explicitBucket;

  const storagePath = String(file?.storage_path || "").replace(/^\/+/, "");
  const firstSegment = storagePath.split("/")[0]?.trim();
  if (firstSegment && storageBuckets.includes(firstSegment)) return firstSegment;

  const type = String(file?.type || "").toLowerCase();
  if (type === "photo") return "profile";
  if (type === "signature") return "student_signature";
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

async function createTemporaryFileUrl(file: any) {
  const resolvedBucket = inferStorageBucket(file);
  const storagePath = normalizeStoragePath(file?.storage_path, resolvedBucket);
  if (!resolvedBucket || !storagePath) {
    return String(file?.url || "").trim() || null;
  }

  const { data, error } = await supabase.storage
    .from(resolvedBucket)
    .createSignedUrl(storagePath, signedStorageUrlExpiresSeconds);

  if (error) return null;
  return data?.signedUrl || null;
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

function isMissingStorageBucketError(error: any) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("bucket") && message.includes("not found");
}

export async function ensureBucket() {
  await ensureStorageBucket(bucketName);
}

export async function ensureStorageBucket(targetBucket: string) {
  const normalizedBucket = String(targetBucket || "").trim();
  if (!normalizedBucket) return;

  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((bucket) => bucket.name === normalizedBucket);

  if (!exists) {
    await supabase.storage.createBucket(normalizedBucket, { public: false });
  }
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
