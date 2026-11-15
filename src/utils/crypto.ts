import type { EncryptedVaultEnvelope } from '../types/expense';

const PBKDF2_ITERATIONS = 100_000;

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is unavailable in this environment.');
}

function getRandomValues(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function deriveAesGcmKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    toArrayBuffer(encoder.encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptVaultPayload<T>(
  payload: T,
  passphrase: string,
  hasCustomPassphrase = false,
): Promise<EncryptedVaultEnvelope> {
  const subtle = getSubtleCrypto();
  const salt = getRandomValues(16);
  const iv = getRandomValues(12);
  const key = await deriveAesGcmKey(passphrase, salt, PBKDF2_ITERATIONS);

  const encoder = new TextEncoder();
  const encoded = encoder.encode(JSON.stringify(payload));

  const ciphertextBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(encoded),
  );

  return {
    version: 1,
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    saltBase64: bytesToBase64(salt),
    ivBase64: bytesToBase64(iv),
    ciphertextBase64: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    updatedAt: new Date().toISOString(),
    hasCustomPassphrase,
  };
}

export async function decryptVaultPayload<T>(
  envelope: EncryptedVaultEnvelope,
  passphrase: string,
): Promise<T> {
  const subtle = getSubtleCrypto();
  const salt = base64ToBytes(envelope.saltBase64);
  const iv = base64ToBytes(envelope.ivBase64);
  const ciphertext = base64ToBytes(envelope.ciphertextBase64);

  const key = await deriveAesGcmKey(passphrase, salt, envelope.iterations);

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(iv),
      },
      key,
      toArrayBuffer(ciphertext),
    );
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer)) as T;
  } catch {
    throw new Error('Decryption failed: invalid passphrase or corrupted vault data.');
  }
}

export async function computeSha256Fingerprint(input: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const encoded = new TextEncoder().encode(input);
  const digest = await subtle.digest('SHA-256', toArrayBuffer(encoded));
  const hex = Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
  return hex.toUpperCase();
}
