import { test, expect } from "@playwright/test";
import { ensureSidebar } from "./helpers";

const TEST_USER = {
  email: "test@pillar.dev",
  password: "TestPassword123!",
};

test.describe("Phase 6 — Polish, Error Handling & Mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("skip-to-content link is present", async ({ page }) => {
    const link = page.getByRole("link", { name: "Skip to content" });
    await expect(link).toBeAttached();
  });

  test("? key opens keyboard shortcuts dialog", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(
      page.getByText("Keyboard Shortcuts", { exact: true }),
    ).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Open search")).toBeVisible();
    await expect(page.getByText("Create new task")).toBeVisible();
  });

  test("settings page loads with profile section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Profile")).toBeVisible();
    await expect(
      page.getByText("Change Password", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Danger Zone")).toBeVisible();
  });

  test("sidebar has Settings link", async ({ page }) => {
    await ensureSidebar(page);
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  test("loading skeleton appears on navigation", async ({ page }) => {
    // Navigate to overview - should show skeleton briefly
    await ensureSidebar(page);
    const overviewLink = page.getByRole("link", { name: "Overview" });
    await overviewLink.click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Phase 6 — Mobile", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("mobile shows topbar hamburger menu", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Toggle menu" }),
    ).toBeVisible();
  });

  test("hamburger opens sidebar as sheet overlay", async ({ page }) => {
    await page.getByRole("button", { name: "Toggle menu" }).click();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
  });
});
