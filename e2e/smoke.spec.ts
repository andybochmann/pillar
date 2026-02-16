import { test, expect } from "@playwright/test";
import { ensureSidebar } from "./helpers";

const TEST_USER = {
  name: "Test User",
  email: "test@pillar.dev",
  password: "TestPassword123!",
};

test.describe("Marketing pages", () => {
  test("landing page is accessible without auth", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /organize your work with pillar/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Get Started" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
  });

  test("privacy page is accessible without auth", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: /privacy policy/i }),
    ).toBeVisible();
  });

  test("terms page is accessible without auth", async ({ page }) => {
    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: /terms of service/i }),
    ).toBeVisible();
  });
});

test.describe("Authentication", () => {
  test("unauthenticated user sees landing page at /", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /organize your work with pillar/i }),
    ).toBeVisible();
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome to Pillar")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText("Create an account")).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("can navigate between login and register", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/register/);

    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("can register a new account", async ({ page }) => {
    // Use a unique email to avoid 409 conflict with existing user
    const uniqueEmail = `test-${Date.now()}@pillar.dev`;
    await page.goto("/register");

    await page.getByLabel("Name").fill("New User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
    await page.getByLabel("Confirm Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Create account" }).click();

    // After registration, should redirect to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("can login with registered credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Should redirect to /home dashboard
    await expect(page).toHaveURL(/\/home/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/Welcome back/)).toBeVisible();
  });

  test("shows error for invalid login", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows error for mismatched passwords on register", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel("Name").fill("Another User");
    await page.getByLabel("Email").fill("another@pillar.dev");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByLabel("Confirm Password").fill("DifferentPassword!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Passwords do not match")).toBeVisible();
  });

  test("password visibility toggle works on login page", async ({ page }) => {
    await page.goto("/login");

    const passwordInput = page.getByLabel("Password");

    // Initially password should be hidden (type="password")
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Fill in password
    await passwordInput.fill("TestPassword123!");

    // Find and click toggle button - query by aria-label
    const toggleButton = page.locator('button[aria-label="Show password"]');
    await expect(toggleButton).toBeVisible({ timeout: 10000 });
    await toggleButton.click();

    // Password should now be visible
    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(passwordInput).toHaveValue("TestPassword123!");

    // Click toggle to hide password again
    const hideButton = page.locator('button[aria-label="Hide password"]');
    await expect(hideButton).toBeVisible();
    await hideButton.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("password visibility toggle works on register page", async ({ page }) => {
    await page.goto("/register");

    const passwordInput = page.getByLabel("Password", { exact: true });
    const confirmPasswordInput = page.getByLabel("Confirm Password");

    // Initially both passwords should be hidden
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(confirmPasswordInput).toHaveAttribute("type", "password");

    // Fill in both password fields
    await passwordInput.fill("TestPassword123!");
    await confirmPasswordInput.fill("TestPassword123!");

    // Find both toggle buttons by aria-label
    const toggleButtons = page.locator('button[aria-label="Show password"]');
    await expect(toggleButtons).toHaveCount(2, { timeout: 10000 });

    // Toggle password visibility for first field
    await toggleButtons.nth(0).click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(passwordInput).toHaveValue("TestPassword123!");
    // Second field should still be hidden
    await expect(confirmPasswordInput).toHaveAttribute("type", "password");

    // Toggle password visibility for second field
    await toggleButtons.nth(1).click();
    await expect(confirmPasswordInput).toHaveAttribute("type", "text");
    await expect(confirmPasswordInput).toHaveValue("TestPassword123!");

    // Hide both passwords
    const hideButtons = page.locator('button[aria-label="Hide password"]');
    await expect(hideButtons).toHaveCount(2);
    await hideButtons.nth(0).click();
    await expect(passwordInput).toHaveAttribute("type", "password");
    await hideButtons.nth(1).click();
    await expect(confirmPasswordInput).toHaveAttribute("type", "password");
  });
});

test.describe("Dashboard (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("dashboard shows summary cards", async ({ page }) => {
    await expect(page.getByText("Overdue Tasks")).toBeVisible();
    await expect(page.getByText("Due Today", { exact: true })).toBeVisible();
    await expect(page.getByText("Due This Week")).toBeVisible();
  });

  test("sidebar is visible with navigation links", async ({ page }) => {
    await ensureSidebar(page);
    await expect(page.getByRole("link", { name: "Pillar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Calendar", exact: true }),
    ).toBeVisible();
  });

  test("can navigate to overview page", async ({ page }) => {
    await ensureSidebar(page);
    await page.getByRole("link", { name: "Overview" }).click();
    await expect(page).toHaveURL(/\/overview/);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("can navigate to calendar page", async ({ page }) => {
    await ensureSidebar(page);
    await page.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  });

  test("sidebar can be collapsed and expanded", async ({ page }) => {
    const { width } = page.viewportSize()!;
    test.skip(
      width < 768,
      "Collapse not available on mobile — uses sheet overlay",
    );

    const collapseButton = page.getByLabel("Collapse sidebar");
    await collapseButton.click();

    // After collapse, dashboard link should not be visible
    await expect(
      page.getByRole("link", { name: "Dashboard" }),
    ).not.toBeVisible();

    const expandButton = page.getByLabel("Expand sidebar");
    await expandButton.click();

    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  test("can sign out", async ({ page }) => {
    await ensureSidebar(page);
    await page.getByRole("button", { name: "Sign out" }).click();

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
