import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Reuse an already-installed Chromium instead of downloading Playwright's build
// (install runs with PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1). Falls back to whatever
// Playwright bundles if the system binary isn't where we expect.
const SYSTEM_CHROMIUM = "/opt/homebrew/bin/chromium";
const executablePath = existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined;

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    trace: "retain-on-failure",
    launchOptions: { executablePath }
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } }],
  webServer: [
    {
      command: "npm run dev:server",
      url: "http://127.0.0.1:8080/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: "npm run dev:web",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ]
});
