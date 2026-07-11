import type { VersionSource } from "@/db/schema";

export type LatestVersionInfo = {
  id: number;
  source: VersionSource;
};

/**
 * Decide si un guardado manual puede COALESCER (actualizar in-place) la última
 * versión en lugar de crear una nueva. La inmutabilidad se preserva donde
 * importa: cualquier versión con crítica o puntuación asociada queda congelada.
 *
 * Coalesce solo si:
 *  1. la última versión ya es una edición manual,
 *  2. el cliente estaba editando exactamente esa versión (baseVersionId),
 *  3. nadie depende de ella (sin críticas ni puntuaciones).
 */
export function shouldCoalesce(
  latest: LatestVersionInfo,
  baseVersionId: number | undefined,
  hasDependents: boolean
): boolean {
  if (latest.source !== "manual") return false;
  if (baseVersionId !== latest.id) return false;
  if (hasDependents) return false;
  return true;
}
