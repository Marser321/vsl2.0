import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  if (!req.cookies.has("vsl_admin_session")) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/clientes/:path*", "/relevamientos/:path*", "/aprendizajes/:path*", "/generar/:path*", "/guiones/:path*", "/biblioteca/:path*", "/analizador/:path*", "/configuracion/:path*"],
};
