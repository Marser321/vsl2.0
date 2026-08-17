/**
 * Normalización de rubros a un slug estable.
 *
 * El rubro se escribe a mano en tres lugares distintos (`brands.industry`,
 * `clients.industry`, el relevamiento del cliente), así que "Reparación de
 * Crédito", "reparacion de credito" y "Credit Repair" terminan siendo tres
 * rubros distintos para la base. Todo lo que agrupe por vertical —
 * la biblioteca de `documents` con `visibility='industry'`, los
 * `industry_learnings`, el importador y el destilador — compara por el slug
 * que devuelve `industrySlug`, nunca por el texto crudo.
 */

/**
 * Variantes conocidas que deben colapsar en un mismo vertical. La clave es el
 * slug crudo ya normalizado; el valor, el slug canónico.
 */
const INDUSTRY_ALIASES: Record<string, string> = {
  "credit-repair": "reparacion-de-credito",
  "reparacion-credito": "reparacion-de-credito",
  "reparacion-de-creditos": "reparacion-de-credito",
  "credito": "reparacion-de-credito",
  "creditos": "reparacion-de-credito",
  "limpieza-de-credito": "reparacion-de-credito",
  "reparacion-de-credito-personal": "reparacion-de-credito",
};

/**
 * Convierte un rubro escrito a mano en un slug comparable.
 * Devuelve `null` para entradas vacías, para que el llamador distinga
 * "sin rubro" de "rubro desconocido".
 */
export function industrySlug(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const slug = raw
    .normalize("NFD")
    // \p{M} = marcas combinantes; tras NFD son los acentos separados de su letra.
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) return null;
  return INDUSTRY_ALIASES[slug] ?? slug;
}

/**
 * Etiqueta legible de un slug, para títulos y logs.
 * `reparacion-de-credito` → `Reparacion de credito`.
 */
export function industryLabel(slug: string): string {
  const words = slug.replace(/-/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
