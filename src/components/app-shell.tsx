"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X, Clock3 } from "lucide-react";
import { logoutAction } from "@/modules/identity/actions";
import { useUiStore } from "@/stores/ui";

type LinkItem = { href: string; label: string };

export function AppShell({ title, subtitle, links, children }: { title: string; subtitle: string; links: LinkItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const menuOpen = useUiStore((state) => state.menuOpen);
  const setMenuOpen = useUiStore((state) => state.setMenuOpen);
  return <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
    <aside className={`${menuOpen ? "block" : "hidden"} fixed inset-0 z-30 bg-[#102b45] p-5 text-white lg:sticky lg:top-0 lg:block lg:h-screen`}>
      <div className="mb-10 flex items-center justify-between"><Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight"><span className="rounded-xl bg-white/10 p-2"><Clock3 size={22}/></span>Kru <span className="font-light">Marcaje</span></Link><button className="lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X /></button></div>
      <p className="mb-3 px-3 text-xs font-bold uppercase tracking-[.17em] text-blue-200/75">{subtitle}</p>
      <nav className="space-y-1" aria-label="Principal">{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className={`block rounded-xl px-3 py-3 text-sm font-semibold ${pathname === link.href ? "bg-white text-[#102b45]" : "text-blue-100 hover:bg-white/10"}`}>{link.label}</Link>)}</nav>
      <form action={logoutAction} className="mt-10"><button className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-semibold text-blue-100 hover:bg-white/10"><LogOut size={18}/> Cerrar sesión</button></form>
    </aside>
    <div className="min-w-0"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:hidden"><button onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="rounded-lg p-2"><Menu /></button><span className="font-bold">Kru Marcaje</span><span className="w-9"/></header><main className="mx-auto max-w-7xl px-4 py-7 sm:px-8 sm:py-10"><div className="mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-blue-700">{subtitle}</p><h1 className="page-title">{title}</h1></div>{children}</main></div>
  </div>;
}
