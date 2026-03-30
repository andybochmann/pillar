import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickAddTaskDialog } from "./quick-add-task-dialog";
import type { Project } from "@/types";

// --- Mocks ---

const mockCreateLabel = vi.fn().mockResolvedValue({
  _id: "label1",
  name: "Test",
  color: "#ef4444",
  userId: "u1",
  createdAt: "",
  updatedAt: "",
});

vi.mock("@/hooks/use-labels", () => ({
  useLabels: () => ({
    labels: [],
    loading: false,
    error: null,
    createLabel: mockCreateLabel,
    updateLabel: vi.fn(),
    deleteLabel: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-back-button", () => ({
  useBackButton: vi.fn(),
}));

const mockOfflineFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () =>
    Promise.resolve({
      _id: "task1",
      title: "Test Task",
      projectId: "p1",
      columnId: "col-todo",
      priority: "medium",
      userId: "u1",
      order: 0,
      labels: [],
      subtasks: [],
      statusHistory: [],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }),
});

vi.mock("@/lib/offline-fetch", () => ({
  offlineFetch: (...args: unknown[]) => mockOfflineFetch(...args),
}));

let mockPathname = "/home";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// --- Test data ---

const PROJECT_ID_1 = "aaaaaaaaaaaaaaaaaaaaaaaa";
const PROJECT_ID_2 = "bbbbbbbbbbbbbbbbbbbbbbbb";

const testProjects: Project[] = [
  {
    _id: PROJECT_ID_1,
    name: "Project Alpha",
    description: "",
    categoryId: "cat1",
    userId: "u1",
    columns: [
      { id: "col-todo", name: "To Do", order: 0 },
      { id: "col-done", name: "Done", order: 1 },
    ],
    viewType: "board",
    archived: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    _id: PROJECT_ID_2,
    name: "Project Beta",
    description: "",
    categoryId: "cat1",
    userId: "u1",
    columns: [
      { id: "col-backlog", name: "Backlog", order: 0 },
      { id: "col-wip", name: "In Progress", order: 1 },
    ],
    viewType: "board",
    archived: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

function openDialog() {
  document.dispatchEvent(new CustomEvent("pillar:open-quick-add-task"));
}

describe("QuickAddTaskDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPathname = "/home";
  });

  it("opens when pillar:open-quick-add-task event fires", async () => {
    render(<QuickAddTaskDialog projects={testProjects} />);

    expect(screen.queryByText("Quick Add Task")).toBeNull();

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });
  });

  it("pre-selects the first non-archived project by default", async () => {
    render(<QuickAddTaskDialog projects={testProjects} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    // The project selector trigger should display "Project Alpha"
    const trigger = screen.getByRole("combobox", { name: "Project" });
    expect(trigger).toHaveTextContent("Project Alpha");
  });

  it("disables submit when title is empty", async () => {
    render(<QuickAddTaskDialog projects={testProjects} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    const submitButton = screen.getByRole("button", { name: "Add Task" });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit when title is entered and project is selected", async () => {
    const user = userEvent.setup();
    render(<QuickAddTaskDialog projects={testProjects} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    const titleInput = screen.getByLabelText("Title");
    await user.type(titleInput, "My new task");

    const submitButton = screen.getByRole("button", { name: "Add Task" });
    expect(submitButton).not.toBeDisabled();
  });

  it("calls offlineFetch with correct payload on submit", async () => {
    const user = userEvent.setup();
    render(<QuickAddTaskDialog projects={testProjects} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    const titleInput = screen.getByLabelText("Title");
    await user.type(titleInput, "My new task");

    const submitButton = screen.getByRole("button", { name: "Add Task" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOfflineFetch).toHaveBeenCalledWith("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "My new task",
          projectId: PROJECT_ID_1,
          columnId: "col-todo",
          priority: "medium",
        }),
      });
    });
  });

  it("resets form and closes dialog after successful submit", async () => {
    const user = userEvent.setup();
    render(<QuickAddTaskDialog projects={testProjects} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    const titleInput = screen.getByLabelText("Title");
    await user.type(titleInput, "My new task");
    await user.click(screen.getByRole("button", { name: "Add Task" }));

    await waitFor(() => {
      expect(screen.queryByText("Quick Add Task")).toBeNull();
    });
  });

  it("shows error toast on failed submit", async () => {
    mockOfflineFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    const user = userEvent.setup();
    render(<QuickAddTaskDialog projects={testProjects} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    await user.type(screen.getByLabelText("Title"), "Fail task");
    await user.click(screen.getByRole("button", { name: "Add Task" }));

    // Dialog should remain open on error
    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });
  });

  it("toggles more options section", async () => {
    const user = userEvent.setup();
    render(<QuickAddTaskDialog projects={testProjects} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    expect(screen.queryByLabelText("Description")).toBeNull();

    // Reminder is always visible in the main form
    expect(screen.getByText("Reminder")).toBeTruthy();

    await user.click(screen.getByText("More options"));

    expect(screen.getByLabelText("Description")).toBeTruthy();
    expect(screen.getByText("Labels")).toBeTruthy();
    expect(screen.getByText("Priority")).toBeTruthy();
  });

  it("saves last used project to localStorage on submit", async () => {
    const user = userEvent.setup();
    render(<QuickAddTaskDialog projects={testProjects} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    await user.type(screen.getByLabelText("Title"), "My task");
    await user.click(screen.getByRole("button", { name: "Add Task" }));

    await waitFor(() => {
      expect(localStorage.getItem("pillar-last-used-project")).toBe(PROJECT_ID_1);
    });
  });

  it("closes and resets on Cancel", async () => {
    const user = userEvent.setup();
    render(<QuickAddTaskDialog projects={testProjects} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    await user.type(screen.getByLabelText("Title"), "Something");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("Quick Add Task")).toBeNull();
    });

    // Re-open — title should be reset
    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    const titleInput = screen.getByLabelText("Title") as HTMLInputElement;
    expect(titleInput.value).toBe("");
  });

  it("pre-selects project matching current URL path", async () => {
    mockPathname = `/projects/${PROJECT_ID_2}`;
    render(<QuickAddTaskDialog projects={testProjects} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    const trigger = screen.getByRole("combobox", { name: "Project" });
    expect(trigger).toHaveTextContent("Project Beta");
  });

  it("pre-selects last used project from localStorage", async () => {
    localStorage.setItem("pillar-last-used-project", PROJECT_ID_2);
    render(<QuickAddTaskDialog projects={testProjects} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    const trigger = screen.getByRole("combobox", { name: "Project" });
    expect(trigger).toHaveTextContent("Project Beta");
  });

  it("renders nothing when no projects exist", async () => {
    render(<QuickAddTaskDialog projects={[]} />);

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).toBeTruthy();
    });

    // Submit should be disabled with no projects
    const submitButton = screen.getByRole("button", { name: "Add Task" });
    expect(submitButton).toBeDisabled();
  });
});
