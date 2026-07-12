import { NextRequest } from "next/server";
import { z } from "zod";
import { guardAdminRequest } from "@/lib/auth/session";
import { extractPublicUrl } from "@/lib/ingest/url";

export const maxDuration = 30;

const importUrlSchema = z.object({
  url: z.string().url("Ingresá una URL válida").max(2000, "La URL es demasiado larga"),
});

export async function POST(req: NextRequest) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;

  const parsed = importUrlSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await extractPublicUrl(parsed.data.url);
    if (result.metadata.video === true && result.needsInput === true) {
      return Response.json(
        { error: "El video no tiene subtítulos públicos. Pegá el transcript a mano." },
        { status: 400 }
      );
    }
    if (!result.text.trim()) {
      return Response.json(
        { error: "No se encontró texto útil en la URL. Pegá el transcript a mano." },
        { status: 400 }
      );
    }
    return Response.json({
      title: result.title,
      text: result.text,
      metadata: result.metadata,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
