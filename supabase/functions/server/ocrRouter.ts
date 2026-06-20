// @ts-nocheck
// Single dispatch point for OCR. Reads the admin `ocrProvider` system setting
// and routes the request to either Azure AI Vision (ocr.ts) or OCR.space
// (ocr-space-ocr.ts). Both providers share identical field parsers; only the
// upstream client half differs. The chosen provider's typed errors
// (OcrConfigurationError / OcrRequestError and the OCR.space equivalents)
// propagate unchanged so the route handlers can map status codes.

import { getSafeAdminSystemSettings, resolveOcrProvider, type OcrProvider } from "./settings.ts";
import {
  readChestXrayWithOcr,
  readCbcWithOcr,
  readUrinalysisWithOcr,
  resolveOcrInputMimeType as resolveAzureOcrInputMimeType,
} from "./ocr.ts";
import {
  readChestXrayWithOcrSpace,
  readCbcWithOcrSpace,
  readUrinalysisWithOcrSpace,
} from "./ocr-space-ocr.ts";

export type LabDocumentType = "chest-xray" | "cbc" | "urinalysis";

export type OcrInput = {
  content: ArrayBuffer | Uint8Array;
  fileName?: string | null;
  mimeType: string;
};

// Both providers accept the same file types and their resolvers behave
// identically, so this delegate keeps callers provider-agnostic without an
// async settings lookup.
export function resolveOcrInputMimeType(mimeType?: string | null, fileName?: string | null) {
  return resolveAzureOcrInputMimeType(mimeType, fileName);
}

const AZURE_VISION_DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const OCR_SPACE_DEFAULT_MAX_BYTES = 1 * 1024 * 1024;

function formatFileSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}

// Per-provider upload ceiling, honouring optional env overrides.
export function getOcrProviderMaxBytes(provider: OcrProvider) {
  if (provider === "azure") {
    const configuredMaxBytes = Number(Deno.env.get("AZURE_VISION_MAX_BYTES") || "");
    return Number.isFinite(configuredMaxBytes) && configuredMaxBytes > 0
      ? Math.floor(configuredMaxBytes)
      : AZURE_VISION_DEFAULT_MAX_BYTES;
  }

  const configuredMaxBytes = Number(Deno.env.get("OCR_SPACE_MAX_BYTES") || "");
  return Number.isFinite(configuredMaxBytes) && configuredMaxBytes > 0
    ? Math.floor(configuredMaxBytes)
    : OCR_SPACE_DEFAULT_MAX_BYTES;
}

function getOcrProviderLabel(provider: OcrProvider) {
  return provider === "azure" ? "Azure AI Vision" : "OCR.space";
}

// Fetch the admin-selected provider for the current request. Defaults to the
// production-style OCR.space when unset/invalid.
export async function getActiveOcrProvider(): Promise<OcrProvider> {
  try {
    const settings = await getSafeAdminSystemSettings();
    return resolveOcrProvider(settings?.ocrProvider);
  } catch {
    return resolveOcrProvider(undefined);
  }
}

async function dispatchOcrRead(
  provider: OcrProvider,
  documentType: LabDocumentType,
  input: OcrInput,
) {
  const maxBytes = getOcrProviderMaxBytes(provider);
  const contentBytes =
    input.content instanceof Uint8Array ? input.content : new Uint8Array(input.content);
  if (contentBytes.byteLength > maxBytes) {
    throw new Error(
      `${getOcrProviderLabel(provider)} supports files up to ${formatFileSize(maxBytes)}.`,
    );
  }

  if (provider === "azure") {
    if (documentType === "chest-xray") return readChestXrayWithOcr(input);
    if (documentType === "cbc") return readCbcWithOcr(input);
    return readUrinalysisWithOcr(input);
  }

  if (documentType === "chest-xray") return readChestXrayWithOcrSpace(input);
  if (documentType === "cbc") return readCbcWithOcrSpace(input);
  return readUrinalysisWithOcrSpace(input);
}

// Run OCR for a lab document using the admin-configured provider. Returns the
// provider's result enriched with the normalized `provider` id so callers know
// which engine answered.
export async function readLabResult(
  options: { documentType: LabDocumentType; input: OcrInput },
) {
  const provider = await getActiveOcrProvider();
  const result = await dispatchOcrRead(provider, options.documentType, options.input);
  return { ...result, provider };
}
