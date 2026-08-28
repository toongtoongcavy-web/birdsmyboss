import { useEffect, useRef, useState } from "react";
import { displayToIso, isoToDisplay, parseDisplayDate } from "./date";

type DateInputProps = { value?: string; onChange: (iso: string | undefined) => void; label: string; required?: boolean };

export function DateInput({ value, onChange, label, required = false }: DateInputProps) {
  const [text, setText] = useState(isoToDisplay(value));
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => setText(isoToDisplay(value)), [value]);
  const commit = (raw: string) => {
    if (!raw) { setError(""); onChange(undefined); return; }
    const formatted = parseDisplayDate(raw);
    if (!formatted) { setError("กรุณากรอกวันที่ที่มีอยู่จริง"); return; }
    setError(""); setText(formatted); onChange(displayToIso(formatted)!);
  };
  return <label className="field"><span>{label}{required && " *"}</span><div className="date-control">
    <input value={text} placeholder="MM/DD/YYYY" inputMode="numeric" aria-label={label} aria-invalid={Boolean(error)}
      onChange={(event) => { const digits = event.target.value.replace(/\D/g, "").slice(0, 8); if (digits.length !== 8) { setText(digits); setError(""); return; } const formatted = parseDisplayDate(digits); setText(formatted ?? digits); if (formatted) { setError(""); onChange(displayToIso(formatted)!); } else setError("กรุณากรอกวันที่ที่มีอยู่จริง"); }}
      onBlur={(event) => commit(event.target.value)} />
    <button type="button" aria-label={`Open calendar for ${label}`} onClick={() => picker.current?.showPicker()}>▣</button>
    <input ref={picker} className="native-date" type="date" tabIndex={-1} onChange={(event) => { const iso = event.target.value || undefined; setError(""); onChange(iso); setText(isoToDisplay(iso)); }} />
  </div>{error && <small className="field-error" role="alert">{error}</small>}</label>;
}
