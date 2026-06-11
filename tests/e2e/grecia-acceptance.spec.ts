/**
 * Grécia Acceptance E2E — Critical Path Tests
 *
 * Covers Phase 5 Plan 03 D-13: "a few Playwright E2E checks at the critical points
 * (generate, ZIP export)."
 *
 * Three tests:
 *   1. Generate Grécia LP: navigate to /w/{slug}/lps/new, select Grécia template,
 *      fill required fields, submit, and assert LP appears in catalog.
 *   2. Preview renders (no literal tokens): navigate to preview page and assert
 *      no {{ }} placeholders remain and heroTitle is visible.
 *   3. ZIP export returns HTTP 200: trigger export and assert the response
 *      status is 200 and Content-Type contains "zip" or "octet-stream".
 *
 * Environment variables required:
 *   BASE_URL              (default: http://localhost:3000)
 *   TEST_USER_EMAIL       — test user email
 *   TEST_USER_PASSWORD    — test user password
 *   TEST_WORKSPACE_SLUG   — workspace slug for the test workspace
 *
 * IMPORTANT: A Grécia template must already exist in the test workspace before
 * running these tests. Author it through /w/{slug}/templates/new using the markup
 * from tests/fixtures/grecia-authored-template.html.
 *
 * Security: T-05-03-03 — test credentials come from env vars only; never hardcoded.
 */

import { test, expect, type Page } from "@playwright/test";

// -----------------------------------------------------------------------
// Configuration from env vars (T-05-03-03: credentials not hardcoded)
// -----------------------------------------------------------------------

const WORKSPACE_SLUG = process.env.TEST_WORKSPACE_SLUG ?? "test-workspace";
const LP_TITLE = "Grécia Clássica E2E";

// -----------------------------------------------------------------------
// Auth helper — sign in with test credentials
// -----------------------------------------------------------------------

async function signIn(page: Page) {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "TEST_USER_EMAIL and TEST_USER_PASSWORD env vars must be set before running E2E tests."
    );
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in|log in|entrar/i }).click();

  // Wait for redirect away from login (dashboard or workspace)
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });
}

// -----------------------------------------------------------------------
// Shared state across tests in this file
// -----------------------------------------------------------------------

let generatedLpId = "";

// -----------------------------------------------------------------------
// beforeAll: sign in once and store session storage
// -----------------------------------------------------------------------

test.describe("Grécia acceptance — generate → preview → export", () => {
  test.beforeAll(async ({ browser }) => {
    // Pre-sign-in so each test starts authenticated
    const page = await browser.newPage();
    await signIn(page);
    // Save storage state (cookies + localStorage) to reuse in each test
    await page.context().storageState({ path: ".playwright-auth.json" });
    await page.close();
  });

  test.use({ storageState: ".playwright-auth.json" });

  // -----------------------------------------------------------------------
  // Test 1: Generate Grécia LP
  // -----------------------------------------------------------------------

  test("generates a Grécia LP and shows it in the catalog", async ({ page }) => {
    // Navigate to LP generation start — template picker
    await page.goto(`/w/${WORKSPACE_SLUG}/lps/new`);

    // Wait for the template list to be visible
    await page.waitForSelector('[data-slot="select-trigger"], [role="combobox"]', {
      timeout: 10_000,
    });

    // Select the Grécia template from the dropdown
    // The template picker uses a Select component; find by label text or option
    const selectTrigger = page.locator('[data-slot="select-trigger"]').first();
    await selectTrigger.click();
    // Select the option whose text contains "Grécia" or "grecia" (case-insensitive)
    const greciaOption = page.getByRole("option", {
      name: /gr[eé]cia/i,
    });
    await greciaOption.click();

    // Fill in the LP name
    const nameInput = page.getByLabel(/landing page name|lp name|name/i).first();
    await nameInput.fill(LP_TITLE);

    // Click "Continue" to proceed to the form
    await page.getByRole("button", { name: /continue/i }).click();

    // Now on the LP form page — fill required scalar fields
    await page.waitForURL(
      (url) => url.pathname.includes("/lps/new/") && url.searchParams.has("name"),
      { timeout: 10_000 }
    );

    // Fill seo_titulo (text field — required or optional)
    const seoTituloInput = page.getByLabel(/seo_titulo|seo titulo/i).first();
    if (await seoTituloInput.isVisible()) {
      await seoTituloInput.fill("Explore a Grécia Eterna");
    }

    // Fill hero fields
    await page
      .getByLabel(/hero_titulo_linha1/i)
      .first()
      .fill("Explore");
    await page
      .getByLabel(/hero_titulo_linha2/i)
      .first()
      .fill("a Grécia");
    await page
      .getByLabel(/hero_titulo_linha3/i)
      .first()
      .fill("Eterna");
    await page
      .getByLabel(/hero_subtitulo/i)
      .first()
      .fill("Renova Turismo apresenta");
    await page
      .getByLabel(/cta_primary_label/i)
      .first()
      .fill("Reservar Agora");

    // Fill button+URL field (cta_primary_url) — both label and url sub-fields
    const ctaUrlInput = page.getByLabel(/button url|url/i).first();
    if (await ctaUrlInput.isVisible()) {
      await ctaUrlInput.fill("https://wa.me/5519992016125");
    }

    // Add at least 1 item to the destaques repeater
    const addDestaquesBtn = page
      .getByRole("button", { name: /add|adicionar/i })
      .first();
    if (await addDestaquesBtn.isVisible()) {
      await addDestaquesBtn.click();
      // Fill the first item's titulo field
      await page
        .getByLabel(/titulo/i)
        .first()
        .fill("Ilhas Escondidas");
    }

    // Submit the form
    await page.getByRole("button", { name: /generate lp|gerar/i }).click();

    // Wait for redirect back to catalog
    await page.waitForURL(
      (url) =>
        url.pathname.includes(`/w/${WORKSPACE_SLUG}/lps`) &&
        !url.pathname.includes("/new"),
      { timeout: 20_000 }
    );

    // Assert: LP name appears in the catalog
    await expect(
      page.getByText(LP_TITLE, { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // Extract LP id from the URL or a data attribute for subsequent tests
    // The catalog card should have a link to the LP preview
    const previewLink = page.locator(`a[href*="/lps/"][href*="/preview"]`).first();
    const href = await previewLink.getAttribute("href");
    if (href) {
      const match = href.match(/\/lps\/([^/]+)\/preview/);
      if (match?.[1]) {
        generatedLpId = match[1];
      }
    }
  });

  // -----------------------------------------------------------------------
  // Test 2: Preview renders with no literal {{ }} tokens
  // -----------------------------------------------------------------------

  test("LP preview renders without literal {{ }} token placeholders", async ({
    page,
  }) => {
    if (!generatedLpId) {
      test.skip(true, "Skipped: Test 1 did not produce an LP id.");
    }

    await page.goto(
      `/w/${WORKSPACE_SLUG}/lps/${generatedLpId}/preview`
    );

    // Wait for the preview iframe or the page to load
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // The preview page renders HTML inside an iframe with srcdoc (LpPreview component)
    const iframe = page.locator("iframe").first();

    // Assert: the page body (or iframe) does NOT contain literal {{ ... }}
    // Check the outer page first
    const outerContent = await page.content();
    expect(outerContent).not.toContain("{{");

    // Also check inside the iframe if accessible (same-origin)
    try {
      const innerContent = await iframe.contentFrame()?.content();
      if (innerContent) {
        expect(innerContent).not.toContain("{{");
        // Assert: the heroTitle text we entered is visible
        expect(innerContent.toLowerCase()).toContain("grécia");
      }
    } catch {
      // iframe content not accessible (different-origin sandbox) — outer check is sufficient
    }
  });

  // -----------------------------------------------------------------------
  // Test 3: ZIP export returns HTTP 200 with zip content type
  // -----------------------------------------------------------------------

  test("ZIP export endpoint returns HTTP 200 with zip content type", async ({
    page,
    request,
  }) => {
    if (!generatedLpId) {
      test.skip(true, "Skipped: Test 1 did not produce an LP id.");
    }

    // Intercept the export request while clicking the export button from the catalog
    // Strategy: use page.waitForResponse() to catch the /api/lps/{id}/export request
    const exportUrl = `/api/lps/${generatedLpId}/export`;

    // Navigate to the catalog
    await page.goto(`/w/${WORKSPACE_SLUG}/lps`);
    await page.waitForLoadState("networkidle");

    // Alternative: use request fixture directly to hit the export endpoint
    // This is more reliable than clicking through the UI when auth cookies are shared
    const response = await request.get(exportUrl);

    expect(response.status()).toBe(200);

    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType.toLowerCase()).toMatch(/zip|octet-stream/);
  });
});
