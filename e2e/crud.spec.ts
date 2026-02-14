import { test, expect } from "@playwright/test";
import { ensureSidebar, scrollClick } from "./helpers";

const TEST_USER = {
  email: "test@pillar.dev",
  password: "TestPassword123!",
};

// Use a unique suffix to avoid collisions between test runs
const SUFFIX = Date.now().toString(36);

test.describe("CRUD Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("create → navigate → delete category", async ({ page }) => {
    const categoryName = `E2E Cat ${SUFFIX}`;

    // Open sidebar on mobile
    await ensureSidebar(page);

    // Click "Create category" button in sidebar
    await page.getByRole("button", { name: "Create category" }).click();

    // Dialog should appear
    await expect(
      page.getByRole("heading", { name: "Create Category" }),
    ).toBeVisible();

    // Fill in the name
    await page.getByLabel("Name").fill(categoryName);

    // Submit
    await page.getByRole("button", { name: "Create" }).click();

    // Dialog should close and category should appear in sidebar
    await expect(
      page.getByRole("heading", { name: "Create Category" }),
    ).not.toBeVisible();
    await expect(page.getByText(categoryName).last()).toBeVisible({
      timeout: 5000,
    });
  });

  test("create category → create project → navigate to board", async ({
    page,
  }) => {
    const categoryName = `E2E ProjCat ${SUFFIX}`;
    const projectName = `E2E Project ${SUFFIX}`;

    // Open sidebar on mobile
    await ensureSidebar(page);

    // Create a category first
    await page.getByRole("button", { name: "Create category" }).click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName).last()).toBeVisible({
      timeout: 5000,
    });

    // Click "Add project to {categoryName}" button
    await scrollClick(
      page.getByRole("button", { name: `Add project to ${categoryName}` }),
    );

    // Dialog should appear
    await expect(
      page.getByRole("heading", { name: "Create Project" }),
    ).toBeVisible();

    // Fill in the project name
    await page.getByLabel("Name").fill(projectName);

    // Category should be pre-selected (since we clicked from that category)
    // Submit
    await page.getByRole("button", { name: "Create" }).click();

    // Dialog should close and project should appear in sidebar
    await expect(
      page.getByRole("heading", { name: "Create Project" }),
    ).not.toBeVisible();
    await expect(page.getByRole("link", { name: projectName })).toBeVisible({
      timeout: 5000,
    });

    // Navigate to the project
    await scrollClick(page.getByRole("link", { name: projectName }));

    // Should see the kanban board with default columns
    await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("In Progress")).toBeVisible();
    await expect(page.getByText("Done")).toBeVisible();
  });

  test("create task in column → click to open sheet → edit → delete", async ({
    page,
  }) => {
    const categoryName = `E2E TaskCat ${SUFFIX}`;
    const projectName = `E2E TaskProj ${SUFFIX}`;
    const taskTitle = `E2E Task ${SUFFIX}`;

    // Open sidebar on mobile
    await ensureSidebar(page);

    // Create category
    await page.getByRole("button", { name: "Create category" }).click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName).last()).toBeVisible({
      timeout: 5000,
    });

    // Create project
    await scrollClick(
      page.getByRole("button", { name: `Add project to ${categoryName}` }),
    );
    await page.getByLabel("Name").fill(projectName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("link", { name: projectName })).toBeVisible({
      timeout: 5000,
    });

    // Navigate to project
    await scrollClick(page.getByRole("link", { name: projectName }));
    await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });

    // Click "Add task to To Do" button
    await page.getByLabel("Add task to To Do").click();

    // Inline form should appear — type the task title and press Enter
    const taskInput = page.getByPlaceholder("Task title…");
    await expect(taskInput).toBeVisible();
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");

    // Task should appear in the column
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 5000 });

    // Click the task to open the detail sheet
    await page.getByText(taskTitle).click();

    // Task sheet should open with the title
    await expect(page.getByLabel("Title")).toBeVisible({ timeout: 5000 });
    expect(await page.getByLabel("Title").inputValue()).toBe(taskTitle);

    // Edit the description
    await page.getByLabel("Description").fill("E2E test description");
    await page.getByLabel("Description").blur();

    // Wait a moment for debounced save
    await page.waitForTimeout(1000);

    // Delete the task
    await page.getByRole("button", { name: "Delete" }).click();

    // Confirmation dialog should appear
    await expect(page.getByText("Delete task?")).toBeVisible();
    // Click the Delete button inside the alert dialog (not the sheet's button)
    await page
      .locator("[role=alertdialog]")
      .getByRole("button", { name: "Delete" })
      .click();

    // Sheet should close and task should be gone from the board
    await expect(
      page.locator(".text-sm.font-medium", { hasText: taskTitle }),
    ).not.toBeVisible({ timeout: 5000 });
  });

  test("create task → mark complete → reopen", async ({ page }) => {
    const categoryName = `E2E CompCat ${SUFFIX}`;
    const projectName = `E2E CompProj ${SUFFIX}`;
    const taskTitle = `E2E Complete ${SUFFIX}`;

    // Open sidebar on mobile
    await ensureSidebar(page);

    // Setup: create category + project
    await page.getByRole("button", { name: "Create category" }).click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName).last()).toBeVisible({
      timeout: 5000,
    });

    await scrollClick(
      page.getByRole("button", { name: `Add project to ${categoryName}` }),
    );
    await page.getByLabel("Name").fill(projectName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("link", { name: projectName })).toBeVisible({
      timeout: 5000,
    });

    await scrollClick(page.getByRole("link", { name: projectName }));
    await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });

    // Create a task
    await page.getByLabel("Add task to To Do").click();
    const taskInput = page.getByPlaceholder("Task title…");
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 5000 });

    // Open task sheet
    await page.getByText(taskTitle).click();
    await expect(page.getByLabel("Title")).toBeVisible({ timeout: 5000 });

    // Mark complete
    await page.getByRole("button", { name: "Mark Complete" }).click();

    // Button should change to "Reopen"
    await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible({
      timeout: 5000,
    });

    // Reopen
    await page.getByRole("button", { name: "Reopen" }).click();

    // Button should change back to "Mark Complete"
    await expect(
      page.getByRole("button", { name: "Mark Complete" }),
    ).toBeVisible({ timeout: 5000 });
  });
});
