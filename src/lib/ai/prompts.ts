import type { Document, Framework, ScriptBrief, ScriptFormat, Client } from "@/db/schema";

const KIND_LABELS: Record<Document["kind"], string> = {
  winning_script: "GUION GANADOR (ejemplo de calidad a imitar)",
  brief: "BRIEF / DOCUMENTO DEL CLIENTE",
  framework: "FRAMEWORK / METODOLOGÍA",
  transcript: "TRANSCRIPT DE VSL DE REFERENCIA",
  reference: "MATERIAL DE REFERENCIA",
  learning: "APRENDIZAJE DE LA AGENCIA (regla acumulada — aplicar siempre)",
};

export function renderDocument(doc: Document, performanceEvidence?: string): string {
  const tags = doc.tags.length ? ` | tags: ${doc.tags.join(", ")}` : "";
  return `<documento tipo="${KIND_LABELS[doc.kind]}" titulo="${doc.title}"${tags}>
${performanceEvidence ? `<evidencia_rendimiento>${performanceEvidence}</evidencia_rendimiento>\n` : ""}
${doc.extractedText.trim()}
</documento>`;
}

export function renderFrameworks(fws: Framework[]): string {
  if (!fws.length) return "";
  const body = fws
    .map((f) => `### ${f.name}\n${f.description ?? ""}\n\n${f.structureMd}`)
    .join("\n\n");
  return `## Frameworks de estructura disponibles\n\n${body}`;
}

export function renderClientDossier(
  client: Client,
  docs: Document[],
  performanceEvidence = new Map<number, string>()
): string {
  const header = `## Dossier del cliente: ${client.name}
Industria: ${client.industry || "—"}
${client.description ? `Descripción: ${client.description}` : ""}
${client.notes ? `Notas de la agencia: ${client.notes}` : ""}`.trim();

  const body = docs.map((doc) => renderDocument(doc, performanceEvidence.get(doc.id))).join("\n\n");
  return `${header}\n\n${body}`;
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  reels: "Instagram Reels",
  shorts: "YouTube Shorts",
};

export function renderBriefMessage(args: {
  brief: ScriptBrief;
  framework: Framework | null;
  format?: ScriptFormat;
}): string {
  const { brief, framework } = args;
  const format = args.format ?? "vsl";
  const fwSection = framework
    ? `## Framework a usar: ${framework.name}\n${framework.structureMd}`
    : "## Framework: a tu criterio, elegí la mejor estructura para este caso.";

  if (format === "reel") {
    const seg = brief.duracionSeg ?? 45;
    // ~150 wpm en español = 2.5 palabras por segundo.
    const words = Math.round(seg * 2.5);
    const plataforma = brief.plataforma ? PLATFORM_LABELS[brief.plataforma] : "";
    return `Generá un guion de REEL VERTICAL (video corto) completo con este brief:

## Brief
- **Producto/servicio:** ${brief.producto}
- **Audiencia / avatar:** ${brief.audiencia}
- **Oferta:** ${brief.oferta}
- **Dolores principales:** ${brief.dolores}
- **Objeciones a manejar:** ${brief.objeciones || "—"}
- **Duración objetivo:** ${seg} segundos (~${words} palabras locutadas)
${plataforma ? `- **Plataforma de destino:** ${plataforma}` : ""}
- **Tono:** ${brief.tono || "directo y nativo de la plataforma"}
- **CTA:** ${brief.cta}
${brief.instruccionesExtra ? `- **Instrucciones adicionales:** ${brief.instruccionesExtra}` : ""}

${fwSection}

## Formato de salida para REEL (reemplaza el formato de salida del prompt maestro)
- Título del reel como H1.
- Cada beat como H2 con su rango en SEGUNDOS, ej.: \`## Gancho (0:00–0:03)\`.
- Debajo de cada H2, en este orden: \`> [VISUAL: plano, acción o b-roll]\`, \`> [TEXTO EN PANTALLA: ...]\` y la locución EXACTA a grabar.
- El gancho hablado, el visual y el texto en pantalla arrancan juntos en los primeros 2 segundos — nada de saludos ni contexto.
- Ritmo: ~2.5 palabras por segundo. Respetá la duración objetivo ±10%.
- Aplicá el "Playbook de reels verticales" y la taxonomía de ganchos de la biblioteca global.

Escribí el guion completo ahora.`;
  }

  return `Generá un guion de VSL completo con este brief:

## Brief
- **Producto/servicio:** ${brief.producto}
- **Audiencia / avatar:** ${brief.audiencia}
- **Oferta:** ${brief.oferta}
- **Dolores principales:** ${brief.dolores}
- **Objeciones a manejar:** ${brief.objeciones || "—"}
- **Duración objetivo:** ${brief.duracionMin} minutos (~${brief.duracionMin * 150} palabras)
- **Tono:** ${brief.tono || "directo y emocional"}
- **CTA:** ${brief.cta}
${brief.instruccionesExtra ? `- **Instrucciones adicionales:** ${brief.instruccionesExtra}` : ""}

${fwSection}

Escribí el guion completo ahora.`;
}
