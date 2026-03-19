import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

const ENCRYPTION_VERSION = "v1";

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(`${normalized}${"=".repeat(padding)}`, "base64");
}

function getSecretMaterial() {
  const value =
    process.env.CHANNEL_CREDENTIALS_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!value) {
    throw new Error("Missing channel credentials secret");
  }

  return value;
}

function deriveEncryptionKey() {
  return createHash("sha256").update(getSecretMaterial()).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "enc",
    ENCRYPTION_VERSION,
    toBase64Url(iv),
    toBase64Url(encrypted),
    toBase64Url(tag),
  ].join(":");
}

export function decryptSecret(payload: string) {
  const [prefix, version, ivPart, encryptedPart, tagPart] = payload.split(":");
  if (prefix !== "enc" || version !== ENCRYPTION_VERSION || !ivPart || !encryptedPart || !tagPart) {
    throw new Error("Invalid encrypted secret");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(),
    fromBase64Url(ivPart)
  );
  decipher.setAuthTag(fromBase64Url(tagPart));

  const decrypted = Buffer.concat([
    decipher.update(fromBase64Url(encryptedPart)),
    decipher.final(),
  ]);

  return decrypted.toString("utf-8");
}

export function signState(payload: Record<string, unknown>) {
  const body = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(
    createHmac("sha256", deriveEncryptionKey()).update(body).digest()
  );
  return `${body}.${signature}`;
}

export function verifyState<T>(token: string): T | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = toBase64Url(
    createHmac("sha256", deriveEncryptionKey()).update(body).digest()
  );
  if (signature !== expected) {
    return null;
  }

  try {
    return JSON.parse(fromBase64Url(body).toString("utf-8")) as T;
  } catch {
    return null;
  }
}
