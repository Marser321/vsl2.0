import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { frameworks } from "@/db/schema";
import { getOpenRouterQuota, OPENROUTER_CALLS_PER_RUN } from "@/lib/ai/openrouter";
import type { OperationalProviderName } from "@/lib/ai/provider";
import { guardAdminRequest } from "@/lib/auth/session";
import { getAllSettings } from "@/lib/settings";

const PROVIDER_LABELS: Record<OperationalProviderName, string> = {
  anthropic: "Claude (Anthropic)",
  openrouter: "OpenRouter — arnés 5+1",
};

export async function GET() {
  const guard = await guardAdminRequest();
  if (guard) return guard;

  const all = await getAllSettings();
  const provider: OperationalProviderName = all.default_provider === "anthropic" ? "anthropic" : "openrouter";
  const modelKey = provider === "anthropic" ? "default_model_anthropic" : "default_model_openrouter";
  const model = all[modelKey] || (provider === "openrouter" ? "openrouter/ensemble-5+1" : "");
  const keyAvailable = provider === "anthropic"
    ? Boolean(process.env.ANTHROPIC_API_KEY)
    : Boolean(process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY);

  const [frameworkRow] = await getDb().select({ count: sql<number>`count(*)` }).from(frameworks);
  const frameworkCount = Number(frameworkRow?.count ?? 0);
  const quota = provider === "openrouter" ? await getOpenRouterQuota() : null;
  const available = keyAvailable && Boolean(model) && (
    provider !== "openrouter" || (quota?.remaining ?? 0) >= OPENROUTER_CALLS_PER_RUN
  );

  return Response.json({
    provider,
    providerLabel: PROVIDER_LABELS[provider],
    model,
    available,
    keyAvailable,
    callsPerRun: provider === "openrouter" ? OPENROUTER_CALLS_PER_RUN : 1,
    quota,
    setup: {
      frameworkCount,
      hasFrameworks: frameworkCount > 0,
      hasSystemPrompt: Boolean(all.system_prompt?.trim()),
    },
  });
}
