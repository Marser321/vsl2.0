import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { clients, documents } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { generateJSON } from "@/lib/ai/structured";
import { renderDocument } from "@/lib/ai/prompts";
import { guardAdminRequest } from "@/lib/auth/session";

export const maxDuration = 60;

const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    producto: { type: "string" },
    audiencia: { type: "string" },
    oferta: { type: "string" },
    dolores: { type: "string" },
    objeciones: { type: "string" },
    tono: { type: "string" },
    cta: { type: "string" },
  },
  required: ["producto", "audiencia", "oferta", "dolores", "objeciones", "tono", "cta"],
  additionalProperties: false,
};

export type AutofillBrief = {
  producto: string;
  audiencia: string;
  oferta: string;
  dolores: string;
  objeciones: string;
  tono: string;
  cta: string;
};

/**
 * Pre-llena el formulario de brief a partir de los documentos del cliente.
 * El equipo solo corrige en vez de escribir de cero.
 */
export async function POST(req: NextRequest) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const parsed = z.object({ clientId: z.number() }).safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "clientId inválido" }, { status: 400 });
  }
  const { clientId } = parsed.data;

  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client)
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.clientId, clientId), eq(documents.isActive, true)))
    .orderBy(asc(documents.id));

  if (!docs.length) {
    return NextResponse.json(
      { error: "El cliente no tiene documentos activos — subí al menos un brief o material del producto." },
      { status: 400 }
    );
  }

  try {
    const brief = await generateJSON<AutofillBrief>({
      systemBlocks: [
        {
          text: `Sos un estratega de marketing directo. A partir del material de un cliente, extraés el brief de VSL: qué se vende, a quién, con qué oferta, contra qué dolores y objeciones. Escribís en español, conciso y específico — cada campo son 1-3 frases utilizables tal cual en un formulario.

## Material del cliente: ${client.name} (${client.industry ?? "—"})
${client.description ?? ""}
${client.notes ? `Notas de la agencia: ${client.notes}` : ""}

${docs.map((doc) => renderDocument(doc)).join("\n\n")}`,
          cache: true,
        },
      ],
      userMessage: `Completá el brief de VSL para este cliente a partir del material. Si un dato no está en los documentos, proponé la mejor hipótesis marcándola con "(hipótesis)". Para "tono", sugerí el registro que mejor calce con la audiencia. Para "cta", el llamado a la acción más natural según la oferta.`,
      schema: BRIEF_SCHEMA,
    });

    return NextResponse.json(brief);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
