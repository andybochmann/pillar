import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenerateTasksDialog } from "./generate-tasks-dialog";
import type { Column } from "@/types";

vi.mock("@/lib/offline-fetch", () => ({
  offlineFetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const columns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "in-progress", name: "In Progress", order: 1 },
  { id: "done", name: "Done", order: 2 },
];

function mockFetchResponse(data: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  });
}

describe("GenerateTasksDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it("renders initial state with count selector", () => {
    render(
      <GenerateTasksDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        columns={columns}
        onTasksAdded={vi.fn()}
      />,
    );

    expect(screen.getByText("Generate Tasks")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("Generate 8 Tasks")).toBeInTheDocument();
  });

  it("changes count when a count button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <GenerateTasksDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        columns={columns}
        onTasksAdded={vi.fn()}
      />,
    );

    await user.click(screen.getByText("5"));
    expect(screen.getByText("Generate 5 Tasks")).toBeInTheDocument();
  });

  it("shows loading state during generation", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({ tasks: [] }),
              }),
            100,
          );
        }),
    );

    render(
      <GenerateTasksDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        columns={columns}
        onTasksAdded={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Generate 8 Tasks"));
    expect(screen.getByText("Generating tasks...")).toBeInTheDocument();
  });

  it("shows drafts after generation", async () => {
    const user = userEvent.setup();
    mockFetchResponse({
      tasks: [
        {
          title: "Task A",
          description: "Desc A",
          priority: "high",
          columnId: "todo",
          subtasks: ["Sub 1"],
        },
        {
          title: "Task B",
          priority: "medium",
          columnId: "in-progress",
          subtasks: [],
        },
      ],
    });

    render(
      <GenerateTasksDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        columns={columns}
        onTasksAdded={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Generate 8 Tasks"));

    expect(screen.getByText("2 of 2 selected")).toBeInTheDocument();
    expect(screen.getByText("Add 2 Tasks")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Task A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Task B")).toBeInTheDocument();
  });

  it("updates selected count when toggling", async () => {
    const user = userEvent.setup();
    mockFetchResponse({
      tasks: [
        {
          title: "Task A",
          priority: "high",
          columnId: "todo",
          subtasks: [],
        },
        {
          title: "Task B",
          priority: "medium",
          columnId: "todo",
          subtasks: [],
        },
      ],
    });

    render(
      <GenerateTasksDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        columns={columns}
        onTasksAdded={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Generate 8 Tasks"));

    // Deselect first task
    await user.click(screen.getByLabelText("Select Task A"));

    expect(screen.getByText("1 of 2 selected")).toBeInTheDocument();
    expect(screen.getByText("Add 1 Task")).toBeInTheDocument();
  });

  it("shows select/deselect all toggle", async () => {
    const user = userEvent.setup();
    mockFetchResponse({
      tasks: [
        {
          title: "Task A",
          priority: "high",
          columnId: "todo",
          subtasks: [],
        },
      ],
    });

    render(
      <GenerateTasksDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        columns={columns}
        onTasksAdded={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Generate 8 Tasks"));

    expect(screen.getByText("Deselect All")).toBeInTheDocument();

    await user.click(screen.getByText("Deselect All"));

    expect(screen.getByText("Select All")).toBeInTheDocument();
    expect(screen.getByText("0 of 1 selected")).toBeInTheDocument();
  });

  it("has DialogDescription for accessibility", () => {
    render(
      <GenerateTasksDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        columns={columns}
        onTasksAdded={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Use AI to generate tasks/),
    ).toBeInTheDocument();
  });
});
