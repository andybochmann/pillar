import { Locator, Page } from "@playwright/test";

/**
 * Opens the sidebar Sheet on mobile viewports. No-op on desktop where sidebar is always visible.
 * Only call this when the sidebar Sheet is known to be closed (e.g., after login or after navigation).
 */
export async function ensureSidebar(page: Page) {
  const viewportSize = page.viewportSize();
  if (!viewportSize || viewportSize.width >= 768) return;
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page.waitForTimeout(300);
}

/**
 * Scrolls an element into view using browser-native scrollIntoView, then clicks it.
 * Needed for elements inside Radix ScrollArea which Playwright can't auto-scroll.
 */
export async function scrollClick(locator: Locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await locator.click({ timeout: 5000 });
}
