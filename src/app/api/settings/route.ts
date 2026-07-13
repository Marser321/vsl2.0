import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, setSetting } from "@/lib/settings";
import { getOpenRouterQuota } from "@/lib/ai/openrouter";
import { guardAdminRequest } from "@/lib/auth/session";

export async function GET() {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const [all, quota] = await Promise.all([getAllSettings(), getOpenRouterQuota()]);
  const supported = { ...all };
  delete supported.default_model_openai;
  return NextResponse.json({
    ...supported,
    anthropic_key_set: Boolean(process.env.ANTHROPIC_API_KEY),
    openrouter_key_set: Boolean(process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY),
    openrouter_quota: quota,
  });
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const body = (await req.json()) as Record<string, string>;
  const ALLOWED = [
    "default_provider",
    "default_model_anthropic",
    "default_model_openrouter",
    "system_prompt",
    "wpm_es",
    "context_token_budget",
  ];
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED.includes(key) && typeof value === "string") {
      if (key === "default_provider" && value !== "openrouter" && value !== "anthropic") {
        return NextResponse.json({ error: "Proveedor no soportado" }, { status: 400 });
      }
      await setSetting(key, value);
    }
  }
  return NextResponse.json({ ok: true });
}
