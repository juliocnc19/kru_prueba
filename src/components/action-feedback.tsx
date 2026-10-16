"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "button-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className}>{pending ? "Guardando…" : children}</button>;
}

export function ActionFeedback({ error, success }: { error: string; success?: string }) {
  if (error) return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>;
  if (success) return <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{success}</p>;
  return null;
}
