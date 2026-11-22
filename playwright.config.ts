import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  outputDir: "work/playwright-results",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3137",
    headless: true,
    viewport: { width: 1366, height: 768 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/test-server.mjs",
    url: "http://127.0.0.1:3137/login",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
