"use client";

import { useActionState, useMemo } from "react";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ActionFeedback, SubmitButton } from "@/components/action-feedback";
import { approveCompanyAction, changeCompanyStatusAction, createHrAction } from "@/modules/companies/actions";

type CompanyRow = { id: string; name: string; code: string; status: "pending" | "active" | "rejected" | "suspended"; createdAt: string; admins: string[] };
const labels = { pending: "Pendiente", active: "Activa", rejected: "Rechazada", suspended: "Suspendida" };

function CompanyActions({ row }: { row: CompanyRow }) {
  const [state, action] = useActionState(createHrAction, { error: "" });
  return <div className="space-y-3"><div className="flex flex-wrap gap-2">{row.status === "pending" && <form action={approveCompanyAction}><input type="hidden" name="companyId" value={row.id}/><SubmitButton className="button-primary text-xs">Aprobar</SubmitButton></form>}{row.status === "active" && <form action={changeCompanyStatusAction}><input type="hidden" name="companyId" value={row.id}/><input type="hidden" name="status" value="suspended"/><SubmitButton className="button-secondary text-xs">Suspender</SubmitButton></form>}{row.status === "suspended" && <form action={changeCompanyStatusAction}><input type="hidden" name="companyId" value={row.id}/><input type="hidden" name="status" value="active"/><SubmitButton className="button-secondary text-xs">Reactivar</SubmitButton></form>}</div><details className="text-sm"><summary className="cursor-pointer font-semibold text-blue-700">Agregar RRHH</summary><form action={action} className="mt-3 grid gap-2"><input type="hidden" name="companyId" value={row.id}/><input className="field" name="name" placeholder="Nombre" required/><input className="field" name="email" type="email" placeholder="Correo" required/><input className="field" name="password" type="password" minLength={10} placeholder="Contraseña" required/><ActionFeedback error={state.error} success={state.success}/><SubmitButton className="button-primary text-xs">Crear cuenta</SubmitButton></form></details></div>;
}

export function PlatformCompanies({ rows }: { rows: CompanyRow[] }) {
  const columns = useMemo<ColumnDef<CompanyRow>[]>(() => [
    { accessorKey: "name", header: "Empresa", cell: ({ row }) => <div><strong>{row.original.name}</strong><p className="muted text-xs">{row.original.code}</p></div> },
    { accessorKey: "status", header: "Estado", cell: ({ row }) => <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.original.status === "active" ? "bg-emerald-100 text-emerald-800" : row.original.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}`}>{labels[row.original.status]}</span> },
    { id: "admins", header: "Cuentas RRHH", cell: ({ row }) => <span className="text-xs">{row.original.admins.join(", ") || "Sin cuenta"}</span> },
    { id: "actions", header: "Acciones", cell: ({ row }) => <CompanyActions row={row.original}/> },
  ], []);
  // TanStack Table returns methods that React Compiler intentionally does not memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  if (!rows.length) return <p className="muted rounded-xl bg-slate-50 p-6">Aún no hay empresas registradas.</p>;
  return <><div className="space-y-4 lg:hidden">{rows.map((row) => <article key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="font-bold">{row.name}</h3><p className="muted text-xs">{row.code}</p></div><span className="text-xs font-bold">{labels[row.status]}</span></div><p className="mb-3 text-xs text-slate-600">{row.admins.join(", ")}</p><CompanyActions row={row}/></article>)}</div><div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="px-3 py-3">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className="border-b border-slate-100 align-top">{row.getVisibleCells().map((cell) => <td key={cell.id} className="px-3 py-4">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div></>;
}
