import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, createAdminSession } from "@/lib/auth/session";
import { assertLoginAllowed, loginFingerprint, recordLogin, verifyAdminPassword } from "@/lib/auth/admin";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const parsed = z.object({ password: z.string().min(1).max(500) }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Clave inválida" }, { status: 400 });
    const fingerprint = loginFingerprint(req);
    await assertLoginAllowed(fingerprint);
    const success = await verifyAdminPassword(parsed.data.password);
    await recordLogin(fingerprint, success);
    if (!success) return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
    await createAdminSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "RATE_LIMITED") return NextResponse.json({ error: "Demasiados intentos. Probá en 15 minutos." }, { status: 429 });
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
