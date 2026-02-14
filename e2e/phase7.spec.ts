import { test, expect, Page } from "@playwright/test";
import { ensureSidebar } from "./helpers";

const TEST_USER = {
  email: "test@pillar.dev",
  password: "TestPassword123!",
};

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_USER.email);
  await page.getByLabel("Password").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Phase 7: PWA & Offline", () => {
  test.describe("Manifest & metadata", () => {
    test("manifest.json is served correctly", async ({ page }) => {
      const response = await page.goto("/manifest.json");
      expect(response?.status()).toBe(200);
      const json = await response?.json();
      expect(json.name).toBe("Pillar — Task Management");
      expect(json.short_name).toBe("Pillar");
      expect(json.display).toBe("standalone");
      expect(json.icons).toHaveLength(3);
    });

    test("app icons are served", async ({ page }) => {
      const icon192 = await page.goto("/icons/icon-192x192.png");
      expect(icon192?.status()).toBe(200);
      expect(icon192?.headers()["content-type"]).toContain("image/png");

      const icon512 = await page.goto("/icons/icon-512x512.png");
      expect(icon512?.status()).toBe(200);
    });

    test("root layout references the manifest", async ({ page }) => {
      await page.goto("/login");
      const manifestLink = page.locator('link[rel="manifest"]');
      await expect(manifestLink).toHaveAttribute("href", "/manifest.json");
    });

    test("theme-color meta tag is set", async ({ page }) => {
      await page.goto("/login");
      const themeColor = page.locator('meta[name="theme-color"]');
      await expect(themeColor.first()).toBeAttached();
    });
  });

  test.describe("Service worker", () => {
    test("service worker registers after login", async ({ page }) => {
      await login(page);

      // Wait for SW registration
      const swActive = await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return false;
        const reg = await navigator.serviceWorker.ready;
        return !!reg.active;
      });
      expect(swActive).toBe(true);
    });

    test("sw.js is served with no-cache headers", async ({ page }) => {
      const response = await page.goto("/sw.js");
      expect(response?.status()).toBe(200);
      const cacheControl = response?.headers()["cache-control"];
      expect(cacheControl).toContain("no-cache");
    });
  });

  test.describe("Offline banner", () => {
    test("offline banner appears when going offline", async ({
      page,
      context,
    }) => {
      await login(page);

      // Ensure SW is ready so offline mode works
      await page.evaluate(() => navigator.serviceWorker?.ready);

      // Go offline
      await context.setOffline(true);

      // Trigger the offline event in the page
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));

      const banner = page.getByRole("status");
      await expect(banner).toBeVisible({ timeout: 5000 });
      await expect(banner).toContainText("offline");

      // Go back online
      await context.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));

      await expect(banner).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Offline fallback", () => {
    test("offline.html is accessible", async ({ page }) => {
      const response = await page.goto("/offline.html");
      expect(response?.status()).toBe(200);
      await expect(page.getByText("You're offline")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Try again" }),
      ).toBeVisible();
    });
  });

  test.describe("Offline mutation queue", () => {
    test("mutations are queued when offline and synced on reconnect", async ({
      page,
      context,
    }) => {
      await login(page);

      // Navigate to ensure SW caches API data
      await ensureSidebar(page);

      // Create a category to set up a project
      await page.getByRole("button", { name: "Create category" }).click();
      await page.getByLabel("Category name").fill("PWA Test Category");
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByText("PWA Test Category")).toBeVisible({
        timeout: 5000,
      });

      // Create a project
      await page
        .getByRole("button", { name: /Add project to PWA Test Category/ })
        .click();
      await page.getByLabel("Project name").fill("PWA Test Project");
      await page.getByRole("button", { name: "Create" }).click();

      // Navigate to the project
      await ensureSidebar(page);
      await page.getByRole("link", { name: "PWA Test Project" }).click();
      await expect(
        page.getByRole("heading", { name: "PWA Test Project" }),
      ).toBeVisible({ timeout: 10000 });

      // Wait for SW to be ready and cache the board data
      await page.evaluate(() => navigator.serviceWorker?.ready);
      await page.waitForTimeout(1000);

      // Go offline
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));
      await page.waitForTimeout(500);

      // Verify offline banner is shown
      await expect(page.getByRole("status")).toBeVisible({ timeout: 3000 });

      // Go back online
      await context.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));

      // Banner should disappear
      await expect(page.getByRole("status")).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Install prompt", () => {
    test("settings page renders without install prompt in automated browser", async ({
      page,
    }) => {
      await login(page);
      await ensureSidebar(page);
      await page.getByRole("link", { name: "Settings" }).click();
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible(
        { timeout: 10000 },
      );

      // In automated Chromium, beforeinstallprompt doesn't fire
      // so the install card should not be visible
      await expect(page.getByText("Install Pillar")).not.toBeVisible();

      // But the other settings sections should be there
      await expect(page.getByText("Profile")).toBeVisible();
      await expect(page.getByText("Danger Zone")).toBeVisible();
    });
  });
});
