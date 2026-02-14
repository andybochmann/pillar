import { test, expect } from "@playwright/test";

const TEST_USER = {
  email: "test@pillar.dev",
  password: "TestPassword123!",
};

const SUFFIX = Date.now().toString(36);

test.describe("Phase 5 — Search, Filters, Labels & Bulk Ops", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("sidebar shows search trigger with / shortcut hint", async ({
    page,
  }) => {
    await expect(page.getByText("Search…")).toBeVisible();
    await expect(page.getByText("/")).toBeVisible();
  });

  test("/ key opens command palette", async ({ page }) => {
    await page.keyboard.press("/");
    await expect(page.getByPlaceholder("Search tasks…")).toBeVisible({
      timeout: 5000,
    });
  });

  test("command palette search returns tasks", async ({ page }) => {
    const categoryName = `E2E SrchCat ${SUFFIX}`;
    const projectName = `E2E SrchProj ${SUFFIX}`;
    const taskTitle = `E2E SearchTarget ${SUFFIX}`;

    // Create category + project + task
    await page.getByLabel("Create category").click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName)).toBeVisible({ timeout: 5000 });

    await page.getByLabel(`Add project to ${categoryName}`).click();
    await page.getByLabel("Name").fill(projectName);
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("link", { name: projectName }).click();
    await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Add task to To Do").click();
    const taskInput = page.getByPlaceholder("Task title…");
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 5000 });

    // Open command palette and search
    await page.keyboard.press("/");
    await page.getByPlaceholder("Search tasks…").fill("SearchTarget");
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 5000 });
  });

  test("label picker creates and assigns labels on task", async ({ page }) => {
    const categoryName = `E2E LblCat ${SUFFIX}`;
    const projectName = `E2E LblProj ${SUFFIX}`;
    const taskTitle = `E2E LblTask ${SUFFIX}`;

    // Create category + project + task
    await page.getByLabel("Create category").click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName)).toBeVisible({ timeout: 5000 });

    await page.getByLabel(`Add project to ${categoryName}`).click();
    await page.getByLabel("Name").fill(projectName);
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("link", { name: projectName }).click();
    await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Add task to To Do").click();
    const taskInput = page.getByPlaceholder("Task title…");
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 5000 });

    // Open task sheet
    await page.getByText(taskTitle).click();
    await expect(page.getByLabel("Title")).toBeVisible({ timeout: 5000 });

    // Open label picker
    await page.getByRole("button", { name: "Manage labels" }).click();

    // Create a new label
    await page.getByLabel("New label name").fill("e2e-label");
    await page.getByRole("button", { name: "Create label" }).click();

    // Toggle the label on
    await page.getByLabel("Toggle e2e-label").click();

    // Label should appear as a badge on the task sheet
    await expect(page.getByText("e2e-label ×")).toBeVisible({ timeout: 5000 });
  });

  test("board filter bar filters tasks by priority", async ({ page }) => {
    const categoryName = `E2E FiltCat ${SUFFIX}`;
    const projectName = `E2E FiltProj ${SUFFIX}`;

    // Create category + project
    await page.getByLabel("Create category").click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName)).toBeVisible({ timeout: 5000 });

    await page.getByLabel(`Add project to ${categoryName}`).click();
    await page.getByLabel("Name").fill(projectName);
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("link", { name: projectName }).click();
    await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });

    // Create two tasks
    await page.getByLabel("Add task to To Do").click();
    let taskInput = page.getByPlaceholder("Task title…");
    await taskInput.fill(`E2E UrgentTask ${SUFFIX}`);
    await taskInput.press("Enter");
    await expect(page.getByText(`E2E UrgentTask ${SUFFIX}`)).toBeVisible({
      timeout: 5000,
    });

    // Set priority to urgent via task sheet
    await page.getByText(`E2E UrgentTask ${SUFFIX}`).click();
    await expect(page.getByLabel("Title")).toBeVisible({ timeout: 5000 });
    await page.getByLabel("Priority").click();
    await page.getByRole("option", { name: "Urgent" }).click();

    const patchPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/tasks/") && res.request().method() === "PATCH",
    );
    await patchPromise;

    // Close sheet
    await page.keyboard.press("Escape");

    // Create a low-priority task
    await page.getByLabel("Add task to To Do").click();
    taskInput = page.getByPlaceholder("Task title…");
    await taskInput.fill(`E2E LowTask ${SUFFIX}`);
    await taskInput.press("Enter");
    await expect(page.getByText(`E2E LowTask ${SUFFIX}`)).toBeVisible({
      timeout: 5000,
    });

    // Open filters and select urgent only
    await page.getByRole("button", { name: "Filters" }).click();
    await page.getByRole("button", { name: "urgent" }).click();

    // Urgent task visible, low task hidden
    await expect(page.getByText(`E2E UrgentTask ${SUFFIX}`)).toBeVisible();
    await expect(page.getByText(`E2E LowTask ${SUFFIX}`)).not.toBeVisible();

    // Clear filters
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText(`E2E LowTask ${SUFFIX}`)).toBeVisible();
  });
});
