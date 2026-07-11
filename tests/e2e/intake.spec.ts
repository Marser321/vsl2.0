import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_INTAKE_URL, "Requiere un enlace de relevamiento creado en la base de prueba.");

test("guarda, retoma y muestra la revisión", async ({ page }) => {
  await page.goto(process.env.E2E_INTAKE_URL!);
  await expect(page.getByRole("heading", { name: /relevamiento/i })).toBeVisible();
  await page.getByLabel("Nombre y apellido").fill("Cliente de prueba");
  await page.getByLabel("Email").fill("qa@example.com");
  await page.getByLabel(/Autorizo/).check();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.reload();
  await page.getByRole("button", { name: /Ir a Contacto/ }).click();
  await expect(page.getByLabel("Nombre y apellido")).toHaveValue("Cliente de prueba");
});
