import Link from "next/link";

export default function AccessDenied() {
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6"><p className="text-sm font-bold uppercase tracking-widest text-blue-700">Acceso restringido</p><h1 className="page-title mt-3">No tienes permiso para ver esta página.</h1><p className="muted mt-3">Tu cuenta sigue activa, pero esta sección pertenece a otro tipo de usuario o empresa.</p><Link className="button-primary mt-7 w-fit" href="/login">Volver al inicio de sesión</Link></main>;
}
