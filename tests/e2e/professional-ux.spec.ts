import { expect, test } from "@playwright/test";

test("la navegación responde en desktop y mobile", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "VSL Studio" })).toBeVisible();

  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir navegación" }).click();
    const navigation = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(navigation).toBeVisible();
    await navigation.getByRole("link", { name: "Guiones", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Guiones" })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("el generador explica contexto, mercado y señales en conflicto", async ({ page }) => {
  await page.route("**/api/clients*", (route) => route.fulfill({ json: [{ id: 1, name: "Cliente QA" }] }));
  await page.route(/\/api\/frameworks/, (route) => route.fulfill({
    json: [{ id: 2, name: "Reel UGC", description: "Testimonio a cámara" }],
  }));
  await page.route(/\/api\/stats/, (route) => route.fulfill({ json: { byFramework: [] } }));
  await page.route(/\/api\/documents\?suggestedFor=1/, (route) => route.fulfill({ json: [
    { id: 10, title: "Radar semanal", kind: "reference", clientId: 1, tokenCount: 500, tags: ["radar"], preselect: true, avgRating: null, bestHookRate: null, bestMetric: null, qualityConflict: false },
    { id: 11, title: "Transcript competidor", kind: "transcript", clientId: 1, tokenCount: 700, tags: [], preselect: true, avgRating: null, bestHookRate: null, bestMetric: null, qualityConflict: false },
    { id: 12, title: "Ejemplar con conflicto", kind: "winning_script", clientId: 1, tokenCount: 900, tags: ["promovido"], preselect: false, avgRating: 2, bestHookRate: 46, bestMetric: { platform: "meta", hookRate: 46, ctr: 1.8, cpa: 11, impressions: 2000, versionNumber: 2 }, qualityConflict: true },
  ] }));

  await page.goto("/generar");
  await page.getByRole("button", { name: /Reel Vertical/ }).click();
  await page.getByRole("button", { name: "Cliente QA" }).click();
  await page.getByRole("button", { name: /Reel UGC/ }).click();

  await expect(page.getByRole("heading", { name: "Radar, transcripts y referencias" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ejemplares con señales de calidad" })).toBeVisible();
  await expect(page.getByText("Señales en conflicto")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Ejemplar con conflicto/ })).not.toBeChecked();
  await expect(page.getByText("2 documentos")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("el detalle muestra una sola promoción y confirma el copiado", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });
  await page.route(/\/api\/scripts\/1$/, (route) => route.fulfill({ json: {
    id: 1,
    title: "Guion QA",
    status: "final",
    outcome: "won",
    format: "reel",
    provider: "anthropic",
    model: "modelo",
    client: { id: 1, name: "Cliente QA" },
    framework: { id: 2, name: "Reel UGC" },
    promotions: [{ documentId: 8, versionId: 2, scope: "client", legacy: false }],
    versions: [
      { id: 1, versionNumber: 1, content: "v1", refinementInstruction: null, source: "ai", usage: null, createdAt: "2026-01-01", rating: null },
      { id: 2, versionNumber: 2, content: "# Guion listo", refinementInstruction: "mejorar", source: "ai", usage: null, createdAt: "2026-01-02", rating: null },
    ],
  } }));
  await page.route("**/api/settings", (route) => route.fulfill({ json: { wpm_es: "150" } }));
  await page.route("**/api/scripts/1/metrics", (route) => route.fulfill({ json: { metrics: [
    { id: 1, scriptVersionId: 2, versionNumber: 2, platform: "meta", hookRate: 46, ctr: 1.8, cpa: 11, impressions: 2000, notes: null, capturedAt: "2026-01-02", updatedAt: "2026-01-02" },
  ] } }));
  await page.route("**/api/scripts/1/hooks", (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/scripts\/1\/critique/, (route) => route.fulfill({ json: [] }));

  await page.goto("/guiones/1");
  await expect(page.getByText("La v2 tiene las mejores métricas reales")).toBeVisible();
  await expect(page.getByText("En Cliente QA")).toBeVisible();
  await expect(page.getByText(/promovela como ejemplar/)).toHaveCount(1);

  await page.getByRole("button", { name: "Copiar guion" }).first().click();
  await expect(page.getByRole("button", { name: "Guion copiado" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
