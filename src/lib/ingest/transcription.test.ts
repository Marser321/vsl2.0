import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeAudioChunks, transcriptionErrorMessage } from "./transcription";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function audioFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "vsl-transcription-test-"));
  const file = path.join(directory, "audio.mp3");
  await writeFile(file, "audio-controlado");
  return { file, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

describe("transcripción de audio sin OpenAI", () => {
  it("envía audio base64 al modelo gratuito de OpenRouter", async () => {
    vi.stubEnv("OPENROUTER_API_KEYS", "or-test");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      choices: [{ message: { content: "Transcript controlado suficientemente largo ".repeat(5) } }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    const fixture = await audioFixture();
    try {
      await expect(transcribeAudioChunks([fixture.file])).resolves.toMatchObject({
        provider: "openrouter",
        chunks: 1,
      });
      const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
      expect(request.messages[0].content[1].type).toBe("input_audio");
      expect(request.messages[0].content[1].input_audio.data).toBe(Buffer.from("audio-controlado").toString("base64"));
    } finally {
      await fixture.cleanup();
    }
  });

  it("usa Groq automáticamente cuando OpenRouter no habilita audio", async () => {
    vi.stubEnv("OPENROUTER_API_KEYS", "or-test");
    vi.stubEnv("GROQ_API_KEY", "groq-test");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: { message: "requires balance" } }, { status: 402 }))
      .mockResolvedValueOnce(Response.json({ text: "Transcript de respaldo suficientemente largo ".repeat(5) }));
    vi.stubGlobal("fetch", fetchMock);
    const fixture = await audioFixture();
    try {
      await expect(transcribeAudioChunks([fixture.file])).resolves.toMatchObject({ provider: "groq" });
      expect(fetchMock.mock.calls[1][0]).toContain("api.groq.com");
    } finally {
      await fixture.cleanup();
    }
  });

  it("prioriza el worker Whisper self-hosted cuando está configurado", async () => {
    vi.stubEnv("WHISPER_ENDPOINT", "https://worker.example/transcribe");
    vi.stubEnv("OPENROUTER_API_KEYS", "or-test");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ text: "Transcript local suficientemente largo ".repeat(5) }));
    vi.stubGlobal("fetch", fetchMock);
    const fixture = await audioFixture();
    try {
      await expect(transcribeAudioChunks([fixture.file])).resolves.toMatchObject({ provider: "selfhosted", chunks: 1 });
      expect(fetchMock.mock.calls[0][0]).toBe("https://worker.example/transcribe");
      expect(fetchMock.mock.calls[0][1].body).toBeInstanceOf(FormData);
    } finally {
      await fixture.cleanup();
    }
  });

  it("cae a OpenRouter si el worker Whisper self-hosted falla", async () => {
    vi.stubEnv("WHISPER_ENDPOINT", "https://worker.example/transcribe");
    vi.stubEnv("OPENROUTER_API_KEYS", "or-test");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: "worker caído" }, { status: 502 }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "Transcript nube suficientemente largo ".repeat(5) } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const fixture = await audioFixture();
    try {
      await expect(transcribeAudioChunks([fixture.file])).resolves.toMatchObject({ provider: "openrouter" });
      expect(fetchMock.mock.calls[1][0]).toContain("openrouter.ai");
    } finally {
      await fixture.cleanup();
    }
  });

  it("explica el saldo mínimo de OpenRouter sin exponer claves", () => {
    const failure = Object.assign(new Error("requires $0.50 sk-secret-value"), { provider: "openrouter", status: 402 });
    const message = transcriptionErrorMessage(failure);
    expect(message).toContain("USD 0,50");
    expect(message).not.toContain("sk-secret");
  });
});
