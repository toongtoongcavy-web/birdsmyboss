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
  const message = String((e as { message?: string })?.message ?? "");
  if (message.includes("ringId")) return "รหัสห่วงขานี้มีอยู่ในระบบแล้ว";
  if (message.includes("active reservation")) return "นกตัวนี้มีการจองที่ยังใช้งานอยู่";
  if (message.includes("active pair")) return "นกตัวนี้อยู่ในคู่ผสมพันธุ์ที่กำลังใช้งานอยู่";
  if (message.includes("Breeding cage already contains another bird")) return "กรงเพาะพันธุ์นี้มีนกตัวอื่นอยู่แล้ว";
  if (message.includes("Destination cage must be active")) return "กรงปลายทางไม่อยู่ในสถานะพร้อมใช้งาน";
  if (message.includes("capacity")) return "กรงนี้มีนกเต็มตามความจุแล้ว";
  if (message.includes("overlap")) return "มีการใช้งานซ้อนทับในช่วงเวลาดังกล่าว";
  return "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบอีกครั้ง";
};
