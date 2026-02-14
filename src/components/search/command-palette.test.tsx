import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./command-palette";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const mockTasks = [
  {
    _id: "t1",
    title: "Fix login bug",
    projectId: "p1",
    priority: "high",
    columnId: "c1",
    completedAt: null,
  },
  {
    _id: "t2",
    title: "Fix footer",
    projectId: "p2",
    priority: "low",
    columnId: "c2",
    completedAt: "2025-01-01",
  },
];

describe("CommandPalette", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("opens on / key", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    await user.keyboard("/");

    expect(screen.getByPlaceholderText("Search tasks…")).toBeInTheDocument();
  });

  it("does not open / when focused in an input", async () => {
    const user = userEvent.setup();
    render(
      <>
        <input data-testid="inp" />
        <CommandPalette />
      </>,
    );

    const inp = screen.getByTestId("inp");
    await user.click(inp);
    await user.keyboard("/");

    expect(
      screen.queryByPlaceholderText("Search tasks…"),
    ).not.toBeInTheDocument();
  });

  it("shows search results after typing", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockTasks,
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(screen.getByPlaceholderText("Search tasks…"), "Fix");

    await waitFor(() => {
      expect(screen.getByText("Fix login bug")).toBeInTheDocument();
      expect(screen.getByText("Fix footer")).toBeInTheDocument();
    });
  });

  it("shows empty state when no results", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(screen.getByPlaceholderText("Search tasks…"), "xyz");

    await waitFor(() => {
      expect(screen.getByText("No tasks found.")).toBeInTheDocument();
    });
  });

  it("navigates to project on select", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockTasks,
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(screen.getByPlaceholderText("Search tasks…"), "Fix");

    await waitFor(() => {
      expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Fix login bug"));

    expect(pushMock).toHaveBeenCalledWith("/projects/p1?taskId=t1");
  });

  it("shows priority badges", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockTasks,
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(screen.getByPlaceholderText("Search tasks…"), "Fix");

    await waitFor(() => {
      expect(screen.getByText("high")).toBeInTheDocument();
      expect(screen.getByText("low")).toBeInTheDocument();
    });
  });

  it("applies line-through to completed tasks", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockTasks,
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(screen.getByPlaceholderText("Search tasks…"), "Fix");

    await waitFor(() => {
      const completed = screen.getByText("Fix footer");
      expect(completed).toHaveClass("line-through");
    });
  });
});
