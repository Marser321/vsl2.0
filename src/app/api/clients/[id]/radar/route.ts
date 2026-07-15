import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardAdminRequest } from "@/lib/auth/session";
import { runRadarForClient } from "@/lib/radar/run";

export const maxDuration = 300;

const radarBodySchema = z.object({ keywords: z.string().max(200).optional() });

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;
  const { id } = await params;
  const parsed = radarBodySchema.safeParse(await req.json().catch(() => ({})));
  const keywords = parsed.success ? (parsed.data.keywords ?? "") : "";
  const result = await runRadarForClient(Number(id), keywords);
  if (result.ok) {
    return NextResponse.json(
      { doc: result.doc, angulos: result.angulos, headlines: result.headlines },
      { status: 201 }
    );
  }
  if (result.reason === "sin-rubro" || result.reason === "sin-noticias") {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  if (result.message === "Cliente no encontrado") {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }
  return NextResponse.json({ error: result.message }, { status: 500 });
}
