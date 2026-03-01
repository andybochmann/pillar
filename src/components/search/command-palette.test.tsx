import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./command-palette";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const mockSearchResults = {
  tasks: [
    {
      _id: "t1",
      title: "Fix login bug",
      projectId: "p1",
      projectName: "My Project",
      priority: "high",
      columnId: "todo",
      completedAt: null,
    },
    {
      _id: "t2",
      title: "Fix footer",
      projectId: "p2",
      projectName: "Other Project",
      priority: "low",
      columnId: "done",
      completedAt: "2025-01-01",
    },
  ],
  notes: [],
  archivedTasks: [],
};

const emptyResults = { tasks: [], notes: [], archivedTasks: [] };

describe("CommandPalette", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    localStorage.clear();
    // cmdk uses scrollIntoView which is not available in jsdom
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("opens on / key", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    await user.keyboard("/");

    expect(
      screen.getByPlaceholderText("Search tasks and notes..."),
    ).toBeInTheDocument();
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
      screen.queryByPlaceholderText("Search tasks and notes..."),
    ).not.toBeInTheDocument();
  });

  it("shows search results after typing", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSearchResults,
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(
      screen.getByPlaceholderText("Search tasks and notes..."),
      "Fix",
    );

    await waitFor(() => {
      expect(screen.getByText("Fix login bug")).toBeInTheDocument();
      expect(screen.getByText("Fix footer")).toBeInTheDocument();
    });
  });

  it("shows empty state when no results", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => emptyResults,
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(
      screen.getByPlaceholderText("Search tasks and notes..."),
      "xyz",
    );

    await waitFor(() => {
      expect(screen.getByText("No results found")).toBeInTheDocument();
    });
  });

  it("shows SearchX icon in empty state", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => emptyResults,
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(
      screen.getByPlaceholderText("Search tasks and notes..."),
      "xyz",
    );

    await waitFor(() => {
      const emptyText = screen.getByText("No results found");
      expect(emptyText).toBeInTheDocument();
      const icon = emptyText.parentElement?.querySelector("svg.h-12.w-12");
      expect(icon).toBeInTheDocument();
    });
  });

  it("shows loading state with icon when searching", async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(fetch).mockReturnValue(fetchPromise);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(
      screen.getByPlaceholderText("Search tasks and notes..."),
      "test",
    );

    await waitFor(() => {
      const loadingText = screen.getByText("Searching...");
      expect(loadingText).toBeInTheDocument();
      const icon =
        loadingText.parentElement?.querySelector("svg.animate-spin");
      expect(icon).toBeInTheDocument();
    });

    // Clean up
    resolvePromise!({
      ok: true,
      json: async () => emptyResults,
    } as Response);
  });

  it("navigates to project on select", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSearchResults,
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(
      screen.getByPlaceholderText("Search tasks and notes..."),
      "Fix",
    );

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
      json: async () => mockSearchResults,
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(
      screen.getByPlaceholderText("Search tasks and notes..."),
      "Fix",
    );

    await waitFor(() => {
      expect(screen.getByText("high")).toBeInTheDocument();
      expect(screen.getByText("low")).toBeInTheDocument();
    });
  });

  it("applies line-through to completed tasks", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSearchResults,
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(
      screen.getByPlaceholderText("Search tasks and notes..."),
      "Fix",
    );

    await waitFor(() => {
      const completed = screen.getByText("Fix footer");
      expect(completed).toHaveClass("line-through");
    });
  });

  it("shows grouped results with section headings", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: [mockSearchResults.tasks[0]],
        notes: [
          {
            _id: "n1",
            title: "Search spec",
            parentType: "project",
            parentName: "My Project",
            snippet: "The search should...",
            projectId: "p1",
          },
        ],
        archivedTasks: [],
      }),
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(
      screen.getByPlaceholderText("Search tasks and notes..."),
      "search",
    );

    await waitFor(() => {
      expect(screen.getByText("Tasks (1)")).toBeInTheDocument();
      expect(screen.getByText("Notes (1)")).toBeInTheDocument();
    });
  });

  it("shows recent searches when opening with empty query", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "pillar-recent-searches",
      JSON.stringify(["bug fix", "dashboard"]),
    );

    render(<CommandPalette />);
    await user.keyboard("/");

    await waitFor(() => {
      expect(screen.getByText("bug fix")).toBeInTheDocument();
      expect(screen.getByText("dashboard")).toBeInTheDocument();
    });
  });

  it("clears recent searches", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "pillar-recent-searches",
      JSON.stringify(["old search"]),
    );

    render(<CommandPalette />);
    await user.keyboard("/");

    await waitFor(() => {
      expect(screen.getByText("old search")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Clear"));

    await waitFor(() => {
      expect(screen.queryByText("old search")).not.toBeInTheDocument();
    });
  });

  it("shows notes with parent name and snippet", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: [],
        notes: [
          {
            _id: "n1",
            title: "Architecture doc",
            parentType: "project",
            parentName: "Backend",
            snippet: "We use MongoDB for storage...",
            projectId: "p1",
          },
        ],
        archivedTasks: [],
      }),
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");
    await user.type(
      screen.getByPlaceholderText("Search tasks and notes..."),
      "MongoDB",
    );

    await waitFor(() => {
      expect(screen.getByText("Architecture doc")).toBeInTheDocument();
      expect(
        screen.getByText(/Backend.*We use MongoDB for storage/),
      ).toBeInTheDocument();
    });
  });

  it("shows archived tasks section when includeArchived toggled", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: [],
        notes: [],
        archivedTasks: [
          {
            _id: "at1",
            title: "Old archived task",
            projectId: "p1",
            projectName: "My Project",
            priority: "medium",
            columnId: "done",
            archived: true,
          },
        ],
      }),
    } as Response);

    render(<CommandPalette />);
    await user.keyboard("/");

    // Toggle include archived
    const archiveSwitch = screen.getByRole("switch");
    await user.click(archiveSwitch);

    await user.type(
      screen.getByPlaceholderText("Search tasks and notes..."),
      "archived",
    );

    await waitFor(() => {
      expect(screen.getByText("Old archived task")).toBeInTheDocument();
      expect(screen.getByText("Archived Tasks (1)")).toBeInTheDocument();
    });
  });
});
