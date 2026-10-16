"use client";

import { useActionState, useState } from "react";
import { ActionFeedback, SubmitButton } from "@/components/action-feedback";
import { createDepartmentAction, updatePolicyAction } from "@/modules/departments/actions";

type Policy = { ordinaryMinutes: number; nightStart: string; nightEnd: string; weeklyOvertimeAlertMinutes: number; geofenceRequired: boolean; latitude: number | null; longitude: number | null; radiusMeters: number | null };

export function CreateDepartmentForm() {
  const [state, action] = useActionState(createDepartmentAction, { error: "" });
  return <form action={action} className="mt-5 space-y-3"><label><span className="label">Nombre</span><input className="field" name="name" required minLength={2} placeholder="Operaciones"/></label><ActionFeedback error={state.error} success={state.success}/><SubmitButton className="button-primary w-full">Crear departamento</SubmitButton></form>;
}

export function PolicyForm({ departmentId, policy }: { departmentId: string; policy: Policy }) {
  const [state, action] = useActionState(updatePolicyAction, { error: "" });
  const [required, setRequired] = useState(policy.geofenceRequired);
  const [latitude, setLatitude] = useState(policy.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(policy.longitude?.toString() ?? "");
  const [geoError, setGeoError] = useState("");
  function useCurrentLocation() {
    if (!navigator.geolocation) { setGeoError("Tu navegador no admite ubicación."); return; }
    navigator.geolocation.getCurrentPosition((position) => { setLatitude(position.coords.latitude.toFixed(6)); setLongitude(position.coords.longitude.toFixed(6)); setGeoError(""); }, () => setGeoError("Permite la ubicación y vuelve a intentarlo."), { enableHighAccuracy: true, maximumAge: 0 });
  }
  return <form action={action} className="space-y-5"><input type="hidden" name="departmentId" value={departmentId}/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><label><span className="label">Minutos ordinarios</span><input className="field" name="ordinaryMinutes" type="number" min={1} max={1440} defaultValue={policy.ordinaryMinutes} required/></label><label><span className="label">Inicio nocturno</span><input className="field" name="nightStart" type="time" defaultValue={policy.nightStart} required/></label><label><span className="label">Fin nocturno</span><input className="field" name="nightEnd" type="time" defaultValue={policy.nightEnd} required/></label><label><span className="label">Alerta extra semanal (min)</span><input className="field" name="weeklyOvertimeAlertMinutes" type="number" min={0} defaultValue={policy.weeklyOvertimeAlertMinutes} required/></label></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><label className="flex cursor-pointer items-center gap-3 font-semibold"><input type="checkbox" name="geofenceRequired" checked={required} onChange={(event) => setRequired(event.target.checked)} className="h-5 w-5 accent-blue-700"/> Exigir ubicación para entrada y salida</label>{required && <div className="mt-4 grid gap-4 sm:grid-cols-3"><label><span className="label">Latitud</span><input className="field" name="latitude" type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} required/></label><label><span className="label">Longitud</span><input className="field" name="longitude" type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} required/></label><label><span className="label">Radio</span><select className="field" name="radiusMeters" defaultValue={policy.radiusMeters ?? 30}><option value="20">20 m</option><option value="30">30 m</option><option value="40">40 m</option></select></label><button type="button" onClick={useCurrentLocation} className="button-secondary text-sm sm:col-span-3 sm:w-fit">Usar mi ubicación actual</button>{geoError && <p role="alert" className="text-sm text-rose-700 sm:col-span-3">{geoError}</p>}</div>}</div><ActionFeedback error={state.error} success={state.success}/><SubmitButton>Guardar nueva versión de reglas</SubmitButton></form>;
}
