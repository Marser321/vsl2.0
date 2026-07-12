import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev -- --port 3020", url: "http://localhost:3020", reuseExistingServer: true },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3020",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
