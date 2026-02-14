import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({
    categories: [],
    createCategory: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-projects", () => ({
  useProjects: () => ({
    projects: [],
    createProject: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Accessibility", () => {
  it("sidebar has nav element", async () => {
    const { Sidebar } = await import("@/components/layout/sidebar");
    render(<Sidebar />);
    expect(document.querySelector("nav")).toBeTruthy();
  });

  it("sidebar collapse button has aria-label", async () => {
    const { Sidebar } = await import("@/components/layout/sidebar");
    render(<Sidebar />);
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeTruthy();
  });

  it("topbar has aria-label on menu button", async () => {
    const { Topbar } = await import("@/components/layout/topbar");
    render(<Topbar onMenuToggle={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Toggle menu" }),
    ).toBeTruthy();
  });

  it("sidebar has settings link", async () => {
    const { Sidebar } = await import("@/components/layout/sidebar");
    render(<Sidebar />);
    expect(screen.getByText("Settings")).toBeTruthy();
  });
});
