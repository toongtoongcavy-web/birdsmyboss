import { useEffect, useState } from "react";
import { MvpShell } from "./MvpShell";
import { observeOperator, signInOperatorWithGoogle, signOutOperator, type OperatorIdentity } from "./auth";
import { PublicPassport } from "./components/PublicPassport";
import { ThaiUiLabels } from "./ThaiUiLabels";

export function OperatorGate() {
  const [operator, setOperator] = useState<OperatorIdentity | null | undefined>(undefined);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => observeOperator(setOperator), []);
  const signIn = async () => { setSigningIn(true); setError(""); try { await signInOperatorWithGoogle(); } catch { setError("ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองอีกครั้ง"); } finally { setSigningIn(false); } };
  const signOut = async () => { setError(""); try { await signOutOperator(); } catch { setError("ไม่สามารถออกจากระบบได้ กรุณาลองอีกครั้ง"); } };
  if (operator?.isOperator) return <ThaiUiLabels><header className="operator-bar"><span>ผู้ใช้งาน: {operator.displayName || operator.email || operator.uid}</span><button type="button" onClick={signOut}>ออกจากระบบ</button></header>{error && <p role="alert">{error}</p>}<MvpShell /></ThaiUiLabels>;
  if (operator) return <main className="login-page"><section className="card" aria-label="ไม่ได้รับสิทธิ์"><h1>ไม่ได้รับสิทธิ์</h1><p role="alert">บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งานระบบ Birds My Boss</p><p>หากผู้ดูแลเพิ่งให้สิทธิ์ กรุณาออกจากระบบแล้วเข้าสู่ระบบอีกครั้งเพื่อรับ ID token ใหม่</p><button type="button" onClick={signOut}>ออกจากระบบ</button>{error && <p role="alert">{error}</p>}</section><PublicPassport /></main>;
  return <main className="login-page"><section className="card" aria-label="เข้าสู่ระบบผู้ดูแลฟาร์ม"><h1>Birds My Boss</h1><p>ระบบภายในสำหรับผู้ปฏิบัติงานฟาร์ม</p>{operator === undefined ? <p>กำลังตรวจสอบสถานะการเข้าสู่ระบบ…</p> : <button type="button" disabled={signingIn} onClick={signIn}>{signingIn ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบด้วย Google"}</button>}{error && <p role="alert">{error}</p>}</section><PublicPassport /></main>;
}
