import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { frameworks } from "@/db/schema";
import { getOpenRouterQuota, OPENROUTER_CALLS_PER_RUN } from "@/lib/ai/openrouter";
import { guardAdminRequest } from "@/lib/auth/session";
import { getAllSettings } from "@/lib/settings";

const PROVIDER_LABEL = "OpenRouter — arnés 5+1";

export async function GET() {
  const guard = await guardAdminRequest();
  if (guard) return guard;

  const all = await getAllSettings();
  const provider = "openrouter" as const;
  const model = all.default_model_openrouter || "openrouter/ensemble-5+1";
  const keyAvailable = Boolean(process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY);

  const [frameworkRow] = await getDb().select({ count: sql<number>`count(*)` }).from(frameworks);
  const frameworkCount = Number(frameworkRow?.count ?? 0);
  const quota = await getOpenRouterQuota();
  const available = keyAvailable && Boolean(model) && (quota?.remaining ?? 0) >= OPENROUTER_CALLS_PER_RUN;

  return Response.json({
    provider,
    providerLabel: PROVIDER_LABEL,
    model,
    available,
    keyAvailable,
    callsPerRun: OPENROUTER_CALLS_PER_RUN,
    quota,
    setup: {
      frameworkCount,
      hasFrameworks: frameworkCount > 0,
      hasSystemPrompt: Boolean(all.system_prompt?.trim()),
    },
  });
}
