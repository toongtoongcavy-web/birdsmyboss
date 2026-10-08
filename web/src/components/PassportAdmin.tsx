import { useState } from "react";
import { PassportPublicAccess } from "./PassportPublicAccess";
import { invoke, thaiError } from "../functions";

type Asset = { photoId?: string; documentId?: string; caption?: string; documentType?: string; status?: string; isPublicOnPassport?: boolean; storagePath?: string; checksum?: string };
type Status = "draft" | "published" | "disabled";
const statusLabel: Record<Status, string> = { draft: "ยังไม่เผยแพร่", published: "เผยแพร่แล้ว", disabled: "ปิดการเผยแพร่" };

function AssetList({ type, assets, birdId, busy, call }: { type: "PHOTO" | "DOCUMENT"; assets: Asset[]; birdId: string; busy: boolean; call: (name: string, value: unknown) => void }) {
  const title = type === "PHOTO" ? "รูปภาพ" : "เอกสาร";
  return <section><header><span aria-hidden="true">{type === "PHOTO" ? "▧" : "▤"}</span><h5>{title}</h5></header>{assets.length === 0 ? <p className="publication-assets-empty">ยังไม่มี{title}ที่จัดการได้</p> : assets.map(asset => { const assetId = asset.photoId ?? asset.documentId,eligible=asset.status===undefined||asset.status==="active"; return <div key={assetId}><p><strong>{asset.caption ?? asset.documentType ?? "-"}</strong><small>{asset.isPublicOnPassport ? "แสดงในพาสปอร์ต" : "ไม่แสดงในพาสปอร์ต"}{!eligible?` · ${asset.status}`:""}</small></p><button type="button" disabled={busy||!eligible} onClick={() => call("setPassportPublication", { targetType: type, assetId, birdId, isPublicOnPassport: !asset.isPublicOnPassport })}>{eligible?(asset.isPublicOnPassport ? "ไม่แสดงใน Passport" : "แสดงใน Passport"):"เผยแพร่ไม่ได้"}</button></div>; })}</section>;
}

export function PassportAdmin({ birdId, passportStatus = "draft", publicToken, photos = [], documents = [], onChanged = async () => {}, compact = false }: { birdId: string; passportStatus?: string; publicToken?: string | null; photos?: Asset[]; documents?: Asset[]; onChanged?: () => Promise<void>; compact?: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const status = (Object.hasOwn(statusLabel, passportStatus) ? passportStatus : "draft") as Status;
  const call = async (name: string, payload: unknown) => { if (busy) return; setBusy(true); try { await invoke(name, payload); await onChanged(); setMessage("บันทึกสำเร็จ"); } catch (error) { setMessage(thaiError(error)); } finally { setBusy(false); } };
  const management=<section className="publication-management-card"><header><span className="passport-access-icon" aria-hidden="true">●</span><div><small>สถานะพาสปอร์ต</small><h5>สถานะพาสปอร์ต</h5></div></header><div className={`publication-status-row publication-status-row--${status}`}><span aria-hidden="true">●</span><strong>{statusLabel[status]}</strong></div><p>{status === "published" ? "พาสปอร์ตพร้อมเปิดดูและแบ่งปันผ่านลิงก์สาธารณะ" : "ข้อมูลยังไม่แสดงในพาสปอร์ตสาธารณะ"}</p>
      <div className="publication-primary-actions">{status !== "published" && <button className="passport-publish-action" type="button" disabled={busy} onClick={() => void call("setPassportStatus", { birdId, passportStatus: "published" })}>เผยแพร่พาสปอร์ต</button>}{status !== "draft" && <button type="button" disabled={busy} onClick={() => void call("setPassportStatus", { birdId, passportStatus: "draft" })}>เปลี่ยนเป็นแบบร่าง</button>}</div>
      <section className="passport-sensitive-actions"><small>การตั้งค่าที่ต้องระวัง</small><div>{status !== "disabled" && <button type="button" disabled={busy} onClick={() => void call("setPassportStatus", { birdId, passportStatus: "disabled" })}>ปิดการเผยแพร่</button>}<button type="button" disabled={busy} onClick={() => setConfirm(true)}>หมุน Token ใหม่</button></div></section>
    </section>;
  const rotation=confirm&&<section className="passport-rotation-confirm" role="dialog"><small>ROTATE PUBLIC LINK</small><p>Token เดิมและลิงก์ Passport ที่ใช้อยู่จะเปิดไม่ได้หลังยืนยัน</p><div className="publication-actions"><button type="button" onClick={() => { setConfirm(false); void call("rotatePassportToken", { birdId }); }}>ยืนยันหมุน Token</button><button type="button" onClick={() => setConfirm(false)}>ยกเลิก</button></div></section>;
  const assets=<div className="publication-assets"><AssetList type="PHOTO" assets={photos} birdId={birdId} busy={busy} call={call}/><AssetList type="DOCUMENT" assets={documents} birdId={birdId} busy={busy} call={call}/></div>;
  if(compact)return <section className="publication-boundary passport-admin-compact"><div className="passport-compact-primary"><div className="passport-compact-identity"><small>BIRD PASSPORT</small><strong>Bird Passport</strong><span className={`publication-status-row publication-status-row--${status}`}><span aria-hidden="true">●</span><strong>{statusLabel[status]}</strong></span></div><PassportPublicAccess passportStatus={status} publicToken={publicToken} compact/></div><details className="passport-compact-details"><summary><span>รูปภาพ <strong>{photos.length}</strong></span><span>เอกสาร <strong>{documents.length}</strong></span><b>จัดการพาสปอร์ต</b></summary><div className="passport-compact-expanded">{management}{rotation}{assets}</div></details>{message&&<p role="alert">{message}</p>}</section>;
  return <section className="publication-boundary"><header><div><small>PASSPORT MANAGEMENT</small><h4>จัดการพาสปอร์ต</h4></div><p>เลือกข้อมูลที่จะเผยแพร่และจัดการลิงก์พาสปอร์ตสาธารณะ</p></header>
    <div className="publication-workspace">{management}<PassportPublicAccess passportStatus={status} publicToken={publicToken}/></div>
    {rotation}
    {assets}
    {message && <p role="alert">{message}</p>}
  </section>;
}
