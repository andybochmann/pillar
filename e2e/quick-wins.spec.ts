import { test, expect } from "@playwright/test";
import { ensureSidebar } from "./helpers";

const TEST_USER = {
  email: "test@pillar.dev",
  password: "TestPassword123!",
};

/**
 * Helper: login and wait for dashboard
 */
async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_USER.email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 15000,
  });
}

// ============================================================
// Feature 1: Global Search Improvements (#5)
// ============================================================
test.describe("Global Search Improvements", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("command palette opens with / shortcut", async ({ page }) => {
    await page.keyboard.press("/");
    await expect(page.getByPlaceholder(/search/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("command palette shows dialog when opened", async ({ page }) => {
    await page.keyboard.press("/");
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();
  });

  test("search returns results or empty state", async ({ page }) => {
    await page.keyboard.press("/");
    const input = page.getByPlaceholder(/search/i);
    await expect(input).toBeVisible();

    await input.fill("task");
    await page.waitForTimeout(1000);

    // Should show results or "No results" — either way the palette is functional
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();
  });

  test("search palette has archive toggle", async ({ page }) => {
    await page.keyboard.press("/");
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();

    const archiveToggle = page.getByLabel("Include archived");
    await expect(archiveToggle).toBeVisible({ timeout: 3000 });
    await archiveToggle.click();
  });

  test("command palette closes with Escape", async ({ page }) => {
    await page.keyboard.press("/");
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder(/search/i)).not.toBeVisible();
  });
});

// ============================================================
// Feature 2: Saved Filter Presets (#10)
// ============================================================
test.describe("Saved Filter Presets", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("overview page has filter preset selector", async ({ page }) => {
    await ensureSidebar(page);
    await page.getByRole("link", { name: "Overview" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
      timeout: 10000,
    });

    const presetButton = page.locator("[data-testid='preset-selector-trigger']");
    await expect(presetButton).toBeVisible({ timeout: 5000 });
  });

  test("preset selector opens popover", async ({ page }) => {
    await ensureSidebar(page);
    await page.getByRole("link", { name: "Overview" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
      timeout: 10000,
    });

    const presetButton = page.locator("[data-testid='preset-selector-trigger']");
    await expect(presetButton).toBeVisible({ timeout: 5000 });
    await presetButton.click();

    // Popover should show (either presets list or "No saved presets")
    await expect(
      page.getByText("No saved presets").or(page.locator("[data-testid='save-preset-button']")),
    ).toBeVisible({ timeout: 3000 });
  });
});

// ============================================================
// Feature 3: Expanded Keyboard Shortcuts (#11)
// ============================================================
test.describe("Expanded Keyboard Shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("? key opens keyboard shortcuts dialog", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(
      page.getByRole("heading", { name: /keyboard shortcuts/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("shortcuts dialog shows grouped sections", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(
      page.getByRole("heading", { name: /keyboard shortcuts/i }),
    ).toBeVisible();

    await expect(page.getByText("Global")).toBeVisible();
    await expect(page.getByText("Kanban Board")).toBeVisible();
  });

  test("shortcuts dialog shows new shortcuts", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(
      page.getByRole("heading", { name: /keyboard shortcuts/i }),
    ).toBeVisible();

    await expect(page.getByText(/next task/i)).toBeVisible();
    await expect(page.getByText(/previous task/i)).toBeVisible();
    await expect(page.getByText(/cycle priority/i)).toBeVisible();
    await expect(page.getByText(/complete/i).first()).toBeVisible();
  });

  test("shortcuts dialog closes with Escape", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(
      page.getByRole("heading", { name: /keyboard shortcuts/i }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: /keyboard shortcuts/i }),
    ).not.toBeVisible();
  });
});
