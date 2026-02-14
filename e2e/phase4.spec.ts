import { test, expect } from "@playwright/test";

const TEST_USER = {
  email: "test@pillar.dev",
  password: "TestPassword123!",
};

const SUFFIX = Date.now().toString(36);

test.describe("Phase 4 — Calendar & Recurring Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("calendar page shows monthly grid with navigation", async ({ page }) => {
    await page.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 10000,
    });

    // Weekday headers visible
    await expect(page.getByText("Sun")).toBeVisible();
    await expect(page.getByText("Sat")).toBeVisible();

    // Navigation buttons
    await expect(
      page.getByRole("button", { name: "Previous month" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next month" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
  });

  test("month navigation updates URL and heading", async ({ page }) => {
    await page.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 10000,
    });

    // Navigate to next month
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(page).toHaveURL(/month=/);

    // Navigate back
    await page.getByRole("button", { name: "Previous month" }).click();

    // Today resets
    await page.getByRole("button", { name: "Today" }).click();
  });

  test("task with due date shows as pill on calendar", async ({ page }) => {
    const categoryName = `E2E CalCat ${SUFFIX}`;
    const projectName = `E2E CalProj ${SUFFIX}`;
    const taskTitle = `E2E CalTask ${SUFFIX}`;

    // Create category + project
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

    // Navigate to project & create task with due date
    await page.getByRole("link", { name: projectName }).click();
    await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });

    // Click "Add task" button, then fill inline form
    await page.getByLabel("Add task to To Do").click();
    const taskInput = page.getByPlaceholder("Task title…");
    await expect(taskInput).toBeVisible();
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 5000 });

    // Open task sheet and set due date to a specific day this month
    await page.getByText(taskTitle).click();
    await expect(page.getByLabel("Title")).toBeVisible({ timeout: 5000 });

    // Use the 28th of the current month to avoid crowded dates from prior runs
    const today = new Date();
    const targetDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-28`;
    await page.getByLabel("Due Date").fill(targetDate);

    // Wait for the debounced PATCH to complete
    const patchPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/tasks/") && res.request().method() === "PATCH",
    );
    await patchPromise;

    // Navigate to calendar
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 10000,
    });

    // Click on the 28th to open day detail (avoids overflow limit on calendar grid)
    const targetLabel = new Date(
      today.getFullYear(),
      today.getMonth(),
      28,
    ).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    await page.getByLabel(targetLabel).click();

    // Task should appear in the day detail panel
    await expect(page.getByText(taskTitle).last()).toBeVisible({
      timeout: 10000,
    });
  });

  test("clicking a date opens day detail panel", async ({ page }) => {
    await page.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 10000,
    });

    // Click on today's date number button
    const todayDate = new Date();
    const todayLabel = todayDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    await page.getByLabel(todayLabel).click();

    // Day detail sheet should appear with the quick-create input
    await expect(page.getByLabel("New task title")).toBeVisible({
      timeout: 5000,
    });
  });

  test("recurrence picker shows in task sheet with end date", async ({
    page,
  }) => {
    const categoryName = `E2E RecCat ${SUFFIX}`;
    const projectName = `E2E RecProj ${SUFFIX}`;
    const taskTitle = `E2E RecTask ${SUFFIX}`;

    // Setup
    await page.getByLabel("Create category").click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName)).toBeVisible({ timeout: 5000 });

    await page.getByLabel(`Add project to ${categoryName}`).click();
    await page.getByLabel("Name").fill(projectName);
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("link", { name: projectName }).click();
    await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });

    // Create task and open it
    await page.getByLabel("Add task to To Do").click();
    const taskInput = page.getByPlaceholder("Task title…");
    await expect(taskInput).toBeVisible();
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 5000 });
    await page.getByText(taskTitle).click();

    // Recurrence picker should be visible
    await expect(page.getByLabel("Recurrence frequency")).toBeVisible({
      timeout: 5000,
    });

    // Select Weekly frequency via Radix Select
    await page.getByLabel("Recurrence frequency").click();
    await page.getByRole("option", { name: "Weekly" }).click();

    // Interval and end date should now be visible
    await expect(page.getByLabel("Recurrence interval")).toBeVisible();
    await expect(page.getByLabel("Recurrence end date")).toBeVisible();

    // Preview text should appear
    await expect(page.getByText(/Repeats every week/)).toBeVisible();
  });
});
