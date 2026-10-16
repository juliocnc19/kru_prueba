import Link from "next/link";

export default function NotFound() { return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6"><p className="text-sm font-bold text-blue-700">404 · No encontrado</p><h1 className="page-title mt-3">Esta página no está disponible.</h1><Link href="/" className="button-primary mt-7 w-fit">Volver al inicio</Link></main>; }
