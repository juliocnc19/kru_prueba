"use client";

import { useActionState } from "react";
import { registerCompanyAction } from "@/modules/companies/actions";
import { ActionFeedback, SubmitButton } from "@/components/action-feedback";

export function RegisterForm() {
  const [state, action] = useActionState(registerCompanyAction, { error: "" });
  return <form action={action} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><label><span className="label">Nombre de la empresa</span><input className="field" name="companyName" required minLength={2} placeholder="Empresa Ejemplo"/></label><label><span className="label">Código para colaboradores</span><input className="field" name="code" required minLength={3} pattern="[a-zA-Z0-9-]+" placeholder="empresa-ejemplo"/></label></div><div className="border-t border-slate-200 pt-5"><h2 className="mb-4 text-lg font-bold">Cuenta de RRHH</h2><div className="grid gap-5 sm:grid-cols-2"><label><span className="label">Nombre completo</span><input className="field" name="adminName" required minLength={2}/></label><label><span className="label">Correo electrónico</span><input className="field" name="email" type="email" required autoComplete="email"/></label></div></div><label className="block"><span className="label">Contraseña</span><input className="field" name="password" type="password" required minLength={10} autoComplete="new-password"/><span className="mt-1 block text-xs text-slate-500">Mínimo 10 caracteres, con mayúscula, minúscula y número.</span></label><ActionFeedback error={state.error} success={state.success}/><SubmitButton>Enviar solicitud</SubmitButton></form>;
}
