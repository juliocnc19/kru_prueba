"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/modules/identity/actions";
import { ActionFeedback, SubmitButton } from "@/components/action-feedback";

export function LoginForm() {
  const [kind, setKind] = useState<"admin" | "employee">("admin");
  const [state, action] = useActionState(loginAction, { error: "" });
  return <form action={action} className="mt-7 space-y-5"><div className="flex rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setKind("admin")} className={`flex-1 rounded-lg px-2 py-2 text-sm font-bold ${kind === "admin" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>RRHH / Plataforma</button><button type="button" onClick={() => setKind("employee")} className={`flex-1 rounded-lg px-2 py-2 text-sm font-bold ${kind === "employee" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>Colaborador</button></div><input type="hidden" name="kind" value={kind}/>{kind === "admin" ? <label><span className="label">Correo electrónico</span><input className="field" name="email" type="email" autoComplete="username" required placeholder="tu@empresa.com"/></label> : <><label><span className="label">Código de empresa</span><input className="field" name="companyCode" required placeholder="empresa-a" autoComplete="organization"/></label><label><span className="label">Cédula</span><input className="field" name="cedula" required inputMode="numeric" placeholder="12345678"/></label></>}<label><span className="label">Contraseña</span><input className="field" name="password" type="password" required autoComplete="current-password"/></label><ActionFeedback error={state.error}/><SubmitButton className="button-primary w-full">Ingresar</SubmitButton></form>;
}
