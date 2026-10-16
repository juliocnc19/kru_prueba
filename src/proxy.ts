import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (/^\/(plataforma|empresa|marcar)(\/|$)/.test(path) && !request.cookies.has("kru_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/plataforma/:path*", "/empresa/:path*", "/marcar/:path*"] };
