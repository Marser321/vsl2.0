import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { guardAdminRequest } from "@/lib/auth/session";
import { extractPublicUrl } from "@/lib/ingest/url";
import { POST } from "./route";

vi.mock("@/lib/auth/session", () => ({ guardAdminRequest: vi.fn() }));
vi.mock("@/lib/ingest/url", () => ({ extractPublicUrl: vi.fn() }));

const mockedGuard = vi.mocked(guardAdminRequest);
const mockedExtract = vi.mocked(extractPublicUrl);

function request(body: unknown) {
  return new NextRequest("http://localhost/api/analyze/import-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: "localhost",
      Origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analyze/import-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGuard.mockResolvedValue(null);
  });

  it("devuelve título, texto y metadata del extractor", async () => {
    mockedExtract.mockResolvedValue({
      title: "Charla de ventas",
      text: "Título: Charla de ventas\n\nTranscript: Un transcript suficientemente útil.",
      finalUrl: "https://youtube.com/watch?v=abc",
      contentType: "text/html",
      needsInput: false,
      metadata: { video: true, transcript: "public_track", language: "es", trackKind: "public" },
    });

    const response = await POST(request({ url: "https://youtube.com/watch?v=abc" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      title: "Charla de ventas",
      text: "Título: Charla de ventas\n\nTranscript: Un transcript suficientemente útil.",
      metadata: { video: true, transcript: "public_track", language: "es", trackKind: "public" },
    });
  });

  it("rechaza URLs inválidas antes de invocar el extractor", async () => {
    const response = await POST(request({ url: "no-es-url" }));

    expect(response.status).toBe(400);
    expect(mockedExtract).not.toHaveBeenCalled();
  });

  it("explica cuando un video no tiene subtítulos públicos", async () => {
    mockedExtract.mockResolvedValue({
      title: "Video sin captions",
      text: "Título: Video sin captions",
      finalUrl: "https://youtu.be/abc",
      contentType: "text/html",
      needsInput: true,
      metadata: { video: true, transcript: "unavailable", language: undefined, trackKind: undefined },
    });

    const response = await POST(request({ url: "https://youtu.be/abc" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "El video no tiene subtítulos públicos. Pegá el transcript a mano.",
    });
  });

  it("rechaza una extracción sin texto útil", async () => {
    mockedExtract.mockResolvedValue({
      title: "Página vacía",
      text: "   ",
      finalUrl: "https://example.com",
      contentType: "text/html",
      needsInput: false,
      metadata: {},
    });

    const response = await POST(request({ url: "https://example.com" }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("No se encontró texto útil");
  });

  it("propaga como 400 el mensaje seguro del extractor", async () => {
    mockedExtract.mockRejectedValue(new Error("La URL apunta a una red privada o no resoluble."));

    const response = await POST(request({ url: "http://localhost/x" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "La URL apunta a una red privada o no resoluble.",
    });
  });

  it("devuelve inmediatamente la respuesta del guard de autenticación", async () => {
    mockedGuard.mockResolvedValue(Response.json({ error: "No autorizado" }, { status: 401 }));

    const response = await POST(request({ url: "https://example.com" }));

    expect(response.status).toBe(401);
    expect(mockedExtract).not.toHaveBeenCalled();
  });
});
