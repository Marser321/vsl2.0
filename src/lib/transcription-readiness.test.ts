import { afterEach, describe, expect, it, vi } from "vitest";
import { resetTranscriptionReadinessCache, transcriptionReadiness } from "./transcription-readiness";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetTranscriptionReadinessCache();
});

describe("readiness de transcripción", () => {
  it("detecta que el modelo gratuito requiere saldo mínimo para audio", async () => {
    vi.stubEnv("OPENROUTER_API_KEYS", "or-audit");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: { total_credits: 0 } })));
    await expect(transcriptionReadiness()).resolves.toMatchObject({
      configured: true,
      available: false,
      validated: true,
      provider: "openrouter",
    });
  });

  it("marca OpenRouter listo con el saldo de activación", async () => {
    vi.stubEnv("OPENROUTER_API_KEYS", "or-audit");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: { total_credits: 0.7, total_usage: 0.2 } })));
    await expect(transcriptionReadiness()).resolves.toMatchObject({ available: true, provider: "openrouter", error: null });
  });

  it("marca el worker Whisper self-hosted como listo cuando /health responde", async () => {
    vi.stubEnv("WHISPER_ENDPOINT", "https://worker.example/transcribe");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(transcriptionReadiness()).resolves.toMatchObject({
      available: true,
      validated: true,
      provider: "selfhosted",
      error: null,
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://worker.example/health");
  });

  it("declara Groq como fallback cuando ya está configurado", async () => {
    vi.stubEnv("OPENROUTER_API_KEYS", "or-audit");
    vi.stubEnv("GROQ_API_KEY", "gsk-audit");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: { total_credits: 0 } })));
    await expect(transcriptionReadiness()).resolves.toMatchObject({ available: true, provider: "groq" });
  });
});
