import { describe, expect, it } from "vitest";
import { createAccessToken, hashAccessToken } from "./access";
import { anonymizeLearning, hasObviousSensitiveData } from "./anonymize";
import { assertPublicUrl } from "@/lib/ingest/url";
import { assertSameOrigin } from "@/lib/auth/session";

describe("intake security", () => {
  it("genera secretos no reversibles", () => {
    const first = createAccessToken();
    const second = createAccessToken();
    expect(first.token).not.toBe(second.token);
    expect(first.hash).toBe(hashAccessToken(first.token));
    expect(first.hash).not.toContain(first.token);
  });
  it("elimina datos obvios de aprendizajes", () => {
    const raw = "Ver https://marca.com, escribir a a@b.com y pagar USD 499";
    expect(hasObviousSensitiveData(raw)).toBe(true);
    expect(anonymizeLearning(raw)).not.toContain("marca.com");
    expect(anonymizeLearning(raw)).not.toContain("499");
  });
  it("rechaza protocolos y redes locales", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("http://127.0.0.1/admin")).rejects.toThrow(/privada/);
  });
  it("exige un origen coincidente para mutaciones", () => {
    expect(() => assertSameOrigin(new Request("https://studio.test/api", { headers: { origin: "https://studio.test", host: "studio.test" } }))).not.toThrow();
    expect(() => assertSameOrigin(new Request("https://studio.test/api", { headers: { host: "studio.test" } }))).toThrow(/INVALID_ORIGIN/);
    expect(() => assertSameOrigin(new Request("https://studio.test/api", { headers: { origin: "https://evil.test", host: "studio.test" } }))).toThrow(/INVALID_ORIGIN/);
  });
});
