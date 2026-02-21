import { test, expect, type Page } from "@playwright/test";
import { ensureSidebar, scrollClick } from "./helpers";

const TEST_USER = {
  email: "test@pillar.dev",
  password: "TestPassword123!",
};

const SUFFIX = Date.now().toString(36);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_USER.email);
  await page.locator("#password").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 15000,
  });
}

/**
 * Creates a category + project, navigates into the project board.
 * Returns the category and project names.
 */
async function setupCategoryAndProject(
  page: Page,
  suffix: string,
): Promise<{ categoryName: string; projectName: string }> {
  const categoryName = `Notes Cat ${suffix}`;
  const projectName = `Notes Proj ${suffix}`;

  await ensureSidebar(page);

  // Create category
  await page.getByRole("button", { name: "Create category" }).click();
  await page.getByLabel("Name").fill(categoryName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(categoryName).last()).toBeVisible({
    timeout: 5000,
  });

  // Create project via the category actions dropdown
  await scrollClick(
    page.getByRole("button", { name: `Actions for ${categoryName}` }),
  );
  await page.getByRole("menuitem", { name: "Add Project" }).click();
  await page.getByLabel("Name").fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("link", { name: projectName })).toBeVisible({
    timeout: 5000,
  });

  // Navigate into project
  await scrollClick(page.getByRole("link", { name: projectName }));
  await expect(page.getByText("To Do")).toBeVisible({ timeout: 10000 });

  return { categoryName, projectName };
}

// ─── Category Notes ────────────────────────────────────────────────────────────

test.describe("Category Notes", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Notes link appears in sidebar under expanded category", async ({
    page,
  }) => {
    const categoryName = `Notes SidebarCat ${SUFFIX}`;

    await ensureSidebar(page);
    await page.getByRole("button", { name: "Create category" }).click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName).last()).toBeVisible({
      timeout: 5000,
    });

    // Notes link should appear immediately (category is expanded by default)
    const notesLinks = page.getByRole("link", { name: "Notes" });
    await expect(notesLinks.last()).toBeVisible({ timeout: 5000 });
  });

  test("can create a category note", async ({ page }) => {
    const categoryName = `Notes CreateCat ${SUFFIX}`;
    const noteTitle = `My Category Note ${SUFFIX}`;

    await ensureSidebar(page);
    await page.getByRole("button", { name: "Create category" }).click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName).last()).toBeVisible({
      timeout: 5000,
    });

    await scrollClick(page.getByRole("link", { name: "Notes" }).last());
    await expect(page).toHaveURL(/\/categories\/.+\/notes/);

    // Open create dialog
    await page.getByRole("button", { name: "New Note" }).click();
    await expect(
      page.getByRole("heading", { name: "New Note" }),
    ).toBeVisible();

    // Fill title
    await page.locator("#note-title").fill(noteTitle);

    // Submit
    await page.getByRole("button", { name: "Create Note" }).click();

    // Note should appear in the list
    await expect(page.getByText(noteTitle)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("No notes yet")).not.toBeVisible();
  });

  test("can edit a category note title and content", async ({ page }) => {
    const categoryName = `Notes EditCat ${SUFFIX}`;
    const noteTitle = `Edit Me ${SUFFIX}`;
    const updatedTitle = `Edited Note ${SUFFIX}`;

    await ensureSidebar(page);
    await page.getByRole("button", { name: "Create category" }).click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName).last()).toBeVisible({
      timeout: 5000,
    });

    await scrollClick(page.getByRole("link", { name: "Notes" }).last());
    await expect(page).toHaveURL(/\/categories\/.+\/notes/);

    // Create note
    await page.getByRole("button", { name: "New Note" }).click();
    await page.locator("#note-title").fill(noteTitle);
    await page.getByRole("button", { name: "Create Note" }).click();
    await expect(page.getByText(noteTitle)).toBeVisible({ timeout: 5000 });

    // Click the note to edit it
    await page.getByText(noteTitle).click();
    await expect(
      page.getByRole("heading", { name: "Edit Note" }),
    ).toBeVisible();

    // Change title — auto-saves after 500ms
    const titleInput = page.locator("#note-title");
    await titleInput.clear();
    await titleInput.fill(updatedTitle);

    // Wait for auto-save debounce
    await page.waitForTimeout(800);

    // Close dialog
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "Edit Note" }),
    ).not.toBeVisible();

    // Updated title should appear
    await expect(page.getByText(updatedTitle)).toBeVisible({ timeout: 5000 });
  });

  test("can pin and unpin a category note", async ({ page }) => {
    const categoryName = `Notes PinCat ${SUFFIX}`;
    const noteTitle = `Pinnable Note ${SUFFIX}`;

    await ensureSidebar(page);
    await page.getByRole("button", { name: "Create category" }).click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName).last()).toBeVisible({
      timeout: 5000,
    });

    await scrollClick(page.getByRole("link", { name: "Notes" }).last());
    await expect(page).toHaveURL(/\/categories\/.+\/notes/);

    // Create note
    await page.getByRole("button", { name: "New Note" }).click();
    await page.locator("#note-title").fill(noteTitle);
    await page.getByRole("button", { name: "Create Note" }).click();
    await expect(page.getByText(noteTitle)).toBeVisible({ timeout: 5000 });

    // Hover over note card to reveal the context menu button
    const noteCard = page.locator('[role="button"]').filter({ hasText: noteTitle });
    await noteCard.hover();

    // Click the "..." context menu
    await noteCard
      .getByRole("button")
      .filter({ has: page.locator("svg") })
      .last()
      .click();

    // Click "Pin"
    await page.getByRole("menuitem", { name: "Pin" }).click();

    // Note should now show pinned styling — verify via "Unpin" option in menu
    await noteCard.hover();
    await noteCard
      .getByRole("button")
      .filter({ has: page.locator("svg") })
      .last()
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Unpin" }),
    ).toBeVisible();

    // Unpin
    await page.getByRole("menuitem", { name: "Unpin" }).click();

    // Menu should show "Pin" again
    await noteCard.hover();
    await noteCard
      .getByRole("button")
      .filter({ has: page.locator("svg") })
      .last()
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Pin" }),
    ).toBeVisible();
  });

  test("can delete a category note", async ({ page }) => {
    const categoryName = `Notes DelCat ${SUFFIX}`;
    const noteTitle = `Delete Me Note ${SUFFIX}`;

    await ensureSidebar(page);
    await page.getByRole("button", { name: "Create category" }).click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName).last()).toBeVisible({
      timeout: 5000,
    });

    await scrollClick(page.getByRole("link", { name: "Notes" }).last());
    await expect(page).toHaveURL(/\/categories\/.+\/notes/);

    // Create note
    await page.getByRole("button", { name: "New Note" }).click();
    await page.locator("#note-title").fill(noteTitle);
    await page.getByRole("button", { name: "Create Note" }).click();
    await expect(page.getByText(noteTitle)).toBeVisible({ timeout: 5000 });

    // Hover and open context menu
    const noteCard = page.locator('[role="button"]').filter({ hasText: noteTitle });
    await noteCard.hover();
    await noteCard
      .getByRole("button")
      .filter({ has: page.locator("svg") })
      .last()
      .click();

    // Click "Delete"
    await page.getByRole("menuitem", { name: "Delete" }).click();

    // Confirmation dialog
    await expect(page.getByText("Delete note?")).toBeVisible();
    await page
      .locator("[role=alertdialog]")
      .getByRole("button", { name: "Delete" })
      .click();

    // Note should be gone
    await expect(page.getByText(noteTitle)).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("No notes yet")).toBeVisible();
  });
});

// ─── Project Notes ─────────────────────────────────────────────────────────────

test.describe("Project Notes", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Notes button appears in project action bar", async ({ page }) => {
    await setupCategoryAndProject(page, `ProjBtn${SUFFIX}`);

    // Notes button should be visible in the project header
    await expect(
      page.getByRole("button", { name: "Notes", exact: true }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("can create a project note", async ({ page }) => {
    const noteTitle = `Project Note ${SUFFIX}`;

    await setupCategoryAndProject(page, `ProjCreate${SUFFIX}`);

    // Open notes sheet
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(page.getByText("Project Notes")).toBeVisible({
      timeout: 5000,
    });

    // Create note
    await page.getByRole("button", { name: "New Note" }).click();
    await expect(
      page.getByRole("heading", { name: "New Note" }),
    ).toBeVisible();

    await page.locator("#note-title").fill(noteTitle);
    await page.getByRole("button", { name: "Create Note" }).click();

    // Note should appear in the sheet
    await expect(page.getByText(noteTitle)).toBeVisible({ timeout: 5000 });
  });
});

// ─── Task Notes ─────────────────────────────────────────────────────────────────

test.describe("Task Notes", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  async function setupWithTask(
    page: Page,
    suffix: string,
  ): Promise<string> {
    await setupCategoryAndProject(page, suffix);

    const taskTitle = `Notes Task ${suffix}`;

    // Create task in To Do column
    await page.getByLabel("Add task to To Do").click();
    const taskInput = page.getByPlaceholder("Task title…");
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 5000 });

    // Open task sheet
    await page.getByText(taskTitle).click();
    await expect(page.locator("#task-title")).toBeVisible({ timeout: 5000 });

    return taskTitle;
  }

  test("Notes section is visible and collapsed in task sheet", async ({
    page,
  }) => {
    await setupWithTask(page, `TaskNotesSec${SUFFIX}`);

    // Notes collapsible label should be visible
    await expect(
      page.getByRole("button", { name: /Notes/ }),
    ).toBeVisible({ timeout: 5000 });

    // "Add Note" button should NOT be visible (section collapsed)
    await expect(
      page.getByRole("button", { name: "Add Note" }),
    ).not.toBeVisible();
  });

  test("can expand task notes section", async ({ page }) => {
    await setupWithTask(page, `TaskNotesExp${SUFFIX}`);

    // Click the Notes label to expand
    await page.getByRole("button", { name: /Notes/ }).click();

    // "Add Note" button should now appear
    await expect(
      page.getByRole("button", { name: "Add Note" }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("can delete a task note", async ({ page }) => {
    const noteTitle = `Del TaskNote ${SUFFIX}`;

    await setupWithTask(page, `TaskNoteDel${SUFFIX}`);

    // Create note
    await page.getByRole("button", { name: /Notes/ }).click();
    await page.getByRole("button", { name: "Add Note" }).click();
    await page.locator("#note-title").fill(noteTitle);
    await page.getByRole("button", { name: "Create Note" }).click();
    await expect(page.getByText(noteTitle)).toBeVisible({ timeout: 5000 });

    // Hover and open context menu on the note card
    const noteCard = page.locator('[role="button"]').filter({ hasText: noteTitle });
    await noteCard.hover();
    await noteCard
      .getByRole("button")
      .filter({ has: page.locator("svg") })
      .last()
      .click();

    await page.getByRole("menuitem", { name: "Delete" }).click();

    // Confirm
    await expect(page.getByText("Delete note?")).toBeVisible();
    await page
      .locator("[role=alertdialog]")
      .getByRole("button", { name: "Delete" })
      .click();

    await expect(page.getByText(noteTitle)).not.toBeVisible({ timeout: 5000 });
  });
});
