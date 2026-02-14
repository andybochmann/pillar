import { test, expect } from "@playwright/test";

const TEST_USER = {
  email: "test@pillar.dev",
  password: "TestPassword123!",
};

const SUFFIX = Date.now().toString(36);

test.describe("Phase 3 Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("dashboard shows live task count cards", async ({ page }) => {
    // Cards should show numbers (could be 0 or more)
    const overdueCard = page.locator("text=Overdue Tasks").locator("..");
    await expect(overdueCard).toBeVisible();
    const dueTodayCard = page.getByText("Due Today", { exact: true });
    await expect(dueTodayCard).toBeVisible();
    const dueWeekCard = page.getByText("Due This Week");
    await expect(dueWeekCard).toBeVisible();
  });

  test("overview page shows filters and task list", async ({ page }) => {
    await page.getByRole("link", { name: "Overview" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
      timeout: 10000,
    });

    // Filter controls should be visible
    await expect(page.getByText("All projects")).toBeVisible();
    await expect(page.getByText("All priorities")).toBeVisible();
  });

  test("overview filters update URL and results", async ({ page }) => {
    await page.goto("/overview");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
      timeout: 10000,
    });

    // Select "Completed" status filter
    await page.getByText("Open").click();
    await page.getByRole("option", { name: "Completed" }).click();

    // URL should update
    await expect(page).toHaveURL(/completed=true/);
  });

  test("project settings opens and shows column manager", async ({ page }) => {
    const categoryName = `E2E SettCat ${SUFFIX}`;
    const projectName = `E2E SettProj ${SUFFIX}`;

    // Create category
    await page.getByLabel("Create category").click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName)).toBeVisible({ timeout: 5000 });

    // Create project
    await page.getByLabel(`Add project to ${categoryName}`).click();
    await page.getByLabel("Name").fill(projectName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("link", { name: projectName })).toBeVisible({
      timeout: 5000,
    });

    // Navigate to project
    await page.getByRole("link", { name: projectName }).click();
    await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });

    // Open settings
    await page.getByRole("button", { name: "Settings" }).click();

    // Sheet should contain project settings
    await expect(page.getByText("Project Settings")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Columns")).toBeVisible();
    await expect(page.getByText("Archive project")).toBeVisible();
    await expect(page.getByText("Delete project")).toBeVisible();
  });

  test("add column via project settings", async ({ page }) => {
    const categoryName = `E2E ColCat ${SUFFIX}`;
    const projectName = `E2E ColProj ${SUFFIX}`;

    // Setup project
    await page.getByLabel("Create category").click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName)).toBeVisible({ timeout: 5000 });

    await page.getByLabel(`Add project to ${categoryName}`).click();
    await page.getByLabel("Name").fill(projectName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("link", { name: projectName })).toBeVisible({
      timeout: 5000,
    });

    await page.getByRole("link", { name: projectName }).click();
    await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });

    // Open settings
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByText("Columns")).toBeVisible({ timeout: 5000 });

    // Add a new column
    await page.getByPlaceholder("New column name...").fill("Review");
    await page.getByRole("button", { name: "Add" }).click();

    // Should show save button
    await expect(
      page.getByRole("button", { name: "Save changes" }),
    ).toBeVisible();

    // Save
    await page.getByRole("button", { name: "Save changes" }).click();

    // Wait for save and close sheet
    await page.waitForTimeout(1000);
  });

  test("archive project hides from sidebar", async ({ page }) => {
    const categoryName = `E2E ArcCat ${SUFFIX}`;
    const projectName = `E2E ArcProj ${SUFFIX}`;

    // Setup project
    await page.getByLabel("Create category").click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName)).toBeVisible({ timeout: 5000 });

    await page.getByLabel(`Add project to ${categoryName}`).click();
    await page.getByLabel("Name").fill(projectName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("link", { name: projectName })).toBeVisible({
      timeout: 5000,
    });

    // Navigate into project
    await page.getByRole("link", { name: projectName }).click();
    await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });

    // Open settings and toggle archive
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByText("Archive project")).toBeVisible({
      timeout: 5000,
    });

    // Toggle archive switch
    await page.getByLabel("Archive project").click();

    // Should navigate away (to dashboard)
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 10000,
    });

    // Project should not be visible in sidebar (archived)
    await expect(
      page.getByRole("link", { name: projectName }),
    ).not.toBeVisible();

    // Toggle "Show archived" in sidebar
    await page.getByLabel("Show archived projects").click();

    // Project should now be visible with "archived" label
    await expect(page.getByRole("link", { name: projectName })).toBeVisible({
      timeout: 5000,
    });
  });
});
