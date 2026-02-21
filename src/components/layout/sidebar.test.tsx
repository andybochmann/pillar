import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./sidebar";

// Hoisted mock values
const mockPathname = vi.hoisted(() => ({ value: "/" }));

// Mock hooks
vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({
    categories: [],
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
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

vi.mock("@/hooks/use-task-counts", () => ({
  useTaskCounts: () => ({
    counts: null,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-all-category-notes", () => ({
  useAllCategoryNotes: () => ({
    notesByCategoryId: new Map(),
    fetchAll: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Expanded state", () => {
    it("renders navigation items with labels", () => {
      render(<Sidebar />);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Overview")).toBeInTheDocument();
      expect(screen.getByText("Calendar")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("renders sign out button with label", () => {
      render(<Sidebar />);
      expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    });

    it("does not render tooltips", () => {
      render(<Sidebar />);
      // In expanded mode, navigation items are direct links without tooltips
      const dashboardLink = screen.getByText("Dashboard").closest("a");
      expect(dashboardLink).not.toHaveAttribute("data-state");
    });
  });

  describe("Collapsed state", () => {
    it("renders icon-only navigation", async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      // Click collapse button
      const collapseButton = screen.getByRole("button", { name: /collapse sidebar/i });
      await user.click(collapseButton);

      // Labels should not be visible
      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
      expect(screen.queryByText("Overview")).not.toBeInTheDocument();
      expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
      expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    });

    it("shows tooltip on navigation item hover", async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      // Collapse sidebar
      await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

      // Find the first navigation link (Dashboard)
      const navLinks = screen.getAllByRole("link");
      const dashboardLink = navLinks.find((link) => link.getAttribute("href") === "/home");

      expect(dashboardLink).toBeInTheDocument();

      // Hover over the link
      await user.hover(dashboardLink!);

      // Tooltip should appear - check for role="tooltip"
      await waitFor(() => {
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent("Dashboard");
      });
    });

    it("shows correct tooltip for Overview navigation item", async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      // Collapse sidebar
      await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

      // Test Overview link specifically
      const navLinks = screen.getAllByRole("link");
      const overviewLink = navLinks.find((l) => l.getAttribute("href") === "/overview");

      expect(overviewLink).toBeInTheDocument();

      await user.hover(overviewLink!);

      await waitFor(() => {
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent("Overview");
      });
    });

    it("shows correct tooltip for Calendar navigation item", async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      // Collapse sidebar
      await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

      // Test Calendar link specifically
      const navLinks = screen.getAllByRole("link");
      const calendarLink = navLinks.find((l) => l.getAttribute("href") === "/calendar");

      expect(calendarLink).toBeInTheDocument();

      await user.hover(calendarLink!);

      await waitFor(() => {
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent("Calendar");
      });
    });

    it("shows tooltip on sign out button hover", async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      // Collapse sidebar
      await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

      // Find sign out button by its icon
      const signOutButtons = screen.getAllByRole("button");
      const signOutButton = signOutButtons.find((btn) =>
        btn.className.includes("cursor-pointer") &&
        btn.querySelector("svg")
      );

      expect(signOutButton).toBeInTheDocument();

      // Hover over button
      await user.hover(signOutButton!);

      // Tooltip should appear
      await waitFor(() => {
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent("Sign out");
      });
    });

    it("navigates when clicking nav item in collapsed mode", async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      render(<Sidebar onNavigate={onNavigate} />);

      // Collapse sidebar
      await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

      // Click a navigation link
      const navLinks = screen.getAllByRole("link");
      const overviewLink = navLinks.find((link) => link.getAttribute("href") === "/overview");

      await user.click(overviewLink!);

      expect(onNavigate).toHaveBeenCalled();
    });

    it("signs out when clicking sign out button in collapsed mode", async () => {
      const user = userEvent.setup();
      const { signOut } = await import("next-auth/react");
      render(<Sidebar />);

      // Collapse sidebar
      await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

      // Find and click sign out button
      const signOutButtons = screen.getAllByRole("button");
      const signOutButton = signOutButtons.find((btn) =>
        btn.className.includes("cursor-pointer") &&
        btn.querySelector("svg")
      );

      await user.click(signOutButton!);

      expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
    });
  });

  describe("Toggle collapse", () => {
    it("toggles between expanded and collapsed", async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      // Initially expanded
      expect(screen.getByText("Dashboard")).toBeInTheDocument();

      const collapseButton = screen.getByRole("button", { name: /collapse sidebar/i });

      // Collapse
      await user.click(collapseButton);
      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();

      // Button should now say "Expand sidebar"
      const expandButton = screen.getByRole("button", { name: /expand sidebar/i });

      // Expand
      await user.click(expandButton);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });
  });

  describe("Active state", () => {
    it("highlights active navigation item in collapsed mode", async () => {
      const user = userEvent.setup();

      // Set pathname to /overview
      mockPathname.value = "/overview";

      render(<Sidebar />);

      // Collapse sidebar
      await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

      // Find the overview link
      const overviewLink = screen.getAllByRole("link").find(
        (link) => link.getAttribute("href") === "/overview"
      );

      // Should have active styling
      expect(overviewLink?.className).toContain("bg-primary/10");
      expect(overviewLink?.className).toContain("text-primary");

      // Reset
      mockPathname.value = "/";
    });
  });
});
