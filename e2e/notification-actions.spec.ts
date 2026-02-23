/**
 * E2E test: verifies notification action API endpoints work through
 * the real HTTP stack (auth middleware → route handler → DB).
 *
 * Uses page.evaluate(fetch) to call the APIs with real session cookies,
 * simulating exactly what the service worker does.
 */
import { test, expect } from "@playwright/test";

const TEST_USER = {
  email: "test@pillar.dev",
  password: "TestPassword123!",
};

test.describe("Notification action API endpoints", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate (use exact: true to avoid label collision with toggle button)
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15000 });
  });

  test("POST /api/tasks/:id/complete sets completedAt and moves to done", async ({ page }) => {
    // Step 1: Create a category
    const categoryRes = await page.evaluate(async () => {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: `E2E Complete ${Date.now()}` }),
      });
      return { status: res.status, data: await res.json() };
    });
    expect(categoryRes.status).toBe(201);
    const categoryId = categoryRes.data._id;

    // Step 2: Create a project
    const projectRes = await page.evaluate(async (catId: string) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: `E2E Project ${Date.now()}`, categoryId: catId }),
      });
      return { status: res.status, data: await res.json() };
    }, categoryId);
    expect(projectRes.status).toBe(201);
    const projectId = projectRes.data._id;

    // Step 3: Create a task in the "todo" column
    const taskRes = await page.evaluate(async (projId: string) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: `E2E Complete Task ${Date.now()}`,
          projectId: projId,
          columnId: "todo",
        }),
      });
      return { status: res.status, data: await res.json() };
    }, projectId);
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.data._id;

    // Verify task is in "todo" column and not completed
    expect(taskRes.data.columnId).toBe("todo");
    expect(taskRes.data.completedAt).toBeFalsy();

    // Step 4: Call the complete endpoint (exactly like the SW does)
    const completeRes = await page.evaluate(async (tId: string) => {
      const res = await fetch(`/api/tasks/${tId}/complete`, {
        method: "POST",
        credentials: "same-origin",
      });
      return {
        status: res.status,
        redirected: res.redirected,
        url: res.url,
        data: await res.json(),
      };
    }, taskId);

    // Verify: no redirect (auth worked)
    expect(completeRes.redirected).toBe(false);
    expect(completeRes.url).toContain("/api/tasks/");

    // Verify: response is 200 with completedAt and done column
    expect(completeRes.status).toBe(200);
    expect(completeRes.data.completedAt).toBeTruthy();
    expect(completeRes.data.columnId).toBe("done");
    // statusHistory includes initial "todo" entry from creation + "done" from complete
    expect(completeRes.data.statusHistory.length).toBeGreaterThanOrEqual(1);
    const lastEntry = completeRes.data.statusHistory[completeRes.data.statusHistory.length - 1];
    expect(lastEntry.columnId).toBe("done");

    // Step 5: Fetch the task to verify DB state
    const verifyRes = await page.evaluate(async (tId: string) => {
      const res = await fetch(`/api/tasks/${tId}`, {
        credentials: "same-origin",
      });
      return { status: res.status, data: await res.json() };
    }, taskId);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.completedAt).toBeTruthy();
    expect(verifyRes.data.columnId).toBe("done");

    // Cleanup
    await page.evaluate(async (ids: { taskId: string; projectId: string; categoryId: string }) => {
      await fetch(`/api/tasks/${ids.taskId}`, { method: "DELETE", credentials: "same-origin" });
      await fetch(`/api/projects/${ids.projectId}`, { method: "DELETE", credentials: "same-origin" });
      await fetch(`/api/categories/${ids.categoryId}`, { method: "DELETE", credentials: "same-origin" });
    }, { taskId, projectId, categoryId });
  });

  test("POST /api/tasks/:id/snooze sets reminderAt to +24h", async ({ page }) => {
    // Step 1: Create category + project + task
    const categoryRes = await page.evaluate(async () => {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: `E2E Snooze ${Date.now()}` }),
      });
      return { status: res.status, data: await res.json() };
    });
    expect(categoryRes.status).toBe(201);
    const categoryId = categoryRes.data._id;

    const projectRes = await page.evaluate(async (catId: string) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: `E2E Snooze Project ${Date.now()}`, categoryId: catId }),
      });
      return { status: res.status, data: await res.json() };
    }, categoryId);
    expect(projectRes.status).toBe(201);
    const projectId = projectRes.data._id;

    const taskRes = await page.evaluate(async (projId: string) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: `E2E Snooze Task ${Date.now()}`,
          projectId: projId,
          columnId: "todo",
        }),
      });
      return { status: res.status, data: await res.json() };
    }, projectId);
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.data._id;

    // Step 2: Call the snooze endpoint (exactly like the SW does)
    const beforeSnooze = Date.now();
    const snoozeRes = await page.evaluate(async (tId: string) => {
      const res = await fetch(`/api/tasks/${tId}/snooze`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return {
        status: res.status,
        redirected: res.redirected,
        url: res.url,
        data: await res.json(),
      };
    }, taskId);

    // Verify: no redirect
    expect(snoozeRes.redirected).toBe(false);
    expect(snoozeRes.url).toContain("/api/tasks/");

    // Verify: response is 200 with snoozedUntil
    expect(snoozeRes.status).toBe(200);
    expect(snoozeRes.data.success).toBe(true);
    expect(snoozeRes.data.snoozedUntil).toBeTruthy();

    // Step 3: Fetch the task to verify reminderAt is set in DB
    const verifyRes = await page.evaluate(async (tId: string) => {
      const res = await fetch(`/api/tasks/${tId}`, {
        credentials: "same-origin",
      });
      return { status: res.status, data: await res.json() };
    }, taskId);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.reminderAt).toBeTruthy();

    // Verify the reminder is ~24h from now
    const reminderTime = new Date(verifyRes.data.reminderAt).getTime();
    const expected24h = beforeSnooze + 24 * 60 * 60 * 1000;
    expect(Math.abs(reminderTime - expected24h)).toBeLessThan(10_000); // within 10s

    // Cleanup
    await page.evaluate(async (ids: { taskId: string; projectId: string; categoryId: string }) => {
      await fetch(`/api/tasks/${ids.taskId}`, { method: "DELETE", credentials: "same-origin" });
      await fetch(`/api/projects/${ids.projectId}`, { method: "DELETE", credentials: "same-origin" });
      await fetch(`/api/categories/${ids.categoryId}`, { method: "DELETE", credentials: "same-origin" });
    }, { taskId, projectId, categoryId });
  });

  test("complete endpoint rejects when cookies cleared (simulates expired session)", async ({ page }) => {
    // beforeEach already authenticated; now clear cookies to simulate expiry
    await page.context().clearCookies();

    // Try to call complete endpoint — exactly what SW does with expired session
    const res = await page.evaluate(async () => {
      const res = await fetch("/api/tasks/507f1f77bcf86cd799439011/complete", {
        method: "POST",
        credentials: "same-origin",
      });
      return {
        status: res.status,
        redirected: res.redirected,
        url: res.url,
        ok: res.ok,
      };
    });

    // The auth middleware returns a 302 redirect to /login.
    // The browser follows it, so the final response is 200 (login page HTML).
    // This means res.ok is TRUE — which is exactly the bug the SW hit.
    // The SW must check res.redirected to detect this silent auth failure.
    expect(res.redirected).toBe(true);
    // The final URL should NOT be the API endpoint (it's the login page)
    expect(res.url).not.toContain("/api/tasks/");
  });
});
