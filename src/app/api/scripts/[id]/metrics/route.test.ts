import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { guardAdminRequest } from "@/lib/auth/session";
import { DELETE, POST } from "./route";

vi.mock("@/lib/auth/session", () => ({ guardAdminRequest: vi.fn() }));

const mockedGuard = vi.mocked(guardAdminRequest);
const context = { params: Promise.resolve({ id: "1" }) };

function request(method: "POST" | "DELETE", body: unknown) {
  return new NextRequest("http://localhost/api/scripts/1/metrics", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/scripts/[id]/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGuard.mockResolvedValue(null);
  });

  it("exige al menos una métrica numérica", async () => {
    const response = await POST(
      request("POST", { versionId: 1, platform: "meta", notes: "Sin números" }),
      context
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Cargá al menos una métrica numérica" });
  });

  it("valida porcentajes y plataforma", async () => {
    const response = await POST(
      request("POST", { versionId: 1, platform: "instagram", hookRate: 101 }),
      context
    );

    expect(response.status).toBe(400);
  });

  it("devuelve inmediatamente la respuesta del guard", async () => {
    mockedGuard.mockResolvedValue(Response.json({ error: "No autorizado" }, { status: 401 }));

    const response = await DELETE(
      request("DELETE", { versionId: 1, platform: "meta" }),
      context
    );

    expect(response.status).toBe(401);
  });
});
