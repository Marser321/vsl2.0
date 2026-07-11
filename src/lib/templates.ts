import type { ScriptBrief } from "@/db/schema";

/**
 * Convención de plantillas: tokens `{{ASI}}` que se resuelven al usar la
 * plantilla con datos del cliente y de briefDefaults. Los tokens sin valor
 * quedan LITERALES a propósito: el editor los muestra como checklist de
 * marcadores pendientes.
 *
 * Reemplazo por split/join literal — nunca regex sobre contenido del usuario.
 */
const BRIEF_TOKEN_MAP: Record<string, keyof ScriptBrief> = {
  "{{PRODUCTO}}": "producto",
  "{{AUDIENCIA}}": "audiencia",
  "{{OFERTA}}": "oferta",
  "{{DOLOR}}": "dolores",
  "{{CTA}}": "cta",
};

export function resolvePlaceholders(
  contentMd: string,
  client: { name: string; industry: string | null },
  briefDefaults: Partial<ScriptBrief>
): string {
  let out = contentMd;
  const replace = (token: string, value: string | null | undefined) => {
    if (typeof value === "string" && value.trim()) out = out.split(token).join(value.trim());
  };
  replace("{{CLIENTE}}", client.name);
  replace("{{INDUSTRIA}}", client.industry);
  for (const [token, field] of Object.entries(BRIEF_TOKEN_MAP)) {
    const value = briefDefaults[field];
    replace(token, typeof value === "string" ? value : undefined);
  }
  return out;
}

/** Slug simple para "guardar como plantilla". */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "plantilla";
}
