export type SexHistoryEntry = Record<string, unknown> & { sexHistoryId: string };

const timestampMillis = (value: unknown): number => {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") return (value as { toMillis: () => number }).toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value) {
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.NEGATIVE_INFINITY;
};

export const sexHistoryEntry = (doc: { id: string; data: () => Record<string, unknown> }): SexHistoryEntry => ({ sexHistoryId: doc.id, ...doc.data() });

export const compareSexHistoryDesc = (left: SexHistoryEntry, right: SexHistoryEntry): number =>
  String(right.determinedOn ?? "").localeCompare(String(left.determinedOn ?? ""))
  || timestampMillis(right.createdAt) - timestampMillis(left.createdAt)
  || timestampMillis(right.updatedAt) - timestampMillis(left.updatedAt)
  || String(right.sexHistoryId).localeCompare(String(left.sexHistoryId));

export const orderedSexHistory = (entries: SexHistoryEntry[]): SexHistoryEntry[] => [...entries].sort(compareSexHistoryDesc);

export const resolveCurrentSex = (entries: SexHistoryEntry[]): string =>
  String(orderedSexHistory(entries).find(entry => entry.sex !== "unknown")?.sex ?? "unknown");
