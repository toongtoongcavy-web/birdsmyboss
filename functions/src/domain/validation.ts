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
  if (typeof value !== "string") return fail("invalid-argument", `${name} must be a real date in YYYY-MM-DD format.`);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return fail("invalid-argument", `${name} must be a real date in YYYY-MM-DD format.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    fail("invalid-argument", `${name} must be a real date in YYYY-MM-DD format.`);
  }
  return value as string;
};

export const assertNoCanonicalParentageInput = (data: Record<string, unknown>): void => {
  if ("fatherId" in data || "motherId" in data) fail("invalid-argument", "fatherId and motherId are derived and cannot be written.");
};

export const intervalsOverlap = (startA: string, endA: string | undefined, startB: string, endB: string | undefined): boolean =>
  startA < (endB ?? "9999-12-31") && startB < (endA ?? "9999-12-31");
