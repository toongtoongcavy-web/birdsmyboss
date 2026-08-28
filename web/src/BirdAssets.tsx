import { FormEvent, useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { invoke, thaiError } from "./functions";
import { storage } from "./firebase";
import { DateInput } from "./DateInput";

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
    try {
      const id = intakeId();
      const intake = await invoke("beginBirdAssetIntake", { birdId, assetType, intakeId: id, contentType: file.type, size: file.size, ...(photo ? { caption: caption.trim() } : { documentType: documentType.trim(), issuedOn }) }) as { storagePath: string };
      await uploadBytes(ref(storage, intake.storagePath), file, { contentType: file.type });
      const finalized = await invoke("finalizeBirdAssetIntake", { intakeId: id }) as { photoId?: string; documentId?: string };
      if (replaceId && finalized.documentId) await invoke("supersedeBirdDocument", { birdId, oldDocumentId: replaceId, replacementDocumentId: finalized.documentId });
      setMessage("บันทึกไฟล์สำเร็จ"); setFile(null); setCaption(""); setDocumentType(""); setIssuedOn(""); setReplaceId(""); await onSaved();
    } catch (error) { setMessage(thaiError(error)); } finally { setBusy(false); }
  };
  return <form className="card" onSubmit={submit}><h5>{photo ? "เพิ่มรูปภาพ" : "เพิ่มเอกสาร"}</h5><label className="field">ไฟล์ *<input required type="file" accept={photo ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png"} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>{photo ? <label className="field">คำบรรยาย<input value={caption} onChange={event => setCaption(event.target.value)} /></label> : <><label className="field">ประเภทเอกสาร *<input required value={documentType} onChange={event => setDocumentType(event.target.value)} /></label><DateInput label="วันที่ออกเอกสาร" required value={issuedOn} onChange={value=>setIssuedOn(value??"")}/>{documents.filter(document => document.status === "active").length > 0 && <label className="field">แทนที่เอกสารเดิม<select value={replaceId} onChange={event => setReplaceId(event.target.value)}><option value="">ไม่แทนที่</option>{documents.filter(document => document.status === "active").map(document => <option key={document.documentId} value={document.documentId}>{document.documentType ?? "เอกสาร"}</option>)}</select></label>}</>}<button disabled={busy}>{busy ? "กำลังอัปโหลด…" : photo ? "เพิ่มรูปภาพ" : "เพิ่มเอกสาร"}</button>{message && <p role="status">{message}</p>}</form>;
}

function AssetHistory({ birdId, photos, documents, onSaved }: { birdId: string; photos: Asset[]; documents: Asset[]; onSaved: Refresh }) {
  const [message, setMessage] = useState("");
  const archive = async (operation: string, payload: Record<string, unknown>) => { try { await invoke(operation, payload); setMessage("บันทึกสถานะสำเร็จ"); await onSaved(); } catch (error) { setMessage(thaiError(error)); } };
  return <section className="card"><h5>ประวัติไฟล์</h5>{photos.map(photo => <p key={photo.photoId}>{photo.caption || "รูปภาพ"} · {photo.status}{photo.status === "active" && <button type="button" onClick={() => void archive("archiveBirdPhoto", { birdId, photoId: photo.photoId })}>เก็บถาวร</button>}</p>)}{documents.map(document => <p key={document.documentId}>{document.documentType || "เอกสาร"} · {document.status}{document.status === "active" && <button type="button" onClick={() => void archive("archiveBirdDocument", { birdId, documentId: document.documentId })}>เก็บถาวร</button>}</p>)}{message && <p role="status">{message}</p>}</section>;
}

export function BirdAssets({ birdId, photos, documents, onSaved }: { birdId: string; photos: Asset[]; documents: Asset[]; onSaved: Refresh }) {
  return <section className="form-grid"><AssetIntake birdId={birdId} assetType="PHOTO" documents={documents} onSaved={onSaved}/><AssetIntake birdId={birdId} assetType="DOCUMENT" documents={documents} onSaved={onSaved}/><AssetHistory birdId={birdId} photos={photos} documents={documents} onSaved={onSaved}/></section>;
}
