import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  // Acceso libre por defecto; REQUIRE_AUTH=true reactiva el login compartido.
  const authRequired = process.env.REQUIRE_AUTH === "true";
  if (!authRequired) {
    if (req.nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }
  if (req.nextUrl.pathname === "/login") return NextResponse.next();
  if (!req.cookies.has("vsl_admin_session")) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/clientes/:path*",
    "/relevamientos/:path*",
    "/aprendizajes/:path*",
    "/generar/:path*",
    "/guiones/:path*",
    "/plantillas/:path*",
    "/biblioteca/:path*",
    "/analizador/:path*",
    "/configuracion/:path*",
  ],
};
