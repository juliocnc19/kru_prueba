import Link from "next/link";

export default function Home() {
  return <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-6 px-5 py-16"><span className="text-sm font-semibold uppercase tracking-[.2em] text-blue-700">Kru · Marcaje</span><h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Cada minuto cuenta. Tu nómina, clara.</h1><p className="max-w-xl text-lg text-slate-600">Registra jornadas, revisa horas y exporta las novedades de tu equipo sin hojas de papel.</p><div className="flex flex-wrap gap-3"><Link className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white" href="/login">Iniciar sesión</Link><Link className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold" href="/registro">Registrar empresa</Link></div></main>;
}
