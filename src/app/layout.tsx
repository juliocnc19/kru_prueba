import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Kru Marcaje", description: "Marcaje y horas listas para nómina" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
