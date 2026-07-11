import type { Document, Framework, ScriptBrief, Client } from "@/db/schema";

const KIND_LABELS: Record<Document["kind"], string> = {
  winning_script: "GUION GANADOR (ejemplo de calidad a imitar)",
  brief: "BRIEF / DOCUMENTO DEL CLIENTE",
  framework: "FRAMEWORK / METODOLOGÍA",
  transcript: "TRANSCRIPT DE VSL DE REFERENCIA",
  reference: "MATERIAL DE REFERENCIA",
  learning: "APRENDIZAJE DE LA AGENCIA (regla acumulada — aplicar siempre)",
};

export function renderDocument(doc: Document): string {
  const tags = doc.tags.length ? ` | tags: ${doc.tags.join(", ")}` : "";
  return `<documento tipo="${KIND_LABELS[doc.kind]}" titulo="${doc.title}"${tags}>
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

export function renderClientDossier(client: Client, docs: Document[]): string {
  const header = `## Dossier del cliente: ${client.name}
Industria: ${client.industry || "—"}
${client.description ? `Descripción: ${client.description}` : ""}
${client.notes ? `Notas de la agencia: ${client.notes}` : ""}`.trim();

  const body = docs.map(renderDocument).join("\n\n");
  return `${header}\n\n${body}`;
}

export function renderBriefMessage(args: {
  brief: ScriptBrief;
  framework: Framework | null;
}): string {
  const { brief, framework } = args;
  const fwSection = framework
    ? `## Framework a usar: ${framework.name}\n${framework.structureMd}`
    : "## Framework: a tu criterio, elegí la mejor estructura para este caso.";

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
