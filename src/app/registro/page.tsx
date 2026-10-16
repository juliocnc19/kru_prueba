import Link from "next/link";
import { RegisterForm } from "./form";

export default function RegisterPage() {
  return <main className="mx-auto max-w-2xl px-5 py-10 sm:py-16"><Link href="/" className="text-xl font-black text-[#102b45]">Kru <span className="font-light">Marcaje</span></Link><div className="mt-10"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Nueva empresa</p><h1 className="page-title mt-2">Solicita acceso a Marcaje</h1><p className="muted mt-3">Tu empresa quedará pendiente de aprobación. Cuando se active, podrás registrar departamentos y colaboradores.</p></div><div className="surface mt-8 p-6 sm:p-8"><RegisterForm/></div><Link href="/login" className="mt-6 inline-block text-sm font-bold text-blue-700 hover:underline">Ya tengo una cuenta</Link></main>;
}
