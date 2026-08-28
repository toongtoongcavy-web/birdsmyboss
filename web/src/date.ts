export const parseDisplayDate = (value: string): string | null => {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const month = Number(digits.slice(0, 2)), day = Number(digits.slice(2, 4)), year = Number(digits.slice(4));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${String(month).padStart(2,"0")}/${String(day).padStart(2,"0")}/${year}` : null;
};
export const isoToDisplay = (iso?: string | null) => iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(5,7)}/${iso.slice(8,10)}/${iso.slice(0,4)}` : "";
export const displayToIso = (display: string) => { const parsed = parseDisplayDate(display); return parsed ? `${parsed.slice(6)}-${parsed.slice(0,2)}-${parsed.slice(3,5)}` : null; };

export const parseThaiDisplayDate = (value: string): string | null => {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2)), month = Number(digits.slice(2, 4)), year = Number(digits.slice(4));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${String(day).padStart(2,"0")}/${String(month).padStart(2,"0")}/${year}` : null;
};
export const thaiDisplayToIso = (display: string) => { const parsed = parseThaiDisplayDate(display); return parsed ? `${parsed.slice(6)}-${parsed.slice(3,5)}-${parsed.slice(0,2)}` : null; };
export const isoToThaiDisplay = (iso?: string | null) => iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}` : "";
