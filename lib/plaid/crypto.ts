import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;

function encryptionKey(): Buffer {
  const encoded = process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEY is not set.");
  }
  let key: Buffer;
  try {
    key = Buffer.from(encoded, "base64");
  } catch {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEY is not valid base64.");
  }
  if (key.length !== 32) {
    throw new Error(
      "PLAID_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes. Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

export function plaidEncryptionKeyConfigured(): boolean {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Plaid access tokens are bearer credentials. Encrypt them at rest so a copied
 * SQLite file alone does not expose working bank connections.
 */
export function encryptPlaidSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptPlaidSecret(value: string): string {
  const [version, ivPart, tagPart, ciphertextPart] = value.split(".");
  if (
    version !== VERSION ||
    !ivPart ||
    !tagPart ||
    !ciphertextPart
  ) {
    throw new Error("Stored Plaid token has an unsupported format.");
  }
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== 16) {
    throw new Error("Stored Plaid token is corrupted.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "Could not decrypt the Plaid token. Check PLAID_TOKEN_ENCRYPTION_KEY.",
    );
  }
}
