"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ArrowRight, ArrowLeft } from "lucide-react";
import { clockInAction, clockOutAction } from "@/modules/attendance/actions";
import type { LocationReading } from "@/modules/attendance/geofence";

function getLocation(): Promise<LocationReading> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Tu navegador no permite obtener ubicación.")); return; }
    navigator.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() }), (error) => reject(new Error(error.code === 1 ? "Permite el acceso a la ubicación para marcar." : "No se pudo obtener una ubicación precisa. Reintenta.")), { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
  });
}

export function ClockPanel({ isOpen, geofenceRequired, radiusMeters }: { isOpen: boolean; geofenceRequired: boolean; radiusMeters: number | null }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const handleMark = () => startTransition(async () => {
    setMessage(""); setError("");
    try {
      const reading = geofenceRequired ? await getLocation() : null;
      const result = isOpen ? await clockOutAction(reading) : await clockInAction(reading);
      if (result.error) setError(result.error);
      else { setMessage(result.success ?? "Marcaje registrado."); router.refresh(); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo marcar. Reintenta."); }
  });
  return <div><div className="mb-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><MapPin className="mt-0.5 shrink-0 text-blue-700" size={19}/><p>{geofenceRequired ? `Este departamento requiere ubicación dentro de ${radiusMeters} m. Activa el GPS antes de marcar.` : "Puedes marcar desde cualquier ubicación."}</p></div><button className="button-primary min-h-16 w-full text-lg" onClick={handleMark} disabled={pending}>{isOpen ? <ArrowLeft size={20}/> : <ArrowRight size={20}/>} {pending ? "Validando y marcando…" : isOpen ? "Registrar salida" : "Registrar entrada"}</button>{error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}{message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p>}</div>;
}
