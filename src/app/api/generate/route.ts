import { NextRequest } from "next/server";
import { guardAdminRequest } from "@/lib/auth/session";
import { createGenerationStream } from "@/lib/generation/stream";
import { generationInputSchema } from "@/lib/generation/schema";

// El arnés OpenRouter ejecuta cinco propuestas y una síntesis. En producción
// puede superar un minuto aun cuando todos los proveedores estén sanos.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;

  const parsed = generationInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json({ error: issue.message, path: issue.path }, { status: 400 });
  }

  try {
    return await createGenerationStream(parsed.data);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
