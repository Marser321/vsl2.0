import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "vsl_admin_session";
const INTAKE_COOKIE = "vsl_intake_session";
const encoder = new TextEncoder();

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres.");
  return encoder.encode(value);
}

async function sign(payload: Record<string, unknown>, expiresAt: Date) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
}

async function verify(token: string | undefined) {
  if (!token) return null;
  try {
    return (await jwtVerify(token, secret())).payload;
  } catch {
    return null;
  }
}

export async function createAdminSession() {
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const token = await sign({ scope: "admin" }, expiresAt);
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdminSession(): Promise<boolean> {
  const payload = await verify((await cookies()).get(ADMIN_COOKIE)?.value);
  return payload?.scope === "admin";
}

export async function requireAdmin() {
  if (!(await isAdminSession())) throw new Error("UNAUTHORIZED");
}

export async function guardAdminRequest(req?: Request, mutation = false): Promise<Response | null> {
  if (!(await isAdminSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (mutation && req) {
    try { assertSameOrigin(req); }
    catch { return Response.json({ error: "Origen inválido" }, { status: 403 }); }
  }
  return null;
}

export async function createIntakeSession(requestId: string, publicId: string, expiresAt: Date) {
  const token = await sign({ scope: "intake", requestId, publicId }, expiresAt);
  (await cookies()).set(INTAKE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getIntakeSession(publicId: string) {
  const payload = await verify((await cookies()).get(INTAKE_COOKIE)?.value);
  if (payload?.scope !== "intake" || payload.publicId !== publicId || typeof payload.requestId !== "string") return null;
  return { requestId: payload.requestId, publicId };
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new Error("INVALID_ORIGIN");
  if (new URL(origin).host !== host) throw new Error("INVALID_ORIGIN");
}
