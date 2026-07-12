import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("GET /api/cron/radar", () => {
  it("responde 503 cuando CRON_SECRET no está configurado", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new NextRequest("http://localhost/api/cron/radar"));
    expect(response.status).toBe(503);
  });

  it("responde 401 cuando el bearer no coincide", async () => {
    process.env.CRON_SECRET = "secreto-de-prueba";
    const response = await GET(
      new NextRequest("http://localhost/api/cron/radar", {
        headers: { Authorization: "Bearer incorrecto" },
      })
    );
    expect(response.status).toBe(401);
  });
});
