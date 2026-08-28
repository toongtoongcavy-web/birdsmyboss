import { fail } from "./errors.js";

export const normalizeRingId = (value: unknown): string => {
  if (typeof value !== "string") fail("invalid-argument", "ringId must be a string.");
  const normalized = (value as string).trim().toUpperCase();
  if (!normalized) fail("invalid-argument", "ringId is required.");
  return normalized;
};

export const requireId = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !value.trim()) fail("invalid-argument", `${name} is required.`);
  return (value as string).trim();
};

export const requireDate = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("invalid-argument", `${name} must be YYYY-MM-DD.`);
  return value as string;
};

export const assertNoCanonicalParentageInput = (data: Record<string, unknown>): void => {
  if ("fatherId" in data || "motherId" in data) fail("invalid-argument", "fatherId and motherId are derived and cannot be written.");
};

export const intervalsOverlap = (startA: string, endA: string | undefined, startB: string, endB: string | undefined): boolean =>
  startA < (endB ?? "9999-12-31") && startB < (endA ?? "9999-12-31");
