"use client";

export function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6"><p className="text-sm font-bold text-rose-700">Ocurrió un error</p><h1 className="page-title mt-3">No pudimos cargar esta sección.</h1><p className="muted mt-3">Inténtalo de nuevo. Si continúa, avisa al administrador.</p><button className="button-primary mt-7 w-fit" onClick={reset}>Reintentar</button></main>;
}
