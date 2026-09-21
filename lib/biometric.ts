import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const secret = process.env.BIOMETRIC_ENCRYPTION_KEY || process.env.AUTH_SECRET || "";
  if (!secret) throw new Error("BIOMETRIC_ENCRYPTION_KEY or AUTH_SECRET is required");
  return createHash("sha256").update(secret).digest();
}

export function encryptEmbedding(embedding: number[]) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(embedding), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptEmbedding(payload: Buffer | Uint8Array) {
  const buffer = Buffer.from(payload);
  if (buffer.length < 29) throw new Error("Invalid biometric payload");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(plaintext) as unknown;
  if (!Array.isArray(parsed) || parsed.length < 64 || parsed.length > 2048) {
    throw new Error("Invalid biometric embedding");
  }
  const values = parsed.map(value => Number(value));
  if (values.some(value => !Number.isFinite(value))) throw new Error("Invalid biometric embedding");
  return values;
}

export function validateEmbedding(value: unknown) {
  if (!Array.isArray(value) || value.length < 64 || value.length > 2048) return null;
  const embedding = value.map(item => Number(item));
  if (embedding.some(item => !Number.isFinite(item) || Math.abs(item) > 100)) return null;
  return embedding;
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (!normA || !normB) return 0;
  const raw = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(-1, Math.min(1, raw));
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const earthRadiusM = 6371000;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function finiteCoordinate(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}
