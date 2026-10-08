import { FormEvent, useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { invoke, thaiError } from "./functions";
import { storage } from "./firebase";
import { DateInput } from "./DateInput";
import { isoToThaiDisplay } from "./date";
import "./BirdAssets.css";

type Asset = Record<string, any>;
type Refresh = () => Promise<void>;
const intakeId = () => crypto.randomUUID();

function AssetIntake({ birdId, assetType, documents, onSaved }: { birdId: string; assetType: "PHOTO" | "DOCUMENT"; documents: Asset[]; onSaved: Refresh }) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [replaceId, setReplaceId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const photo = assetType === "PHOTO";
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || (!photo && (!documentType.trim() || !issuedOn))) { setMessage("กรุณาเลือกไฟล์และกรอกข้อมูลให้ครบ"); return; }
    setBusy(true);
    let stage: "prepare" | "upload" | "finalize" | "followup" = "prepare";
    try {
      const id = intakeId();
      const intake = await invoke("beginBirdAssetIntake", { birdId, assetType, intakeId: id, contentType: file.type, size: file.size, ...(photo ? { caption: caption.trim() } : { documentType: documentType.trim(), issuedOn }) }) as { storagePath: string };
      stage = "upload";
      await uploadBytes(ref(storage, intake.storagePath), file, { contentType: file.type });
      stage = "finalize";
      const finalized = await invoke("finalizeBirdAssetIntake", { intakeId: id }) as { photoId?: string; documentId?: string };
      stage = "followup";
      if (replaceId && finalized.documentId) await invoke("supersedeBirdDocument", { birdId, oldDocumentId: replaceId, replacementDocumentId: finalized.documentId });
      setMessage("บันทึกไฟล์สำเร็จ"); setFile(null); setCaption(""); setDocumentType(""); setIssuedOn(""); setReplaceId(""); await onSaved();
    } catch (error) {
      const context = stage === "prepare" ? "เตรียมการอัปโหลดไม่สำเร็จ" : stage === "upload" ? "อัปโหลดไฟล์ไม่สำเร็จ" : stage === "finalize" ? "ยืนยันไฟล์ไม่สำเร็จ" : "บันทึกข้อมูลไฟล์ไม่สำเร็จ";
      setMessage(`${context}: ${thaiError(error)}`);
    } finally { setBusy(false); }
  };
  return <form className="card" onSubmit={submit}><h5>{photo ? "เพิ่มรูปภาพ" : "เพิ่มเอกสาร"}</h5><label className="field">ไฟล์ *<input required type="file" accept={photo ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png"} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>{photo ? <label className="field">คำบรรยาย<input value={caption} onChange={event => setCaption(event.target.value)} /></label> : <><label className="field">ประเภทเอกสาร *<input required value={documentType} onChange={event => setDocumentType(event.target.value)} /></label><DateInput label="วันที่ออกเอกสาร" required value={issuedOn} onChange={value=>setIssuedOn(value??"")}/>{documents.filter(document => document.status === "active").length > 0 && <label className="field">แทนที่เอกสารเดิม<select value={replaceId} onChange={event => setReplaceId(event.target.value)}><option value="">ไม่แทนที่</option>{documents.filter(document => document.status === "active").map(document => <option key={document.documentId} value={document.documentId}>{document.documentType ?? "เอกสาร"}</option>)}</select></label>}</>}<button disabled={busy}>{busy ? "กำลังอัปโหลด…" : photo ? "เพิ่มรูปภาพ" : "เพิ่มเอกสาร"}</button>{message && <p role="status">{message}</p>}</form>;
}

function AssetHistory({ birdId, photos, documents, onSaved }: { birdId: string; photos: Asset[]; documents: Asset[]; onSaved: Refresh }) {
  const [message, setMessage] = useState("");
  const archive = async (operation: string, payload: Record<string, unknown>) => { try { await invoke(operation, payload); setMessage("บันทึกสถานะสำเร็จ"); await onSaved(); } catch (error) { setMessage(thaiError(error)); } };
  const statusLabel:Record<string,string>={active:"ใช้งานอยู่",archived:"เก็บถาวรแล้ว",superseded:"ถูกแทนที่แล้ว"};
  const badge=(status:unknown)=>{const key=typeof status==="string"&&statusLabel[status]?status:"unknown";return <span className={`bird-asset-status bird-asset-status--${key}`}>{statusLabel[key]??"ไม่ทราบสถานะ"}</span>;};
  return <section className="card bird-asset-history"><header><small>ASSET HISTORY</small><h5>ประวัติรูปภาพและเอกสาร</h5></header><div className="bird-asset-groups"><section className="bird-asset-group" aria-labelledby="bird-photo-history"><header><span aria-hidden="true">▧</span><div><h6 id="bird-photo-history">รูปภาพ</h6><small>{photos.length} รายการ</small></div></header><div className="bird-asset-list">{photos.length?photos.map(photo=>{const name=String(photo.caption||"รูปภาพ");return <article className="bird-asset-row" aria-label={`รูปภาพ: ${name}`} key={photo.photoId}><span className="bird-asset-visual bird-asset-visual--photo">{typeof photo.readUrl==="string"&&photo.readUrl?<img src={photo.readUrl} alt={`ภาพย่อ ${name}`}/>:<span aria-hidden="true">▧</span>}</span><span className="bird-asset-copy"><strong>{name}</strong><small>รูปภาพประจำตัวนก</small></span>{badge(photo.status)}{photo.status==="active"&&<button className="bird-asset-archive" type="button" onClick={()=>void archive("archiveBirdPhoto",{birdId,photoId:photo.photoId})}>เก็บถาวร</button>}</article>}):<p className="bird-asset-empty">ยังไม่มีรูปภาพ</p>}</div></section><section className="bird-asset-group" aria-labelledby="bird-document-history"><header><span aria-hidden="true">▤</span><div><h6 id="bird-document-history">เอกสาร</h6><small>{documents.length} รายการ</small></div></header><div className="bird-asset-list">{documents.length?documents.map(document=>{const name=String(document.documentType||"เอกสาร");return <article className="bird-asset-row" aria-label={`เอกสาร: ${name}`} key={document.documentId}><span className="bird-asset-visual" aria-hidden="true">▤</span><span className="bird-asset-copy"><strong>{name}</strong><small>{document.issuedOn?`วันที่ออก ${isoToThaiDisplay(document.issuedOn)||"-"}`:"ไม่ระบุวันที่ออก"}</small></span>{badge(document.status)}{document.status==="active"&&<button className="bird-asset-archive" type="button" onClick={()=>void archive("archiveBirdDocument",{birdId,documentId:document.documentId})}>เก็บถาวร</button>}</article>}):<p className="bird-asset-empty">ยังไม่มีเอกสาร</p>}</div></section></div>{message&&<p role="status">{message}</p>}</section>;
}

export function BirdAssets({ birdId, photos, documents, onSaved }: { birdId: string; photos: Asset[]; documents: Asset[]; onSaved: Refresh }) {
  return <section className="form-grid"><AssetIntake birdId={birdId} assetType="PHOTO" documents={documents} onSaved={onSaved}/><AssetIntake birdId={birdId} assetType="DOCUMENT" documents={documents} onSaved={onSaved}/><AssetHistory birdId={birdId} photos={photos} documents={documents} onSaved={onSaved}/></section>;
}
