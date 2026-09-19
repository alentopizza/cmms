import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/dashboard");
  return <main className="login-wrap"><section className="login-card">
    <h1 className="page-title">Deswel CMMS</h1>
    <p className="muted">Acceso administrativo inicial</p>
    <form className="form" method="post" action="/api/auth/login">
      <div className="field"><label>Contraseña</label><input name="password" type="password" required autoFocus /></div>
      <button className="button" type="submit">Ingresar</button>
    </form>
  </section></main>;
}
