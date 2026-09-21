import { useLayoutEffect, useRef, useState } from "react";
import { displayToIso, isoToThaiDisplay, parseDisplayDate, parseThaiDisplayDate, thaiDisplayToIso } from "./date";

type DateInputProps = { value?: string; onChange: (iso: string | undefined) => void; label: string; ariaLabel?: string; required?: boolean };

export function DateInput({ value, onChange, label, ariaLabel = label, required = false }: DateInputProps) {
  const [text, setText] = useState(isoToThaiDisplay(value));
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => setText(isoToThaiDisplay(value)), [value]);
  const normalize = (raw: string) => {
    const thai = parseThaiDisplayDate(raw);
    if (thai) return { display: thai, iso: thaiDisplayToIso(thai)! };
    const legacy = parseDisplayDate(raw);
    const iso = legacy ? displayToIso(legacy) : null;
    return iso ? { display: isoToThaiDisplay(iso), iso } : null;
  };
  const commit = (raw: string) => {
    if (!raw) { setError(""); onChange(undefined); return; }
    const normalized = normalize(raw);
    if (!normalized) { setError("กรุณากรอกวันที่ที่มีอยู่จริง"); return; }
    setError(""); setText(normalized.display); onChange(normalized.iso);
  };
  return <label className="field"><span>{label}{required && " *"}</span><div className="date-control">
    <input value={text} placeholder="DD/MM/YYYY" inputMode="numeric" aria-label={ariaLabel} aria-invalid={Boolean(error)}
      onChange={(event) => { const digits = event.target.value.replace(/\D/g, "").slice(0, 8); if (digits.length !== 8) { setText(digits); setError(""); return; } const normalized = normalize(digits); setText(normalized?.display ?? digits); if (normalized) { setError(""); onChange(normalized.iso); } else setError("กรุณากรอกวันที่ที่มีอยู่จริง"); }}
      onBlur={(event) => commit(event.target.value)} />
    <button type="button" aria-label={`Open calendar for ${label}`} onClick={() => picker.current?.showPicker()}>▣</button>
    <input ref={picker} className="native-date" type="date" tabIndex={-1} onChange={(event) => { const iso = event.target.value || undefined; setError(""); onChange(iso); setText(isoToThaiDisplay(iso)); }} />
  </div>{error && <small className="field-error" role="alert">{error}</small>}</label>;
}
