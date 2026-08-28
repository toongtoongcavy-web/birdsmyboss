import { useState } from "react";
import { PassportPublicAccess } from "./PassportPublicAccess";
import { invoke, thaiError } from "../functions";

type Asset = { photoId?: string; documentId?: string; caption?: string; documentType?: string; status?: string; isPublicOnPassport?: boolean; storagePath?: string; checksum?: string };
type Status = "draft" | "published" | "disabled";
const statusLabel: Record<Status, string> = { draft: "แบบร่าง", published: "เผยแพร่แล้ว", disabled: "ปิดการเผยแพร่" };

function AssetList({ type, assets, birdId, busy, call }: { type: "PHOTO" | "DOCUMENT"; assets: Asset[]; birdId: string; busy: boolean; call: (name: string, value: unknown) => void }) {
  const title = type === "PHOTO" ? "รูปภาพ" : "เอกสาร";
  return <section><h5>{title}</h5>{assets.length === 0 ? <p>ยังไม่มี{title}ที่จัดการได้</p> : assets.map(asset => { const assetId = asset.photoId ?? asset.documentId,eligible=asset.status===undefined||asset.status==="active"; return <div key={assetId}><p>{asset.caption ?? asset.documentType ?? "-"} — {asset.isPublicOnPassport ? "แสดงใน Passport" : "ไม่แสดงใน Passport"}{!eligible?` · ${asset.status}`:""}</p><button type="button" disabled={busy||!eligible} onClick={() => call("setPassportPublication", { targetType: type, assetId, birdId, isPublicOnPassport: !asset.isPublicOnPassport })}>{eligible?(asset.isPublicOnPassport ? "ไม่แสดงใน Passport" : "แสดงใน Passport"):"เผยแพร่ไม่ได้"}</button></div>; })}</section>;
}

export function PassportAdmin({ birdId, passportStatus = "draft", publicToken, photos = [], documents = [], onChanged = async () => {} }: { birdId: string; passportStatus?: string; publicToken?: string | null; photos?: Asset[]; documents?: Asset[]; onChanged?: () => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const status = (Object.hasOwn(statusLabel, passportStatus) ? passportStatus : "draft") as Status;
  const call = async (name: string, payload: unknown) => { if (busy) return; setBusy(true); try { await invoke(name, payload); await onChanged(); setMessage("บันทึกสำเร็จ"); } catch (error) { setMessage(thaiError(error)); } finally { setBusy(false); } };
  return <section className="publication-boundary"><header><small>PUBLICATION CONTROL</small><h4>จัดการ Passport</h4><p>กำหนดขอบเขตข้อมูลสาธารณะของนกตัวนี้ โดยไม่เปลี่ยนข้อมูลต้นทาง</p></header>
    <div className="publication-status-row"><small>PUBLICATION STATUS</small><strong>{status}</strong><span>{statusLabel[status]}</span></div>
    <PassportPublicAccess passportStatus={status} publicToken={publicToken}/>
    <div className="publication-actions">{(["draft", "published", "disabled"] as Status[]).filter(value => value !== status).map(value => <button type="button" disabled={busy} key={value} onClick={() => void call("setPassportStatus", { birdId, passportStatus: value })}>{value === "draft" ? "เปลี่ยนเป็นแบบร่าง" : value === "published" ? "เผยแพร่ Passport" : "ปิดการเผยแพร่"}</button>)}<button type="button" disabled={busy} onClick={() => setConfirm(true)}>หมุน Token ใหม่</button></div>
    {confirm && <section className="passport-rotation-confirm" role="dialog"><small>ROTATE PUBLIC LINK</small><p>Token เดิมและลิงก์ Passport ที่ใช้อยู่จะเปิดไม่ได้หลังยืนยัน</p><div className="publication-actions"><button type="button" onClick={() => { setConfirm(false); void call("rotatePassportToken", { birdId }); }}>ยืนยันหมุน Token</button><button type="button" onClick={() => setConfirm(false)}>ยกเลิก</button></div></section>}
    <div className="publication-assets"><AssetList type="PHOTO" assets={photos} birdId={birdId} busy={busy} call={call}/><AssetList type="DOCUMENT" assets={documents} birdId={birdId} busy={busy} call={call}/></div>
    {message && <p role="alert">{message}</p>}
  </section>;
}
