import { OperatorGate } from "./OperatorGate";
import { PublicPassport } from "./components/PublicPassport";
import { publicPassportTokenFromPath } from "./passportRoute";

export function Root({pathname=window.location.pathname}:{pathname?:string}){
  const token=publicPassportTokenFromPath(pathname);
  return token?<main className="login-page"><PublicPassport publicToken={token}/></main>:<OperatorGate/>;
}
