"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { createEmployeeAction, moveEmployeeAction } from "@/modules/employees/actions";

type DepartmentOption = { id: string; name: string };

export function EmployeeForm({ departments }: { departments: DepartmentOption[] }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const form = useForm({
    defaultValues: { name: "", cedula: "", departmentId: departments[0]?.id ?? "", password: "" },
    onSubmit: async ({ value }) => {
      const data = new FormData();
      Object.entries(value).forEach(([key, entry]) => data.set(key, entry));
      const result = await createEmployeeAction({ error: "" }, data);
      setError(result.error);
      setMessage(result.success ?? "");
      if (result.success) { form.reset(); router.refresh(); }
    },
  });
  return <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); void form.handleSubmit(); }}><form.Field name="name" validators={{ onBlur: ({ value }) => value.trim().length >= 2 ? undefined : "Escribe el nombre completo." }}>{(field) => <label className="block"><span className="label">Nombre completo</span><input className="field" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} required/>{field.state.meta.errors.length > 0 && <small className="text-rose-700">{field.state.meta.errors.join(", ")}</small>}</label>}</form.Field><form.Field name="cedula">{(field) => <label className="block"><span className="label">Cédula</span><input className="field" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} required inputMode="numeric" placeholder="12345678"/></label>}</form.Field><form.Field name="departmentId">{(field) => <label className="block"><span className="label">Departamento</span><select className="field" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} required>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>}</form.Field><form.Field name="password">{(field) => <label className="block"><span className="label">Contraseña inicial</span><input className="field" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} type="password" minLength={10} required placeholder="Mínimo 10 caracteres"/></label>}</form.Field>{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>{([canSubmit, isSubmitting]) => <button className="button-primary w-full" type="submit" disabled={!canSubmit || isSubmitting || !departments.length}>{isSubmitting ? "Guardando…" : "Crear colaborador"}</button>}</form.Subscribe></form>;
}

export function MoveEmployeeForm({ employeeId, currentDepartmentId, departments }: { employeeId: string; currentDepartmentId: string; departments: DepartmentOption[] }) {
  return <form action={moveEmployeeAction} className="flex flex-wrap items-center gap-2"><input type="hidden" name="employeeId" value={employeeId}/><label className="sr-only" htmlFor={`move-${employeeId}`}>Mover de departamento</label><select id={`move-${employeeId}`} name="departmentId" defaultValue={currentDepartmentId} className="field w-auto min-w-40 text-sm">{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><button className="button-secondary text-sm" type="submit">Mover</button></form>;
}
