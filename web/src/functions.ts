import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { app, ensureLocalAuth, useFirebaseEmulators } from "./firebase";

const functions = getFunctions(app, "asia-southeast1");
if (useFirebaseEmulators) connectFunctionsEmulator(functions, "127.0.0.1", 5001);

export const invoke = async (name: string, data: unknown) => {
  await ensureLocalAuth();
  return httpsCallable(functions, name)(data).then((result) => result.data);
};

export const thaiError = (e: unknown) => {
  const message = String((e as { message?: string })?.message ?? "");
  if (message.includes("ringId")) return "Ring ID นี้มีอยู่ในระบบแล้ว";
  if (message.includes("active reservation")) return "นกตัวนี้มีการจองที่ยังใช้งานอยู่";
  if (message.includes("overlap")) return "มีการใช้งานซ้อนทับในช่วงเวลาดังกล่าว";
  return "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบอีกครั้ง";
};
