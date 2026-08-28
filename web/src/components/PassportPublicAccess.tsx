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
  if (!available) return <section className="passport-public-access"><div><h5>Public Passport</h5><p>ต้องเผยแพร่ Passport ก่อนจึงจะเปิดลิงก์สาธารณะได้</p></div></section>;
  return <section className="passport-public-access"><div><h5>Public Passport</h5><p>ลิงก์และ QR นี้เปิดบันทึกสาธารณะที่เผยแพร่แล้ว</p><div className="passport-public-access-actions"><a href={url} target="_blank" rel="noreferrer">เปิด Public Passport</a><button type="button" onClick={() => void copy()}>คัดลอกลิงก์</button></div>{message && <p role="status">{message}</p>}</div>{qr && <img src={qr} alt="QR สำหรับ Public Passport"/>}</section>;
}
