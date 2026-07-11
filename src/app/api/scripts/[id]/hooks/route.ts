import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { hookSets, scripts, scriptVersions } from "@/db/schema";
import type { HookVariant } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { buildContext } from "@/lib/ai/context-builder";
import { generateJSON } from "@/lib/ai/structured";
import { guardAdminRequest } from "@/lib/auth/session";

export const maxDuration = 60;

const HOOKS_SCHEMA = {
  type: "object",
  properties: {
    hooks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          angulo: {
            type: "string",
            enum: [
              "curiosidad",
              "dolor",
              "contrarian",
              "prueba social",
              "pregunta",
              "historia",
              "estadística",
              "urgencia",
              "identificación",
              "promesa directa",
            ],
          },
          texto: { type: "string" },
        },
        required: ["angulo", "texto"],
        additionalProperties: false,
      },
    },
  },
  required: ["hooks"],
  additionalProperties: false,
};

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const { id } = await params;
  const sets = await getDb()
    .select()
    .from(hookSets)
    .where(eq(hookSets.scriptId, Number(id)))
    .orderBy(desc(hookSets.createdAt));
  return NextResponse.json(sets);
}

export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(_req, true); if (guard) return guard;
  const { id } = await params;
  const db = getDb();
  const [script] = await db
    .select()
    .from(scripts)
    .where(eq(scripts.id, Number(id)))
    .limit(1);
  if (!script)
    return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });

  const [lastVersion] = await db
    .select()
    .from(scriptVersions)
    .where(eq(scriptVersions.scriptId, script.id))
    .orderBy(desc(scriptVersions.versionNumber))
    .limit(1);
  if (!lastVersion)
    return NextResponse.json({ error: "El guion no tiene versiones" }, { status: 400 });

  // Mismos bloques system que la generación → lectura de caché casi total.
  const context = await buildContext({
    clientId: script.clientId,
    brandId: script.brandId,
    offerId: script.offerId,
    campaignId: script.campaignId,
    frameworkId: script.frameworkId,
    documentIds: lastVersion.generationParams.documentIds,
    brief: script.brief,
  });

  try {
    const result = await generateJSON<{ hooks: HookVariant[] }>({
      systemBlocks: context.systemBlocks,
      userMessage: `Este es el guion actual:

${lastVersion.content}

Generá 10 variantes de GANCHO (los primeros 15-30 segundos) para testear en A/B. Cada variante con un ángulo DISTINTO. Reglas:
- Cada gancho debe poder locutarse en 15-30 segundos (40-75 palabras).
- Mismo producto, misma audiencia y mismo brief que el guion.
- Escribí el texto EXACTO a locutar, sin acotaciones.
- Intensidad alta: cada gancho tiene que ganarse los próximos 10 segundos de atención.`,
      schema: HOOKS_SCHEMA,
    });

    const [row] = await db
      .insert(hookSets)
      .values({ scriptId: script.id, hooks: result.hooks })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
