import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptPlaidSecret,
  encryptPlaidSecret,
  plaidEncryptionKeyConfigured,
} from "@/lib/plaid/crypto";

const originalKey = process.env.PLAID_TOKEN_ENCRYPTION_KEY;

describe("Plaid access-token encryption", () => {
  beforeEach(() => {
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.PLAID_TOKEN_ENCRYPTION_KEY = originalKey;
    }
  });

  it("round-trips an access token", () => {
    const token = "access-production-123456789";
    const encrypted = encryptPlaidSecret(token);
    expect(encrypted).not.toContain(token);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(decryptPlaidSecret(encrypted)).toBe(token);
  });

  it("uses a random IV for every encryption", () => {
    const first = encryptPlaidSecret("same-token");
    const second = encryptPlaidSecret("same-token");
    expect(first).not.toBe(second);
    expect(decryptPlaidSecret(first)).toBe("same-token");
    expect(decryptPlaidSecret(second)).toBe("same-token");
  });

  it("rejects tampered ciphertext and a different key", () => {
    const encrypted = encryptPlaidSecret("sensitive-token");
    const parts = encrypted.split(".");
    const tampered = [...parts];
    tampered[3] = `${tampered[3].slice(0, -4)}AAAA`;
    expect(() => decryptPlaidSecret(tampered.join("."))).toThrow(/decrypt/i);

    process.env.PLAID_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
    expect(() => decryptPlaidSecret(encrypted)).toThrow(/decrypt/i);
  });

  it("reports whether the key is usable", () => {
    expect(plaidEncryptionKeyConfigured()).toBe(true);
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = "too-short";
    expect(plaidEncryptionKeyConfigured()).toBe(false);
    delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
    expect(plaidEncryptionKeyConfigured()).toBe(false);
  });
});
