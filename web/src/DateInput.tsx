import { useLayoutEffect, useRef, useState } from "react";
import { isoToThaiDisplay, parseThaiDisplayDate, thaiDisplayToIso } from "./date";

type DateInputProps = { value?: string; onChange: (iso: string | undefined) => void; label: string; ariaLabel?: string; required?: boolean };

export function DateInput({ value, onChange, label, ariaLabel = label, required = false }: DateInputProps) {
  const [text, setText] = useState(isoToThaiDisplay(value));
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  const pendingSelection = useRef<number | null>(null);
  useLayoutEffect(() => { if (!focused.current) setText(isoToThaiDisplay(value)); }, [value]);
  useLayoutEffect(() => {
    const position = pendingSelection.current;
    const element = input.current;
    pendingSelection.current = null;
    if (position === null || !element || element !== document.activeElement) return;
    element.setSelectionRange(position, position);
  }, [text]);
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
    if (!/^[\d/]*$/.test(raw)) return raw.slice(0, 10);
    const digits = raw.replace(/\D/g, "");
    if (digits.length > 8) return raw.slice(0, 10);
    if (digits.length < 8 && /^\d{0,2}\/\d{0,2}(?:\/\d{0,4})?$/.test(raw)) return raw.slice(0, 10);
    return digits.length <= 2 ? digits : digits.length <= 4 ? `${digits.slice(0,2)}/${digits.slice(2)}` : `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
  };
  const caretAfterDigits = (display: string, digitCount: number) => {
    if (digitCount === 0) return 0;
    let seen = 0;
    for (let index = 0; index < display.length; index += 1) if (/\d/.test(display[index]) && ++seen === digitCount) return index + 1;
    return display.length;
  };
  const commit = (raw: string) => {
    if (!raw) { setError(""); validity(""); onChange(undefined); return; }
    const normalized = normalize(raw);
    if (!normalized) { const message="กรุณากรอกวันที่ที่มีอยู่จริง";setError(message);validity(message);onChange(undefined);return; }
    setError("");validity("");setText(normalized.display);onChange(normalized.iso);
  };
  return <label className="field"><span>{label}{required && " *"}</span><div className="date-control">
    <input ref={input} className="date-text-input" required={required} value={text} placeholder="DD/MM/YYYY" inputMode="numeric" aria-label={ariaLabel} aria-invalid={Boolean(error)}
      onFocus={()=>{focused.current=true;}}
      onClick={(event)=>event.currentTarget.focus()}
      onChange={(event) => { const raw=event.target.value,display=typedDisplay(raw),normalized=normalize(display),next=normalized?.display??display,complete=display.replace(/\D/g,"").length===8,message=display?"กรุณากรอกวันที่ที่มีอยู่จริง":"";if(next!==raw){const beforeCaret=raw.slice(0,event.target.selectionStart??raw.length).replace(/\D/g,"").length;pendingSelection.current=caretAfterDigits(next,beforeCaret);}setText(next);setError(!normalized&&complete?message:"");if(normalized){validity("");onChange(normalized.iso);}else{validity(message);onChange(undefined);}}}
      onBlur={(event) => {focused.current=false;commit(event.target.value);}} />
    <button type="button" aria-label={`Open calendar for ${label}`} onClick={() => {const element=picker.current;if(!element)return;if(typeof element.showPicker==="function")element.showPicker();else element.click();}}>▣</button>
    <input ref={picker} className="native-date" type="date" tabIndex={-1} aria-hidden="true" onChange={(event) => { const iso = event.target.value || undefined; setError("");validity("");onChange(iso);setText(isoToThaiDisplay(iso)); }} />
  </div>{error && <small className="field-error" role="alert">{error}</small>}</label>;
}
