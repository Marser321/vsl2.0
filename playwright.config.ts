import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // El entorno local comparte un pool DB de cuatro conexiones. Dos workers
  // prueban desktop y mobile en paralelo sin convertir el runner en carga artificial.
  workers: 2,
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run build && npm run start -- --port 3020", url: "http://localhost:3020", reuseExistingServer: true, timeout: 120_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3020",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
