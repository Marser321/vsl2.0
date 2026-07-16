import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/db";
import { guardAdminRequest } from "@/lib/auth/session";
import { buildContext } from "@/lib/ai/context-builder";
import { getProvider } from "@/lib/ai/provider";
import { POST } from "./route";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ guardAdminRequest: vi.fn() }));
vi.mock("@/lib/ai/context-builder", () => ({ buildContext: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({ getProvider: vi.fn() }));

function queryResult<T>(result: T) {
  const query: Record<string, unknown> = {};
  for (const method of ["from", "where", "orderBy", "limit"]) query[method] = vi.fn(() => query);
  query.then = (resolve: (value: T) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

const script = {
  id: 7,
  clientId: 2,
  brandId: null,
  offerId: null,
  campaignId: null,
  frameworkId: null,
  format: "reel",
  provider: "openrouter",
  model: "modelo",
  brief: {},
};
const v3 = { id: 33, scriptId: 7, versionNumber: 3, content: "v3", generationParams: { documentIds: [3] } };
const v1 = { id: 11, scriptId: 7, versionNumber: 1, content: "v1", generationParams: { documentIds: [1] } };

function request(versionId: number) {
  return new NextRequest("http://localhost/api/scripts/7/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction: "Ajustar", versionId }),
  });
}

describe("POST /api/scripts/[id]/refine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardAdminRequest).mockResolvedValue(null);
  });

  it("usa la versión visible como base y conserva la numeración global", async () => {
    const selectResults: unknown[] = [[script], [v3, v1]];
    const values = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 44 }]) }));
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => queryResult(selectResults.shift())),
      insert: vi.fn(() => ({ values })),
    } as never);
    vi.mocked(buildContext).mockResolvedValue({ systemBlocks: [], messages: [] } as never);
    vi.mocked(getProvider).mockResolvedValue({
      generateStream: async function* () { yield "nuevo"; },
      getFinalUsage: () => null,
    } as never);

    const response = await POST(request(11), { params: Promise.resolve({ id: "7" }) });
    await response.text();

    expect(buildContext).toHaveBeenCalledWith(expect.objectContaining({ documentIds: [1] }));
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      versionNumber: 4,
      generationParams: v1.generationParams,
    }));
  });

  it("rechaza una versión ajena", async () => {
    const selectResults: unknown[] = [[script], [v3, v1]];
    vi.mocked(getDb).mockReturnValue({ select: vi.fn(() => queryResult(selectResults.shift())) } as never);
    const response = await POST(request(99), { params: Promise.resolve({ id: "7" }) });
    expect(response.status).toBe(404);
    expect(buildContext).not.toHaveBeenCalled();
  });
});
