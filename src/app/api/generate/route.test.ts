import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { guardAdminRequest } from "@/lib/auth/session";
import { createGenerationStream } from "@/lib/generation/stream";
import { POST } from "./route";

vi.mock("@/lib/auth/session", () => ({ guardAdminRequest: vi.fn() }));
vi.mock("@/lib/generation/stream", () => ({ createGenerationStream: vi.fn() }));

const payload = {
  clientId: 1,
  frameworkId: null,
  documentIds: [],
  title: "Guion QA",
  format: "vsl",
  provider: "openrouter",
  model: "openrouter/ensemble-5+1",
  openrouterConfirmed: true,
  brief: {
    producto: "Producto",
    audiencia: "Audiencia",
    oferta: "Oferta",
    dolores: "Dolores",
    objeciones: "",
    duracionMin: 5,
    tono: "",
    cta: "Comprar",
    instruccionesExtra: "",
  },
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardAdminRequest).mockResolvedValue(null);
  });

  it("rechaza un brief inválido con path de campo", async () => {
    const response = await POST(request({ ...payload, title: "" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Escribí un título interno", path: ["title"] });
    expect(createGenerationStream).not.toHaveBeenCalled();
  });

  it("no permite OpenRouter sin confirmación", async () => {
    const response = await POST(request({ ...payload, provider: "openrouter", model: "ensemble", openrouterConfirmed: false }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Confirmá el uso de 6 llamadas/);
  });

  it("delega una entrada válida al stream durable", async () => {
    vi.mocked(createGenerationStream).mockResolvedValue(new Response("stream", { status: 200 }));
    const response = await POST(request(payload));
    expect(response.status).toBe(200);
    expect(createGenerationStream).toHaveBeenCalledOnce();
  });

  it("rechaza OpenAI como proveedor operativo", async () => {
    const response = await POST(request({ ...payload, provider: "openai" }));
    expect(response.status).toBe(400);
    expect(createGenerationStream).not.toHaveBeenCalled();
  });
});
