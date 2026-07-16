import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { brands, clients, documents } from "@/db/schema";
import { generateJSON } from "@/lib/ai/structured";
import { estimateTokens } from "@/lib/ai/tokens";
import { getSetting } from "@/lib/settings";
import { fetchGoogleNews } from "@/lib/radar/rss";

export const HOOK_ANGLES = [
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
] as const;

export const RADAR_SCHEMA = {
  type: "object",
  properties: {
    angulos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          angulo: { type: "string", enum: [...HOOK_ANGLES] },
          porQueAhora: { type: "string" },
          ideaDeGancho: { type: "string" },
          fuentes: { type: "array", items: { type: "string" } },
        },
        required: ["titulo", "angulo", "porQueAhora", "ideaDeGancho", "fuentes"],
        additionalProperties: false,
      },
    },
  },
  required: ["angulos"],
  additionalProperties: false,
};

export type RadarAngle = {
  titulo: string;
  angulo: string;
  porQueAhora: string;
  ideaDeGancho: string;
  fuentes: string[];
};

export type RadarDocument = typeof documents.$inferSelect;

export type RadarRunResult =
  | { ok: true; doc: RadarDocument; angulos: RadarAngle[]; headlines: number }
  | { ok: false; reason: "sin-rubro" | "sin-noticias" | "error"; message: string };

export async function runRadarForClient(clientId: number, keywords = ""): Promise<RadarRunResult> {
  try {
    const db = getDb();
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) return { ok: false, reason: "error", message: "Cliente no encontrado" };

    const clientBrands = await db
      .select({ industry: brands.industry, subindustry: brands.subindustry })
      .from(brands)
      .where(eq(brands.clientId, client.id));

    const queries = [
      ...new Set(
        [
          client.industry,
          ...clientBrands.flatMap((brand) => [brand.industry, brand.subindustry]),
          ...keywords.split(","),
        ]
          .map((value) => (value ?? "").trim())
          .filter(Boolean)
      ),
    ];
    if (!queries.length) {
      return {
        ok: false,
        reason: "sin-rubro",
        message: "Definí el rubro del cliente (o pasá palabras clave) para leer noticias.",
      };
    }

    const items = await fetchGoogleNews(queries);
    if (!items.length) {
      return {
        ok: false,
        reason: "sin-noticias",
        message: `Sin noticias recientes para: ${queries.join(", ")}. Probá con otras palabras clave.`,
      };
    }

    const headlines = items
      .map((item) => `- [${item.source || "?"} · ${item.pubDate.slice(0, 16)}] ${item.title}`)
      .join("\n");

    const userMessage = `Actuá como estratega de tendencias de la agencia. A partir de las noticias recientes del rubro, generá 3 a 5 "ángulos de oportunidad" para guiones (VSL o reels) de este cliente.

## Cliente
${client.name} — rubro: ${client.industry ?? queries[0]}.${client.description ? ` ${client.description}` : ""}

## Noticias de los últimos 7 días (fuente: Google News)
${headlines}

Reglas:
- Cada ángulo se apoya en al menos un titular REAL de la lista; citalo textual en "fuentes".
- "porQueAhora": qué evento/dato abre la ventana AHORA y cuánto puede durar.
- "ideaDeGancho": la primera frase locutable, lista para testear (aplicá la taxonomía de ganchos).
- Nada inventado: si un dato no está en los titulares, no lo afirmes como hecho.
- Priorizá ángulos accionables para vender en el rubro, no notas de color.`;

    const result = await generateJSON<{ angulos: RadarAngle[] }>({
      systemBlocks: [{ text: await getSetting("system_prompt"), cache: true }],
      userMessage,
      schema: RADAR_SCHEMA,
    });

    const fecha = new Date().toISOString().slice(0, 10);
    const md = `_Radar de tendencias generado el ${fecha} para ${client.name}. Términos: ${queries.join(", ")}. Fuente: Google News, últimos 7 días._

${result.angulos
  .map(
    (angle) => `## ${angle.titulo} — ángulo: ${angle.angulo}
**Por qué ahora:** ${angle.porQueAhora}
**Idea de gancho:** "${angle.ideaDeGancho}"
**Fuentes:**
${angle.fuentes.map((source) => `- ${source}`).join("\n")}`
  )
  .join("\n\n")}

---
### Titulares relevados
${headlines}`;

    const previous = await db
      .select({ id: documents.id, tags: documents.tags })
      .from(documents)
      .where(
        and(
          eq(documents.clientId, client.id),
          eq(documents.kind, "reference"),
          eq(documents.isActive, true)
        )
      );
    const oldRadarIds = previous.filter((document) => document.tags.includes("radar")).map((document) => document.id);
    if (oldRadarIds.length) {
      await db.update(documents).set({ isActive: false }).where(inArray(documents.id, oldRadarIds));
    }

    const tokenCount = estimateTokens(md);
    const [doc] = await db
      .insert(documents)
      .values({
        clientId: client.id,
        visibility: "private",
        title: `[RADAR] ${client.industry ?? queries[0]} — ${fecha}`,
        kind: "reference",
        extractedText: md,
        tokenCount,
        language: "es",
        tags: ["radar", `radar-${fecha}`],
        isActive: true,
      })
      .returning();

    return { ok: true, doc, angulos: result.angulos, headlines: items.length };
  } catch (error) {
    return { ok: false, reason: "error", message: (error as Error).message };
  }
}
