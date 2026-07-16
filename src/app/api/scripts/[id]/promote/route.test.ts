import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/db";
import { guardAdminRequest } from "@/lib/auth/session";
import { estimateTokens } from "@/lib/ai/tokens";
import { POST } from "./route";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ guardAdminRequest: vi.fn() }));
vi.mock("@/lib/ai/tokens", () => ({ estimateTokens: vi.fn() }));

function queryResult<T>(result: T) {
  const query: Record<string, unknown> = {};
  for (const method of ["from", "where", "orderBy", "limit", "set"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: T) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

const script = { id: 7, title: "Guion", clientId: 2, brandId: null, offerId: null, campaignId: null };
const v3 = { id: 33, scriptId: 7, versionNumber: 3, content: "contenido v3", generationParams: { documentIds: [] } };
const v2 = { id: 22, scriptId: 7, versionNumber: 2, content: "contenido v2", generationParams: { documentIds: [9] } };

function request(body: unknown) {
  return new NextRequest("http://localhost/api/scripts/7/promote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockDatabase(selectResults: unknown[], existingDoc?: Record<string, unknown>) {
  const values = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 50, tags: [], ...existingDoc }]) }));
  const db = {
    select: vi.fn(() => queryResult(selectResults.shift())),
    insert: vi.fn(() => ({ values })),
    update: vi.fn(() => queryResult(undefined)),
  };
  vi.mocked(getDb).mockReturnValue(db as never);
  return { db, values };
}

describe("POST /api/scripts/[id]/promote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardAdminRequest).mockResolvedValue(null);
    vi.mocked(estimateTokens).mockReturnValue(10);
  });

  it("promueve exactamente la versión solicitada y el scope global", async () => {
    const { values } = mockDatabase([[script], [v3, v2], []]);
    const response = await POST(request({ versionId: 22, scope: "global" }), { params: Promise.resolve({ id: "7" }) });
    expect(response.status).toBe(201);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      extractedText: "contenido v2",
      visibility: "global",
      tags: ["promovido", "source-version-22", "scope-global"],
    }));
  });

  it("sin versionId conserva el fallback a la última versión", async () => {
    const { values } = mockDatabase([[script], [v3, v2], []]);
    await POST(request({ scope: "client" }), { params: Promise.resolve({ id: "7" }) });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ extractedText: "contenido v3" }));
  });

  it("repite una promoción sin duplicarla", async () => {
    const existing = { id: 44, kind: "winning_script", tags: ["promovido", "source-version-22", "scope-client"] };
    const { db } = mockDatabase([[script], [v3, v2], [existing]]);
    const response = await POST(request({ versionId: 22, scope: "client" }), { params: Promise.resolve({ id: "7" }) });
    expect(response.status).toBe(200);
    expect((await response.json()).alreadyPromoted).toBe(true);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rechaza una versión ajena al guion", async () => {
    mockDatabase([[script], [v3, v2]]);
    const response = await POST(request({ versionId: 99 }), { params: Promise.resolve({ id: "7" }) });
    expect(response.status).toBe(404);
  });
});
