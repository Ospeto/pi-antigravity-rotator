import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { Config } from "./types.js";
import { logger } from "./logger.js";

const PREFIX = "enc:v1:";
let missingKeyWarned = false;
const tokenLog = logger.child("token-encryption");

/**
 * Returns the configured encryption key from environment variables.
 * Prefers PI_ROTATOR_ENCRYPTION_KEY, falls back to ENCRYPTION_KEY.
 */
export function getEncryptionKey(): string | undefined {
  const key =
    process.env.PI_ROTATOR_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

/**
 * Derives a 32-byte Buffer key for AES-256-GCM.
 * If passphrase is 64 hex chars, converts it directly. Otherwise SHA-256 hashes it.
 */
export function deriveKey(passphrase: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(passphrase)) {
    return Buffer.from(passphrase, "hex");
  }
  return createHash("sha256").update(passphrase, "utf8").digest();
}

/**
 * Checks whether a refresh token string is already encrypted.
 */
export function isEncryptedToken(token: string): boolean {
  return typeof token === "string" && token.startsWith(PREFIX);
}

/**
 * Encrypts a plain-text OAuth refresh token using AES-256-GCM.
 * Format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptRefreshToken(
  plainToken: string,
  keyInput: string,
): string {
  if (!plainToken || isEncryptedToken(plainToken)) {
    return plainToken;
  }
  const key = deriveKey(keyInput);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plainToken, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${PREFIX}${iv.toString("hex")}:${tag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted refresh token.
 */
export function decryptRefreshToken(
  encryptedToken: string,
  keyInput: string,
): string {
  if (!encryptedToken || !isEncryptedToken(encryptedToken)) {
    return encryptedToken;
  }
  const payload = encryptedToken.slice(PREFIX.length);
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted refresh token format");
  }
  const [ivHex, tagHex, ciphertextHex] = parts;
  const key = deriveKey(keyInput);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Transforms a Config object by encrypting all plain account refresh tokens
 * if an encryption key is present.
 */
export function encryptAccountsInConfig(config: Config, keyInput?: string): Config {
  const key = keyInput || getEncryptionKey();
  if (!key || !config.accounts || !Array.isArray(config.accounts)) {
    return config;
  }
  const encryptedAccounts = config.accounts.map((acc) => {
    if (!acc.refreshToken || isEncryptedToken(acc.refreshToken)) {
      return acc;
    }
    return {
      ...acc,
      refreshToken: encryptRefreshToken(acc.refreshToken, key),
    };
  });
  return {
    ...config,
    accounts: encryptedAccounts,
  };
}

/**
 * Transforms a Config object by decrypting all encrypted account refresh tokens.
 * Returns the decrypted config and whether any plain-text tokens were found that
 * should trigger transparent auto-migration (encryption on next save).
 */
export function decryptAccountsInConfig(
  config: Config,
  keyInput?: string,
): { config: Config; migrated: boolean } {
  const key = keyInput || getEncryptionKey();
  if (!config.accounts || !Array.isArray(config.accounts)) {
    return { config, migrated: false };
  }

  let migrated = false;

  const decryptedAccounts = config.accounts.map((acc) => {
    if (!acc.refreshToken) return acc;

    if (isEncryptedToken(acc.refreshToken)) {
      if (!key) {
        if (!missingKeyWarned) {
          tokenLog.warn(
            `Found encrypted refresh token for ${acc.email} but PI_ROTATOR_ENCRYPTION_KEY is not set.`,
          );
          missingKeyWarned = true;
        }
        return acc;
      }
      try {
        const decrypted = decryptRefreshToken(acc.refreshToken, key);
        return { ...acc, refreshToken: decrypted };
      } catch (err) {
        tokenLog.error(
          `Failed to decrypt refresh token for ${acc.email}: ${err}`,
        );
        return acc;
      }
    } else {
      if (key) {
        migrated = true;
      }
      return acc;
    }
  });

  return {
    config: {
      ...config,
      accounts: decryptedAccounts,
    },
    migrated,
  };
}
