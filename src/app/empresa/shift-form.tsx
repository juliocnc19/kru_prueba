"use client";

import { useActionState } from "react";
import { correctShiftAction } from "@/modules/attendance/actions";
import { ActionFeedback, SubmitButton } from "@/components/action-feedback";

export function CorrectShiftForm({ shiftId, checkin, checkout }: { shiftId: string; checkin: string; checkout: string }) {
  const [state, action] = useActionState(correctShiftAction, { error: "" });
  return <details className="group"><summary className="cursor-pointer text-sm font-bold text-blue-700">Corregir</summary><form action={action} className="mt-3 grid w-full min-w-[260px] gap-3 rounded-xl bg-slate-50 p-4 sm:w-72"><input type="hidden" name="shiftId" value={shiftId}/><label><span className="label">Entrada · Caracas</span><input className="field" name="checkinAt" type="datetime-local" defaultValue={checkin} required/></label><label><span className="label">Salida · Caracas</span><input className="field" name="checkoutAt" type="datetime-local" defaultValue={checkout} required/></label><label><span className="label">Motivo de corrección</span><textarea className="field" name="reason" rows={2} required minLength={3}/></label><ActionFeedback error={state.error} success={state.success}/><SubmitButton className="button-primary text-sm">Guardar corrección</SubmitButton></form></details>;
}
