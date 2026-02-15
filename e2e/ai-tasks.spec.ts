import { test, expect } from "@playwright/test";
import { ensureSidebar } from "./helpers";

const TEST_USER = {
  email: "test@pillar.dev",
  password: "TestPassword123!",
};

const SUFFIX = Date.now().toString(36);

test.describe("AI Task Generation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("generate AI tasks and add to board", async ({ page }) => {
    const categoryName = `AI Cat ${SUFFIX}`;
    const projectName = `AI Project ${SUFFIX}`;

    // Create category
    await ensureSidebar(page);
    await page.getByRole("button", { name: "Create category" }).click();
    await page.getByLabel("Name").fill(categoryName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(categoryName).last()).toBeVisible({
      timeout: 5000,
    });

    // Create project with descriptive name
    await ensureSidebar(page);
    await page.getByText(categoryName).last().click();
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Project name").fill(projectName);
    await page
      .getByLabel("Description")
      .fill("An e-commerce app with product listings, cart, and checkout");
    await page.getByRole("button", { name: "Create" }).click();

    // Navigate to the project board
    await page.getByText(projectName).click();
    await expect(
      page.getByRole("heading", { name: projectName }),
    ).toBeVisible({ timeout: 10000 });

    // Check if "Generate Tasks" button is visible (requires AI_API_KEY + whitelist)
    const generateBtn = page.getByRole("button", { name: "Generate Tasks" });

    // If AI is not configured, skip the rest of the test
    if (!(await generateBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "AI not configured or user not whitelisted");
      return;
    }

    // Click Generate Tasks
    await generateBtn.click();
    await expect(page.getByText("Generate Tasks")).toBeVisible();

    // Select count = 5
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "5" })
      .click();

    // Click generate
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Generate 5 Tasks/ })
      .click();

    // Wait for drafts to appear (AI can take a while)
    await expect(page.getByText(/of \d+ selected/)).toBeVisible({
      timeout: 30000,
    });

    // Verify draft items are rendered
    const draftItems = page.locator('[data-testid^="draft-item-"]');
    const draftCount = await draftItems.count();
    expect(draftCount).toBeGreaterThan(0);

    // Toggle one draft off
    if (draftCount > 1) {
      const firstCheckbox = draftItems
        .first()
        .locator('[data-slot="checkbox"]');
      await firstCheckbox.click();

      // Verify selected count decreased
      const expectedSelected = draftCount - 1;
      await expect(
        page.getByText(`${expectedSelected} of ${draftCount} selected`),
      ).toBeVisible();
    }

    // Click "Add Tasks"
    const addBtn = page.getByRole("button", { name: /Add \d+ Tasks?/ });
    await addBtn.click();

    // Wait for success toast
    await expect(page.getByText(/Added \d+ tasks/)).toBeVisible({
      timeout: 10000,
    });

    // Dialog should close
    await expect(page.getByText(/of \d+ selected/)).not.toBeVisible();
  });
});
