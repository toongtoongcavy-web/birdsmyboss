// Missing legacy timestamps sort last; IDs make equal/missing timestamps stable.
export const compareFinancialRecords = (dateField: string) => (
  a: { id: string; data: () => Record<string, any> },
  b: { id: string; data: () => Record<string, any> },
) => {
  const left = a.data(), right = b.data();
  const dateOrder = String(left[dateField] ?? "").localeCompare(String(right[dateField] ?? ""));
  if (dateOrder) return dateOrder;
  const parts = (value: any): [number, number] => {
    if (Number.isFinite(value?.seconds) && Number.isFinite(value?.nanoseconds)) return [value.seconds, value.nanoseconds];
    const millis = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(millis) ? [Math.floor(millis / 1000), (millis % 1000) * 1e6] : [Infinity, 0];
  };
  const x = parts(left.createdAt), y = parts(right.createdAt);
  return (x[0] === y[0] ? x[1] - y[1] : x[0] - y[0]) || a.id.localeCompare(b.id);
};
