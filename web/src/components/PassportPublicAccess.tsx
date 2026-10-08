import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { publicPassportUrl } from "../passportRoute";

export function PassportPublicAccess({ passportStatus, publicToken, compact = false }: { passportStatus: string; publicToken?: string | null; compact?: boolean }) {
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const available = passportStatus === "published" && Boolean(publicToken);
  const url = available ? publicPassportUrl(String(publicToken)) : "";
  useEffect(() => { let active = true; setQr(""); if (!url) return () => { active = false; }; void QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 176 }).then(value => { if (active) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`); }); return () => { active = false; }; }, [url]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setMessage("คัดลอกลิงก์แล้ว"); } catch { setMessage("ไม่สามารถคัดลอกลิงก์ได้"); } };
  if (compact && !available) return <section className="passport-public-access passport-public-access--compact passport-public-access--unavailable"><div className="passport-qr-placeholder" aria-hidden="true">QR</div><p>เผยแพร่ก่อนจึงจะเปิดลิงก์ได้</p></section>;
  if (compact) return <section className="passport-public-access passport-public-access--compact">{qr && <figure><img src={qr} alt="QR สำหรับ Public Passport"/><figcaption className="sr-only">สแกนเพื่อเปิดพาสปอร์ต</figcaption></figure>}<div className="passport-public-access-actions"><a href={url} target="_blank" rel="noreferrer">เปิด Public Passport</a><button type="button" onClick={() => void copy()}>คัดลอกลิงก์</button>{message && <p role="status">{message}</p>}</div></section>;
  if (!available) return <section className="passport-public-access passport-public-access--unavailable"><header><span className="passport-access-icon" aria-hidden="true">◇</span><div><small>PUBLIC LINK</small><h5>QR พาสปอร์ต</h5></div></header><div className="passport-qr-placeholder" aria-hidden="true">QR</div><p>เผยแพร่พาสปอร์ตก่อน จึงจะเปิดลิงก์และ QR Code ได้</p></section>;
  return <section className="passport-public-access"><header><span className="passport-access-icon" aria-hidden="true">◇</span><div><small>PUBLIC LINK</small><h5>QR พาสปอร์ต</h5></div></header>{qr && <figure><img src={qr} alt="QR สำหรับ Public Passport"/><figcaption>สแกนเพื่อเปิดพาสปอร์ต</figcaption></figure>}<p>ลิงก์พาสปอร์ตสาธารณะ</p><div className="passport-public-access-actions"><a href={url} target="_blank" rel="noreferrer">เปิด Public Passport</a><button type="button" onClick={() => void copy()}>คัดลอกลิงก์</button>{message && <p role="status">{message}</p>}</div></section>;
}
