import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

const HANDLE_VERSION = "v1";
const TTL_MS = 5 * 60 * 1000;

type HandlePayload = { birdId: string; photoId: string; passportFingerprint: string; expiresAt: number };
export type EligiblePublicPhoto = { storagePath: string };
export const isSupportedPublicPhotoContentType = (value: unknown): value is "image/jpeg" | "image/png" | "image/webp" => typeof value === "string" && /^(image\/jpeg|image\/png|image\/webp)$/.test(value);

const fingerprint = (token: string) => createHash("sha256").update(token).digest("base64url");

const keyBytes = (key: string) => {
  const bytes = Buffer.from(key, "base64url");
  if (bytes.length !== 32) throw new Error("BMB_PUBLIC_MEDIA_KEY must be 32 bytes encoded as base64url.");
  return bytes;
};

const encode = (value: Buffer) => value.toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url");

export const createOpaquePhotoHandle = (key: string, birdId: string, photoId: string, publicToken: string, now = Date.now()) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  const payload: HandlePayload = { birdId, photoId, passportFingerprint: fingerprint(publicToken), expiresAt: now + TTL_MS };
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return `${HANDLE_VERSION}.${encode(iv)}.${encode(ciphertext)}.${encode(cipher.getAuthTag())}`;
};

const readHandle = (key: string, handle: string, now = Date.now()): HandlePayload | null => {
  try {
    const [version, ivText, encryptedText, tagText, ...extra] = handle.split(".");
    if (version !== HANDLE_VERSION || extra.length || !ivText || !encryptedText || !tagText) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), decode(ivText));
    decipher.setAuthTag(decode(tagText));
    const parsed = JSON.parse(Buffer.concat([decipher.update(decode(encryptedText)), decipher.final()]).toString("utf8")) as HandlePayload;
    if (!parsed || typeof parsed.birdId !== "string" || typeof parsed.photoId !== "string" || typeof parsed.passportFingerprint !== "string" || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= now) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const opaquePhotoUrl = (handle: string) => `/public-media/v1/${handle}`;

export const resolveEligiblePublicPhoto = async (db: Firestore, key: string, handle: string, now = Date.now()): Promise<EligiblePublicPhoto | null> => {
  const payload = readHandle(key, handle, now);
  if (!payload) return null;
  const [bird, photo] = await Promise.all([db.collection("birds").doc(payload.birdId).get(), db.collection("photos").doc(payload.photoId).get()]);
  if (!bird.exists || !photo.exists) return null;
  const birdData = bird.data()!, photoData = photo.data()!;
  if (birdData.passportStatus !== "published" || typeof birdData.publicToken !== "string" || fingerprint(birdData.publicToken) !== payload.passportFingerprint) return null;
  if (photoData.ownerType !== "BIRD" || photoData.ownerId !== bird.id || photoData.status !== "active" || photoData.managedStorage !== true || photoData.isPublicOnPassport !== true || typeof photoData.storagePath !== "string") return null;
  return { storagePath: photoData.storagePath };
};

export const publicPhotoHandleTtlMs = TTL_MS;
