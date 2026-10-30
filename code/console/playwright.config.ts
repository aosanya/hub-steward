import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  timeout: 15 * 60 * 1000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: process.env.E2E_OUTPUT_DIR ?? "test-results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5190",
    viewport: { width: 1440, height: 900 },
    trace: "off",
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
});
