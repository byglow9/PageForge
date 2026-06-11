import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for PageForge web app E2E tests.
 *
 * Test environment variables (must be set before running):
 *   BASE_URL              — app base URL (default: http://localhost:3000)
 *   TEST_USER_EMAIL       — test user email
 *   TEST_USER_PASSWORD    — test user password
 *   TEST_WORKSPACE_SLUG   — workspace slug to run tests against
 *
 * Usage:
 *   pnpm exec playwright test                # run all E2E tests
 *   pnpm exec playwright test grecia         # run Grécia acceptance tests
 */
export default defineConfig({
  testDir: "../../tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Do NOT start a dev server automatically — the app must be running before tests.
  // Run: pnpm dev (from apps/web) before running Playwright tests.
});
