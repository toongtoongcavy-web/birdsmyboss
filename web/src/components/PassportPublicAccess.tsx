import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { publicPassportUrl } from "../passportRoute";

export function PassportPublicAccess({ passportStatus, publicToken }: { passportStatus: string; publicToken?: string | null }) {
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const available = passportStatus === "published" && Boolean(publicToken);
  const url = available ? publicPassportUrl(String(publicToken)) : "";
  useEffect(() => { let active = true; setQr(""); if (!url) return () => { active = false; }; void QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 176 }).then(value => { if (active) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`); }); return () => { active = false; }; }, [url]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setMessage("คัดลอกลิงก์แล้ว"); } catch { setMessage("ไม่สามารถคัดลอกลิงก์ได้"); } };
  if (!available) return <section className="passport-public-access passport-public-access--unavailable"><span className="passport-access-icon" aria-hidden="true">◇</span><div><h5>ลิงก์พาสปอร์ตสาธารณะ</h5><p>เผยแพร่พาสปอร์ตก่อน จึงจะเปิดลิงก์และ QR Code ได้</p></div></section>;
  return <section className="passport-public-access"><div className="passport-public-access-copy"><span className="passport-access-icon" aria-hidden="true">◇</span><div><h5>ลิงก์พาสปอร์ตสาธารณะ</h5><p>พร้อมเปิดดูและแบ่งปันพาสปอร์ตที่เผยแพร่แล้ว</p></div></div><div className="passport-public-access-actions"><a href={url} target="_blank" rel="noreferrer">เปิด Public Passport</a><button type="button" onClick={() => void copy()}>คัดลอกลิงก์</button>{message && <p role="status">{message}</p>}</div>{qr && <figure><img src={qr} alt="QR สำหรับ Public Passport"/><figcaption>QR Code</figcaption></figure>}</section>;
}
