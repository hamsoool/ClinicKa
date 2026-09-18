/**
 * AES-256-GCM Application-Layer Cryptography for ClinicKa
 * 
 * Provides end-to-end payload encryption matching backend App\Services\CryptoService.
 * Uses native Web Crypto API (crypto.subtle) for maximum performance and security.
 */

export interface EncryptedEnvelope {
  iv: string;
  tag: string;
  data: string;
}

const CIPHER_ALGORITHM = 'AES-GCM';
const IV_LENGTH_BYTES = 12; // 96 bits
const TAG_LENGTH_BITS = 128; // 16 bytes

let cachedKey: CryptoKey | null = null;

/**
 * Convert a Uint8Array into a standard Base64 string.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a standard Base64 string into a Uint8Array.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Check whether a value conforms to the EncryptedEnvelope structure.
 */
export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'iv' in value &&
    'tag' in value &&
    'data' in value &&
    typeof (value as EncryptedEnvelope).iv === 'string' &&
    typeof (value as EncryptedEnvelope).tag === 'string' &&
    typeof (value as EncryptedEnvelope).data === 'string'
  );
}

/**
 * Resolve the AES-GCM CryptoKey using SHA-256 key derivation matching Laravel CryptoService.
 */
async function getCryptoKey(): Promise<CryptoKey> {
  if (cachedKey) {
    return cachedKey;
  }

  const rawSecret =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_PAYLOAD_SECRET) || '';

  if (!rawSecret) {
    throw new Error('Missing VITE_API_PAYLOAD_SECRET in environment configuration.');
  }

  let keyBytes: Uint8Array;

  // If prefixed with base64:, decode base64
  if (rawSecret.startsWith('base64:')) {
    keyBytes = base64ToBytes(rawSecret.substring(7));
  } else {
    // Derive exactly 32 bytes using SHA-256 (identical to hash('sha256', $rawKey, true))
    const encodedSecret = new TextEncoder().encode(rawSecret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedSecret);
    keyBytes = new Uint8Array(hashBuffer);
  }

  cachedKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: CIPHER_ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );

  return cachedKey;
}

/**
 * Encrypt any serializable data into an AES-256-GCM envelope.
 */
export async function encryptPayload(data: unknown): Promise<EncryptedEnvelope> {
  const key = await getCryptoKey();
  const plaintextString = JSON.stringify(data);
  const plaintextBytes = new TextEncoder().encode(plaintextString);

  // Generate random 96-bit (12 byte) IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));

  // In Web Crypto API, tagLength: 128 appends the 16-byte tag to the ciphertext
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: CIPHER_ALGORITHM,
      iv: iv as unknown as BufferSource,
      tagLength: TAG_LENGTH_BITS,
    },
    key,
    plaintextBytes as unknown as BufferSource
  );

  const totalLength = encryptedBuffer.byteLength;
  const tagLengthBytes = TAG_LENGTH_BITS / 8; // 16 bytes
  const ciphertextBytes = new Uint8Array(encryptedBuffer, 0, totalLength - tagLengthBytes);
  const tagBytes = new Uint8Array(encryptedBuffer, totalLength - tagLengthBytes, tagLengthBytes);

  return {
    iv: bytesToBase64(iv),
    tag: bytesToBase64(tagBytes),
    data: bytesToBase64(ciphertextBytes),
  };
}

/**
 * Decrypt an AES-256-GCM envelope into the original data type.
 */
export async function decryptPayload<T = unknown>(envelope: EncryptedEnvelope): Promise<T> {
  const key = await getCryptoKey();

  const iv = base64ToBytes(envelope.iv);
  const tag = base64ToBytes(envelope.tag);
  const ciphertext = base64ToBytes(envelope.data);

  // Web Crypto decrypt expects [ciphertext, tag] concatenated together
  const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.byteLength);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: CIPHER_ALGORITHM,
      iv: iv as unknown as BufferSource,
      tagLength: TAG_LENGTH_BITS,
    },
    key,
    combined as unknown as BufferSource
  );

  const decryptedString = new TextDecoder().decode(decryptedBuffer);
  try {
    return JSON.parse(decryptedString) as T;
  } catch {
    return decryptedString as unknown as T;
  }
}
