import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { clients, scripts, scriptVersions, templates, type ScriptBrief } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSetting } from "@/lib/settings";
import { guardAdminRequest } from "@/lib/auth/session";
import { resolvePlaceholders } from "@/lib/templates";

const useSchema = z.object({ clientId: z.number().int().positive() });

type Params = { params: Promise<{ id: string }> };

/**
 * "Usar plantilla": crea un guion (v1 source='template') para el cliente, con
 * los placeholders resueltos, y provider/model REALES de settings — así
 * Refinar/Crítica/Hook Lab funcionan sobre guiones nacidos de plantilla.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;
  const { id } = await params;
  const parsed = useSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Elegí un cliente" }, { status: 400 });
  }

  const db = getDb();
  const [template] = await db.select().from(templates).where(eq(templates.id, Number(id))).limit(1);
  if (!template) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, parsed.data.clientId))
    .limit(1);
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const configuredProvider = await getSetting("default_provider", "openrouter");
  const providerName = configuredProvider === "anthropic" ? "anthropic" : "openrouter";
  const model = await getSetting(
    providerName === "anthropic"
      ? "default_model_anthropic"
      : "default_model_openrouter",
    providerName === "openrouter" ? "openrouter/ensemble-5+1" : "claude-opus-4-8"
  );

  const content = resolvePlaceholders(template.contentMd, client, template.briefDefaults);
  const brief: ScriptBrief = {
    producto: "",
    audiencia: "",
    oferta: "",
    dolores: "",
    objeciones: "",
    duracionMin: 5,
    tono: "",
    cta: "",
    instruccionesExtra: "",
    ...template.briefDefaults,
  };

  const result = await db.transaction(async (tx) => {
    const [script] = await tx
      .insert(scripts)
      .values({
        clientId: client.id,
        frameworkId: template.frameworkId,
        title: `${template.title} — ${client.name}`,
        brief,
        format: template.format,
        provider: providerName,
        model,
      })
      .returning();
    const [version] = await tx
      .insert(scriptVersions)
      .values({
        scriptId: script.id,
        versionNumber: 1,
        content,
        generationParams: {
          provider: providerName,
          model,
          documentIds: [],
          frameworkId: template.frameworkId,
          templateId: template.id,
        },
        source: "template",
        usage: null,
      })
      .returning();
    return { scriptId: script.id, versionId: version.id };
  });

  return NextResponse.json(result, { status: 201 });
}
