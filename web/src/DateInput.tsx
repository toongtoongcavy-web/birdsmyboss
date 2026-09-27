import { useLayoutEffect, useRef, useState } from "react";
import { isoToThaiDisplay, parseThaiDisplayDate, thaiDisplayToIso } from "./date";

type DateInputProps = { value?: string; onChange: (iso: string | undefined) => void; label: string; ariaLabel?: string; required?: boolean };

export function DateInput({ value, onChange, label, ariaLabel = label, required = false }: DateInputProps) {
  const [text, setText] = useState(isoToThaiDisplay(value));
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  useLayoutEffect(() => { if (!focused.current) setText(isoToThaiDisplay(value)); }, [value]);
  const normalize = (raw: string) => {
    const trimmed = raw.trim();
    const slashDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const candidate = slashDate
      ? `${slashDate[1].padStart(2,"0")}/${slashDate[2].padStart(2,"0")}/${slashDate[3]}`
      : /^\d{8}$/.test(trimmed) ? trimmed : undefined;
    if (!candidate) return null;
    const thai = parseThaiDisplayDate(candidate);
    if (thai) return { display: thai, iso: thaiDisplayToIso(thai)! };
    return null;
  };
  const validity = (message: string) => input.current?.setCustomValidity(message);
  const typedDisplay = (raw: string) => {
    if (!/^\d{0,8}$/.test(raw)) return raw.slice(0, 10);
    return raw.length <= 2 ? raw : raw.length <= 4 ? `${raw.slice(0,2)}/${raw.slice(2)}` : `${raw.slice(0,2)}/${raw.slice(2,4)}/${raw.slice(4)}`;
  };
  const commit = (raw: string) => {
    if (!raw) { setError(""); validity(""); onChange(undefined); return; }
    const normalized = normalize(raw);
    if (!normalized) { const message="กรุณากรอกวันที่ที่มีอยู่จริง";setError(message);validity(message);onChange(undefined);return; }
    setError("");validity("");setText(normalized.display);onChange(normalized.iso);
  };
  return <label className="field"><span>{label}{required && " *"}</span><div className="date-control">
    <input ref={input} required={required} value={text} placeholder="DD/MM/YYYY" inputMode="numeric" aria-label={ariaLabel} aria-invalid={Boolean(error)}
      onFocus={()=>{focused.current=true;}}
      onChange={(event) => { const display=typedDisplay(event.target.value),normalized=normalize(display),complete=display.replace(/\D/g,"").length===8,message=display?"กรุณากรอกวันที่ที่มีอยู่จริง":"";setText(normalized?.display??display);setError(!normalized&&complete?message:"");if(normalized){validity("");onChange(normalized.iso);}else{validity(message);onChange(undefined);}}}
      onBlur={(event) => {focused.current=false;commit(event.target.value);}} />
    <button type="button" aria-label={`Open calendar for ${label}`} onClick={() => {const element=picker.current;if(!element)return;if(typeof element.showPicker==="function")element.showPicker();else element.click();}}>▣</button>
    <input ref={picker} className="native-date" type="date" tabIndex={-1} onChange={(event) => { const iso = event.target.value || undefined; setError("");validity("");onChange(iso);setText(isoToThaiDisplay(iso)); }} />
  </div>{error && <small className="field-error" role="alert">{error}</small>}</label>;
}
