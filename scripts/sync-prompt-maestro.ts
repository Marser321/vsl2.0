/**
 * Sincroniza el prompt maestro de `src/db/seed.ts` con el que vive en la base.
 *
 * `db:seed` usa `onConflictDoNothing` para no pisar las ediciones que el equipo
 * hace desde /configuracion, así que editar el prompt en el código no alcanza:
 * la base se queda con la versión vieja para siempre. Este script hace el
 * update explícito.
 *
 * Ojo: el prompt maestro es la cabeza del Bloque 1 cacheado, así que cambiarlo
 * invalida el caché de todas las generaciones una vez. Agrupá los cambios.
 *
 * Uso: npm run db:sync-prompt [-- --dry-run]
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { settings } from "../src/db/schema";
import { PROMPT_MAESTRO } from "../src/db/prompt-maestro";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const db = getDb();
  const [fila] = await db.select().from(settings).where(eq(settings.key, "system_prompt")).limit(1);
  const actual = fila?.value ?? "";

  if (actual === PROMPT_MAESTRO) {
    console.log("El prompt de la base ya coincide con el del código. Nada que hacer.");
    return;
  }

  console.log(`Base:   ${actual.length} caracteres`);
  console.log(`Código: ${PROMPT_MAESTRO.length} caracteres`);

  if (dryRun) {
    console.log("\n[dry-run] No se escribió nada. Corré sin --dry-run para aplicar.");
    return;
  }

  await db
    .insert(settings)
    .values({ key: "system_prompt", value: PROMPT_MAESTRO })
    .onConflictDoUpdate({ target: settings.key, set: { value: PROMPT_MAESTRO } });

  console.log("\n✓ Prompt maestro actualizado en la base.");
  console.log("El caché del Bloque 1 se invalida una vez: la próxima generación de cada cliente paga el prefijo completo.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
