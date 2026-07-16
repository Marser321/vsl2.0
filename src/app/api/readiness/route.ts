import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { guardAdminRequest } from "@/lib/auth/session";
import { getOpenRouterQuota, OPENROUTER_CALLS_PER_RUN } from "@/lib/ai/openrouter";
import { getAllSettings } from "@/lib/settings";
import { publicUrlReadiness } from "@/lib/public-url";
import { transcriptionReadiness } from "@/lib/transcription-readiness";

export async function GET(req: Request) {
  const guard = await guardAdminRequest();
  if (guard) return guard;

  let database: { available: boolean; error: string | null } = { available: true, error: null };
  try {
    await getDb().execute(sql`select 1`);
  } catch (error) {
    database = { available: false, error: `No se pudo conectar a la base: ${(error as Error).message}` };
  }

  const settings: Record<string, string> = database.available ? await getAllSettings().catch(() => ({})) : {};
  const provider = "openrouter" as const;
  const providerLabel = "OpenRouter — arnés 5+1";
  const model = settings.default_model_openrouter || "";
  const keyAvailable = Boolean(process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY);
  const quota = database.available
    ? await getOpenRouterQuota().catch(() => null)
    : null;
  const quotaAvailable = (quota?.remaining ?? 0) >= OPENROUTER_CALLS_PER_RUN;
  const promptAvailable = Boolean(settings.system_prompt?.trim());
  const providerAvailable = keyAvailable && Boolean(model) && quotaAvailable;
  const publicUrl = publicUrlReadiness(new URL(req.url).origin);
  const transcription = await transcriptionReadiness();

  return Response.json({
    readyToGenerate: database.available && providerAvailable && promptAvailable,
    database,
    provider: {
      name: provider,
      label: providerLabel,
      model,
      available: providerAvailable,
      keyAvailable,
      quota,
      error: !keyAvailable
        ? `Falta la clave de ${providerLabel}.`
        : !model
          ? `Falta configurar el modelo de ${providerLabel}.`
          : !quotaAvailable
            ? "No quedan llamadas suficientes para una generación."
            : null,
    },
    prompt: {
      available: promptAvailable,
      error: promptAvailable ? null : "Falta configurar el prompt maestro.",
    },
    transcription,
    publicUrl,
  });
}
