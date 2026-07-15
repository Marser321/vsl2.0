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
  await page.route("**/api/readiness", (route) => route.fulfill({ json: {
    readyToGenerate: true, database: { available: true, error: null },
    provider: { label: "Anthropic", model: "claude-test", available: true, error: null },
    prompt: { available: true, error: null }, transcription: { available: true, model: "gpt-4o-transcribe", error: null },
    publicUrl: { available: true, url: "http://localhost:3000", error: null },
  } }));
  await page.route("**/api/clients*", (route) => route.fulfill({ json: [{ id: 1, name: "Cliente QA" }] }));
  await page.route(/\/api\/frameworks/, (route) => route.fulfill({
    json: [{ id: 2, name: "Reel UGC", description: "Testimonio a cámara" }],
  }));
  await page.route(/\/api\/stats/, (route) => route.fulfill({ json: { byFramework: [] } }));
  await page.route("**/api/generation-preflight", (route) => route.fulfill({ json: {
    provider: "anthropic", providerLabel: "Anthropic", model: "claude-test", available: true,
    keyAvailable: true, callsPerRun: 1, quota: null,
    setup: { frameworkCount: 1, hasFrameworks: true, hasSystemPrompt: true },
  } }));
  await page.route(/\/api\/documents\?suggestedFor=1/, (route) => route.fulfill({ json: [
    { id: 10, title: "Radar semanal", kind: "reference", clientId: 1, tokenCount: 500, tags: ["radar"], preselect: true, avgRating: null, bestHookRate: null, bestMetric: null, qualityConflict: false },
    { id: 11, title: "Transcript competidor", kind: "transcript", clientId: 1, tokenCount: 700, tags: [], preselect: true, avgRating: null, bestHookRate: null, bestMetric: null, qualityConflict: false },
    { id: 12, title: "Ejemplar con conflicto", kind: "winning_script", clientId: 1, tokenCount: 900, tags: ["promovido"], preselect: false, avgRating: 2, bestHookRate: 46, bestMetric: { platform: "meta", hookRate: 46, ctr: 1.8, cpa: 11, impressions: 2000, versionNumber: 2 }, qualityConflict: true },
  ] }));

  await page.goto("/generar");
  await page.getByRole("button", { name: /Reel Vertical/ }).click();
  await page.getByRole("button", { name: "Cliente QA" }).click();

  await expect(page.getByRole("button", { name: /Elegir estructura manualmente/ })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Radar, transcripts y referencias" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ejemplares con señales de calidad" })).toBeVisible();
  await expect(page.getByText("Señales en conflicto")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Ejemplar con conflicto/ })).not.toBeChecked();
  await expect(page.getByText("2 documentos")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("el generador valida inline y confirma OpenRouter antes de reservar", async ({ page }) => {
  await page.route("**/api/readiness", (route) => route.fulfill({ json: {
    readyToGenerate: true, database: { available: true, error: null },
    provider: { label: "OpenRouter — arnés 5+1", model: "ensemble", available: true, error: null },
    prompt: { available: true, error: null }, transcription: { available: true, model: "gpt-4o-transcribe", error: null },
    publicUrl: { available: true, url: "http://localhost:3000", error: null },
  } }));
  await page.route("**/api/clients*", (route) => route.fulfill({ json: [{ id: 1, name: "Cliente QA" }] }));
  await page.route(/\/api\/frameworks/, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/stats/, (route) => route.fulfill({ json: { byFramework: [] } }));
  await page.route(/\/api\/documents/, (route) => route.fulfill({ json: [] }));
  await page.route("**/api/generation-preflight", (route) => route.fulfill({ json: {
    provider: "openrouter", providerLabel: "OpenRouter — arnés 5+1", model: "ensemble", available: true,
    keyAvailable: true, callsPerRun: 6, quota: { used: 12, remaining: 38, limit: 50 },
    setup: { frameworkCount: 0, hasFrameworks: false, hasSystemPrompt: true },
  } }));

  await page.goto("/generar");
  await page.getByRole("button", { name: /VSL Video/ }).click();
  await page.getByRole("button", { name: "Cliente QA" }).click();
  await page.getByRole("button", { name: "Generar guion" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Revisá los campos marcados" })).toBeVisible();
  await expect(page.locator("#error-title")).toHaveText("Escribí un título interno");

  await page.getByLabel("Título interno del guion *").fill("QA Guion");
  await page.getByLabel("Producto / servicio *").fill("Producto");
  await page.getByLabel("Audiencia / avatar *").fill("Audiencia");
  await page.getByLabel("Oferta (precio, bonos, garantía) *").fill("Oferta");
  await page.getByLabel("Dolores principales *").fill("Dolores");
  await page.getByLabel("CTA (llamado a la acción) *").fill("Comprar");
  await page.getByRole("button", { name: "Generar guion" }).click();

  await expect(page.getByRole("heading", { name: "Confirmar generación con OpenRouter" })).toBeVisible();
  const confirm = page.getByRole("button", { name: "Reservar y generar" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Entiendo que esta generación reserva 6 llamadas de OpenRouter.").check();
  await expect(confirm).toBeEnabled();
});

test("relevamientos vacío explica el flujo completo", async ({ page }) => {
  await page.route("**/api/intakes", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/clients", (route) => route.fulfill({ json: [] }));
  await page.goto("/relevamientos");
  await expect(page.getByRole("heading", { name: "Todavía no hay relevamientos" })).toBeVisible();
  await expect(page.getByText(/marca, oferta y campaña verificadas/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear el primero" })).toBeVisible();
});

test("un guion fallido conserva el parcial y reintenta en una versión nueva", async ({ page }) => {
  let retried = false;
  await page.route(/\/api\/scripts\/9$/, (route) => route.fulfill({ json: {
    id: 9,
    title: "QA Parcial",
    status: retried ? "draft" : "failed",
    generationError: retried ? null : "El provider se interrumpió",
    outcome: "unknown",
    format: "vsl",
    provider: "anthropic",
    model: "claude-test",
    client: { id: 1, name: "Cliente QA" },
    framework: null,
    promotions: [],
    versions: retried
      ? [
          { id: 1, versionNumber: 1, content: "# Texto parcial guardado", refinementInstruction: null, source: "ai", usage: null, createdAt: "2026-01-01", rating: null },
          { id: 2, versionNumber: 2, content: "# Versión recuperada", refinementInstruction: null, source: "ai", usage: null, createdAt: "2026-01-02", rating: null },
        ]
      : [{ id: 1, versionNumber: 1, content: "# Texto parcial guardado", refinementInstruction: null, source: "ai", usage: null, createdAt: "2026-01-01", rating: null }],
  } }));
  await page.route("**/api/settings", (route) => route.fulfill({ json: { wpm_es: "150" } }));
  await page.route("**/api/scripts/9/retry", (route) => {
    retried = true;
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'data: {"type":"started","scriptId":9,"versionId":2,"versionNumber":2}\n\ndata: {"type":"delta","text":"# Versión recuperada"}\n\ndata: {"type":"done","scriptId":9,"versionId":2,"versionNumber":2}\n\n',
    });
  });

  await page.goto("/guiones/9");
  await expect(page.getByText("La generación quedó incompleta")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Texto parcial guardado" })).toBeVisible();
  await page.getByRole("button", { name: "Reintentar en una versión nueva" }).click();
  await expect(page.getByRole("button", { name: "v2" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Versión recuperada" })).toBeVisible();
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
