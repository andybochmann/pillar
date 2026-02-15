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

async function navigateToSettings(page: Page) {
  await ensureSidebar(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({
    timeout: 10000,
  });
}

async function scrollToTokensSection(page: Page) {
  const heading = page.getByText("API Tokens", { exact: true });
  await heading.scrollIntoViewIfNeeded();
}

test.describe("MCP API Tokens", () => {
  test("settings page shows API Tokens section", async ({ page }) => {
    await login(page);
    await navigateToSettings(page);
    await scrollToTokensSection(page);

    await expect(
      page.getByText("API Tokens", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Personal access tokens for MCP/),
    ).toBeVisible();
  });

  test("shows MCP server URL", async ({ page }) => {
    await login(page);
    await navigateToSettings(page);
    await scrollToTokensSection(page);

    await expect(page.getByText(/\/api\/mcp/)).toBeVisible();
  });

  test("can create a new API token and see it in the list", async ({
    page,
  }) => {
    await login(page);
    await navigateToSettings(page);
    await scrollToTokensSection(page);

    const tokenName = `E2E Token ${Date.now()}`;
    await page.getByPlaceholder(/Token name/).fill(tokenName);
    await page.getByRole("button", { name: "Create token" }).click();

    // One-time token dialog should appear
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Token created")).toBeVisible({
      timeout: 10000,
    });

    // Should show the full token starting with plt_ inside the dialog
    const tokenDisplay = dialog.locator("[data-token-value]");
    await expect(tokenDisplay).toBeVisible();
    const tokenValue = await tokenDisplay.getAttribute("data-token-value");
    expect(tokenValue).toMatch(/^plt_[a-f0-9]{64}$/);

    // Dismiss the dialog
    await page.getByRole("button", { name: "Done" }).click();

    // Token should appear in the list
    await expect(page.getByText(tokenName)).toBeVisible();
  });

  test("can revoke an existing token", async ({ page }) => {
    await login(page);
    await navigateToSettings(page);
    await scrollToTokensSection(page);

    const tokenName = `Revoke ${Date.now()}`;
    await page.getByPlaceholder(/Token name/).fill(tokenName);
    await page.getByRole("button", { name: "Create token" }).click();

    await expect(
      page.getByRole("dialog").getByText("Token created"),
    ).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Done" }).click();

    // Token should be visible
    await expect(page.getByText(tokenName)).toBeVisible();

    // Click revoke
    await page.getByLabel(`Revoke ${tokenName}`).click();

    // Token should be removed
    await expect(page.getByText(tokenName)).not.toBeVisible();
  });

  test("MCP endpoint rejects unauthenticated requests", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp", {
      headers: { "Content-Type": "application/json" },
      data: {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
        id: 1,
      },
    });
    expect(response.status()).toBe(401);
  });

  test("MCP endpoint accepts authenticated requests", async ({
    page,
    request,
  }) => {
    await login(page);
    await navigateToSettings(page);
    await scrollToTokensSection(page);

    // Create a token via the UI
    const tokenName = `MCP Auth ${Date.now()}`;
    await page.getByPlaceholder(/Token name/).fill(tokenName);
    await page.getByRole("button", { name: "Create token" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Token created")).toBeVisible({
      timeout: 10000,
    });

    // Extract the token from the dialog
    const tokenElement = dialog.locator("[data-token-value]");
    const bearerToken = await tokenElement.getAttribute("data-token-value");

    expect(bearerToken).toBeTruthy();
    expect(bearerToken).toMatch(/^plt_/);

    // Call the MCP endpoint with the Bearer token
    const response = await request.post("/api/mcp", {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${bearerToken}`,
      },
      data: {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "e2e-test", version: "1.0.0" },
        },
        id: 1,
      },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.result.serverInfo.name).toBe("pillar");
  });
});
