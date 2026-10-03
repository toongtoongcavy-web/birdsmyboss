import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { app, ensureLocalAuth, useFirebaseEmulators } from "./firebase";

const functions = getFunctions(app, "asia-southeast1");
if (useFirebaseEmulators) connectFunctionsEmulator(functions, "127.0.0.1", 5001);

const mvpOperation = (name: string, data: unknown): { name: string; data: unknown } => {
  if (name === "movePairToCage" || name === "assignPairToCage") {
    const payload = (data ?? {}) as Record<string, unknown>;
    return {
      name: "moveActivePairToCageMvp",
      data: {
        pairId: payload.pairId,
        cageId: payload.cageId,
        movedOn: payload.startsOn,
      },
    };
  }
  return { name, data };
};

export const invoke = async (name: string, data: unknown) => {
  await ensureLocalAuth();
  const operation = mvpOperation(name, data);
  return httpsCallable(functions, operation.name)(operation.data).then((result) => result.data);
};

export const thaiError = (e: unknown) => {
  const error = (e ?? {}) as { code?: unknown; message?: unknown };
  const message = String(error.message ?? "").replace(/\s+/g, " ").trim();
  const code = String(error.code ?? "").replace(/^functions\//, "").replace(/[^a-z0-9_-]/gi, "").slice(0, 64);
  if (message.includes("ringId")) return "รหัสห่วงขานี้มีอยู่ในระบบแล้ว";
  if (message.includes("active reservation")) return "นกตัวนี้มีการจองที่ยังใช้งานอยู่";
  if (message.includes("active pair")) return "นกตัวนี้อยู่ในคู่ผสมพันธุ์ที่กำลังใช้งานอยู่";
  if (message.includes("Breeding cage already contains another bird")) return "กรงเพาะพันธุ์นี้มีนกตัวอื่นอยู่แล้ว";
  if (message.includes("Destination cage must be active")) return "กรงปลายทางไม่อยู่ในสถานะพร้อมใช้งาน";
  if (message.includes("capacity")) return "กรงนี้มีนกเต็มตามความจุแล้ว";
  if (message.includes("overlap")) return "มีการใช้งานซ้อนทับในช่วงเวลาดังกล่าว";
  if (message.includes("Reservation conversion must not supply agreement price fields")) return "ระบบสร้างการขายยังไม่รองรับราคาที่ส่งมาพร้อมการจอง กรุณาอัปเดต Functions (รหัส invalid-argument)";
  if (message.includes("Reservation agreement price cannot be overwritten")) return "ไม่สามารถเปลี่ยนราคาที่ตกลงไว้ในการจองได้";
  if (message.includes("Reservation must be active")) return "สร้างการขายได้เฉพาะจากการจองที่กำลังใช้งานอยู่";
  if (message.includes("Reservation is expired or inactive")) return "การจองหมดอายุหรือไม่อยู่ในสถานะใช้งานแล้ว";
  if (message.includes("Reservation does not match sale bird and customer")) return "ข้อมูลนกหรือลูกค้าไม่ตรงกับการจอง";
  if (message.includes("Reservation already has a non-cancelled sale")) return "การจองนี้มีรายการขายอยู่แล้ว";
  if (message.includes("record further payments on the sale")) return "สร้างการขายแล้ว กรุณารับชำระเงินต่อในรายการขาย";
  if (message.includes("Payment amount exceeds the remaining agreement balance")) return "จำนวนเงินเกินยอดคงเหลือของการขาย";
  if (message.includes("Sale must be fully paid before completion")) return "ยังมียอดคงเหลือ ต้องชำระครบก่อนปิดการขาย";
  if (message.includes("Sale-derived final Price History locks manual pricing")) return "มีราคาสุดท้ายจากการขายแล้ว ไม่สามารถเพิ่มราคาตั้งขายหรือราคาที่เสนอได้";
  if (message.includes("Delivery cannot be created after completed handover")) return "ส่งมอบนกแล้ว ไม่สามารถสร้างการจัดส่งเพิ่มได้";
  if (message.includes("Reservation payments exceed the Sale agreement price")) return "ยอดมัดจำเดิมสูงกว่าราคาขายที่ตกลง กรุณาตรวจสอบราคา";
  const detail = message.slice(0, 240);
  if (code || detail) return `ไม่สามารถบันทึกข้อมูลได้${code ? ` (รหัส ${code})` : ""}${detail ? `: ${detail}` : ""}`;
  return "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบอีกครั้ง";
};
